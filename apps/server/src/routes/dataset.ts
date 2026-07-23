import { Router } from "express";
import { db, personsTable, faceEmbeddingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /dataset/duplicates ──────────────────────────────────────────────────
// Finds potentially duplicated faces (similarity > 0.98) assigned to different persons
router.get("/duplicates", async (_req, res) => {
  try {
    const query = sql`
      SELECT
        a.id as face1_id, b.id as face2_id,
        a.person_id as person1_id, b.person_id as person2_id,
        (1 - (a.embedding <=> b.embedding)) as similarity
      FROM face_embeddings a
      JOIN face_embeddings b ON a.id < b.id
      WHERE (1 - (a.embedding <=> b.embedding)) > 0.98
        AND a.person_id != b.person_id
      LIMIT 100;
    `;
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /dataset/export ──────────────────────────────────────────────────────
router.get("/export", async (_req, res) => {
  try {
    const persons = await db.select().from(personsTable);
    const embeddings = await db.select().from(faceEmbeddingsTable);

    res.attachment("dataset_export.json");
    res.json({ persons, embeddings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /dataset/import ─────────────────────────────────────────────────────
router.post("/import", async (req, res) => {
  // Requires body-parser for large JSON
  try {
    const { persons, embeddings } = req.body;
    if (!persons || !embeddings) {
      res.status(400).json({ error: "Missing persons or embeddings array" });
      return;
    }
    // Simplistic import - in reality, handle transactions and conflicts
    await db.transaction(async (tx) => {
      if (persons.length) await tx.insert(personsTable).values(persons).onConflictDoNothing();
      if (embeddings.length) await tx.insert(faceEmbeddingsTable).values(embeddings).onConflictDoNothing();
    });
    res.json({ success: true, importedPersons: persons.length, importedEmbeddings: embeddings.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
