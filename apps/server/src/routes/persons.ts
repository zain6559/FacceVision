import { Router, type IRouter } from "express";
import { db, personsTable, faceEmbeddingsTable, recognitionLogsTable, safeDbQuery, withDbRetry, inMemoryStore } from "@workspace/db";
import { eq, count, desc, ilike, or } from "drizzle-orm";
import {
  ListPersonsQueryParams,
  EnrollPersonBody,
  GetPersonParams,
  DeletePersonParams,
  AddFaceToPersonParams,
  AddFaceToPersonBody,
} from "@workspace/api-zod";
import { extractEmbedding } from "../lib/faceRecognition.js";
import { invalidateRecognitionCaches } from "./recognition.js";

const router: IRouter = Router();

// GET /persons
router.get("/", async (req, res) => {
  try {
    const parsed = ListPersonsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { page = 1, limit = 20, search } = parsed.data;
    const offset = (page - 1) * limit;

    const whereClause = search
      ? or(
          ilike(personsTable.name, `%${search}%`),
          personsTable.nameAr ? ilike(personsTable.nameAr, `%${search}%`) : ilike(personsTable.name, `%${search}%`)
        )
      : undefined;

    const { data, isDegraded } = await safeDbQuery(
      async () => {
        const [persons, totalResult] = await Promise.all([
          db
            .select({
              id:           personsTable.id,
              name:         personsTable.name,
              nameAr:       personsTable.nameAr,
              source:       personsTable.source,
              thumbnailUrl: personsTable.thumbnailUrl,
              notes:        personsTable.notes,
              createdAt:    personsTable.createdAt,
              faceCount:    count(faceEmbeddingsTable.id),
            })
            .from(personsTable)
            .leftJoin(faceEmbeddingsTable, eq(faceEmbeddingsTable.personId, personsTable.id))
            .where(whereClause)
            .groupBy(personsTable.id)
            .orderBy(desc(personsTable.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ total: count() }).from(personsTable).where(whereClause),
        ]);
        return { persons, total: totalResult[0]?.total ?? 0, page, limit };
      },
      () => ({ persons: inMemoryStore.persons, total: inMemoryStore.persons.length, page, limit })
    );

    if (isDegraded) {
      res.setHeader("X-Degraded-Mode", "true");
    }
    res.json(data);
  } catch (err: any) {
    console.error("GET /persons error:", err);
    res.status(500).json({ error: "Failed to list persons", details: err?.message });
  }
});

// POST /persons  (enroll)
router.post("/", async (req, res) => {
  const parsed = EnrollPersonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, nameAr, source = "manual", imageBase64 } = parsed.data;

  try {
    const [person] = await withDbRetry(() => db.insert(personsTable).values({ name, nameAr, source }).returning());

    if (!person) {
      res.status(500).json({ error: "Failed to enroll person" });
      return;
    }

    if (imageBase64) {
      try {
        const result = await extractEmbedding(imageBase64);
        if (result) {
          await withDbRetry(() => db.insert(faceEmbeddingsTable).values({
            personId:         person.id,
            embedding:        result.embedding,
            clbpEmbedding:    result.clbpEmbedding,
            lbpEmbedding:     result.lbpEmbedding,
            hogEmbedding:     result.hogEmbedding,
            lpqEmbedding:     result.lpqEmbedding,
            dctEmbedding:     result.dctEmbedding,
            confidence:       result.qualityScore,
            qualityScore:     result.qualityScore,
            algorithmVersion: result.algorithmVersion,
            age:              result.age,
            gender:           result.gender,
            emotions:         result.emotions,
          }));
        }
      } catch (embErr) {
        console.error("Embedding extraction/insertion failed:", embErr);
      }
    }

    invalidateRecognitionCaches();
    res.status(201).json(person);
  } catch (err: any) {
    console.error("Failed to enroll person:", err);
    res.status(500).json({ error: "Database enrollment failed after retries", details: err?.message });
  }
});

// GET /persons/:id
router.get("/:id", async (req, res) => {
  try {
    const parsed = GetPersonParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [person, faceCountResult, faces, recognitionCount, lastSeen] = await Promise.all([
      db.select().from(personsTable).where(eq(personsTable.id, parsed.data.id)).limit(1),
      db.select({ count: count() }).from(faceEmbeddingsTable).where(eq(faceEmbeddingsTable.personId, parsed.data.id)),
      db
        .select({
          id:               faceEmbeddingsTable.id,
          imageUrl:         faceEmbeddingsTable.imageUrl,
          confidence:       faceEmbeddingsTable.confidence,
          qualityScore:     faceEmbeddingsTable.qualityScore,
          algorithmVersion: faceEmbeddingsTable.algorithmVersion,
          createdAt:        faceEmbeddingsTable.createdAt,
        })
        .from(faceEmbeddingsTable)
        .where(eq(faceEmbeddingsTable.personId, parsed.data.id))
        .orderBy(desc(faceEmbeddingsTable.createdAt)),
      db.select({ count: count() }).from(recognitionLogsTable).where(eq(recognitionLogsTable.personId, parsed.data.id)),
      db
        .select({ createdAt: recognitionLogsTable.createdAt })
        .from(recognitionLogsTable)
        .where(eq(recognitionLogsTable.personId, parsed.data.id))
        .orderBy(desc(recognitionLogsTable.createdAt))
        .limit(1),
    ]);

    if (!person[0]) {
      res.status(404).json({ error: "Person not found" });
      return;
    }

    res.json({
      ...person[0],
      faceCount:        faceCountResult[0]?.count ?? 0,
      faces,
      recognitionCount: recognitionCount[0]?.count ?? 0,
      lastSeenAt:       lastSeen[0]?.createdAt ?? null,
    });
  } catch (err: any) {
    console.error("GET /persons/:id error:", err);
    res.status(500).json({ error: "Failed to fetch person details", details: err?.message });
  }
});

// DELETE /persons/:id
router.delete("/:id", async (req, res) => {
  try {
    const parsed = DeletePersonParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    await db.delete(personsTable).where(eq(personsTable.id, parsed.data.id));
    invalidateRecognitionCaches();
    res.json({ success: true, id: parsed.data.id });
  } catch (err: any) {
    console.error("DELETE /persons/:id error:", err);
    res.status(500).json({ error: "Failed to delete person", details: err?.message });
  }
});

// POST /persons/:id/faces  (add additional face embedding)
router.post("/:id/faces", async (req, res) => {
  try {
    const paramsParsed = AddFaceToPersonParams.safeParse(req.params);
    const bodyParsed   = AddFaceToPersonBody.safeParse(req.body);

    if (!paramsParsed.success || !bodyParsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const person = await db
      .select()
      .from(personsTable)
      .where(eq(personsTable.id, paramsParsed.data.id))
      .limit(1);

    if (!person[0]) {
      res.status(404).json({ error: "Person not found" });
      return;
    }

    const result = await extractEmbedding(bodyParsed.data.imageBase64);
    if (!result) {
      res.status(400).json({
        error: "No face detected in the provided image",
        errorCode: "NO_FACE_DETECTED"
      });
      return;
    }

    const [embedding] = await db
      .insert(faceEmbeddingsTable)
      .values({
        personId:         paramsParsed.data.id,
        embedding:        result.embedding,
        clbpEmbedding:    result.clbpEmbedding,
        lbpEmbedding:     result.lbpEmbedding,
        hogEmbedding:     result.hogEmbedding,
        lpqEmbedding:     result.lpqEmbedding,
        dctEmbedding:     result.dctEmbedding,
        confidence:       result.qualityScore,
        qualityScore:     result.qualityScore,
        algorithmVersion: result.algorithmVersion,
      })
      .returning();

    invalidateRecognitionCaches();

    // Return without the heavy embedding arrays
    res.status(201).json({
      id:               embedding.id,
      personId:         embedding.personId,
      confidence:       embedding.confidence,
      qualityScore:     embedding.qualityScore,
      algorithmVersion: embedding.algorithmVersion,
      createdAt:        embedding.createdAt,
    });
  } catch (err: any) {
    console.error("POST /persons/:id/faces error:", err);
    res.status(500).json({ error: "Failed to add face embedding", details: err?.message });
  }
});

export default router;
