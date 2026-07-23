/**
 * FaceVision — Real Learning Pipeline v4
 *
 * Downloads genuine portrait photographs from Wikimedia Commons via the
 * Wikipedia API (Creative Commons / public domain images).
 *
 * For each person:
 *   1. Query Wikipedia pageimages API for a portrait thumbnail URL
 *   2. Fetch the actual JPEG/PNG photograph
 *   3. Extract 5-algorithm embeddings (CLBP + MSLBPH + Gabor + LPQ + WLD)
 *   4. Upsert person and embedding records in the database
 *
 * API reference: https://www.mediawiki.org/wiki/API:Pageimages
 */

import { db, learningRunsTable, personsTable, faceEmbeddingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractEmbedding } from "./faceRecognition.js";

let _isRunning = false;
export function isLearningRunning(): boolean { return _isRunning; }

// ─── Curated Person List ───────────────────────────────────────────────────────
interface PersonEntry { name: string; wiki: string; nameAr?: string }

const LFW_PERSONS: PersonEntry[] = [
  { name: "George W. Bush",   wiki: "George_W._Bush",          nameAr: "جورج دبليو بوش" },
  { name: "Colin Powell",     wiki: "Colin_Powell",             nameAr: "كولن باول" },
  { name: "Tony Blair",       wiki: "Tony_Blair",               nameAr: "توني بلير" },
  { name: "Gerhard Schröder", wiki: "Gerhard_Schröder",         nameAr: "غيرهارد شرودر" },
  { name: "Hugo Chávez",      wiki: "Hugo_Chávez",              nameAr: "هوغو شافيز" },
  { name: "Ariel Sharon",     wiki: "Ariel_Sharon",             nameAr: "أرييل شارون" },
  { name: "Jacques Chirac",   wiki: "Jacques_Chirac",           nameAr: "جاك شيراك" },
  { name: "Vladimir Putin",   wiki: "Vladimir_Putin",           nameAr: "فلاديمير بوتين" },
  { name: "John Ashcroft",    wiki: "John_Ashcroft",            nameAr: "جون أشكروفت" },
  { name: "Winona Ryder",     wiki: "Winona_Ryder",             nameAr: "وينونا رايدر" },
  { name: "Tiger Woods",      wiki: "Tiger_Woods",              nameAr: "تايغر وودز" },
  { name: "Serena Williams",  wiki: "Serena_Williams",          nameAr: "سيرينا ويليامز" },
  { name: "David Beckham",    wiki: "David_Beckham",            nameAr: "ديفيد بيكهام" },
  { name: "Jennifer Aniston", wiki: "Jennifer_Aniston",         nameAr: "جينيفر أنيستون" },
];

const VGG_PERSONS: PersonEntry[] = [
  { name: "Elon Musk",          wiki: "Elon_Musk",             nameAr: "إيلون ماسك" },
  { name: "Jeff Bezos",         wiki: "Jeff_Bezos",            nameAr: "جيف بيزوس" },
  { name: "Mark Zuckerberg",    wiki: "Mark_Zuckerberg",       nameAr: "مارك زوكربيرغ" },
  { name: "Sundar Pichai",      wiki: "Sundar_Pichai",         nameAr: "سوندار بيتشاي" },
  { name: "Satya Nadella",      wiki: "Satya_Nadella",         nameAr: "ساتيا ناديلا" },
  { name: "Tim Cook",           wiki: "Tim_Cook",              nameAr: "تيم كوك" },
  { name: "Barack Obama",       wiki: "Barack_Obama",          nameAr: "باراك أوباما" },
  { name: "Angela Merkel",      wiki: "Angela_Merkel",         nameAr: "أنغيلا ميركل" },
  { name: "Emmanuel Macron",    wiki: "Emmanuel_Macron",       nameAr: "إيمانويل ماكرون" },
  { name: "Cristiano Ronaldo",  wiki: "Cristiano_Ronaldo",     nameAr: "كريستيانو رونالدو" },
  { name: "Lionel Messi",       wiki: "Lionel_Messi",          nameAr: "ليونيل ميسي" },
  { name: "Roger Federer",      wiki: "Roger_Federer",         nameAr: "روجر فيدرر" },
  { name: "Novak Djokovic",     wiki: "Novak_Djokovic",        nameAr: "نوفاك ديوكوفيتش" },
  { name: "Rihanna",            wiki: "Rihanna",               nameAr: "ريهانا" },
];

const SCIENCE_PERSONS: PersonEntry[] = [
  { name: "Albert Einstein",    wiki: "Albert_Einstein",       nameAr: "ألبرت أينشتاين" },
  { name: "Marie Curie",        wiki: "Marie_Curie",           nameAr: "ماري كوري" },
  { name: "Isaac Newton",       wiki: "Isaac_Newton",          nameAr: "إسحاق نيوتن" },
  { name: "Charles Darwin",     wiki: "Charles_Darwin",        nameAr: "تشارلز داروين" },
  { name: "Nikola Tesla",       wiki: "Nikola_Tesla",          nameAr: "نيكولا تيسلا" },
  { name: "Stephen Hawking",    wiki: "Stephen_Hawking",       nameAr: "ستيفن هوكينغ" },
  { name: "Neil deGrasse Tyson",wiki: "Neil_deGrasse_Tyson",  nameAr: "نيل دي غراس تايسون" },
  { name: "Jane Goodall",       wiki: "Jane_Goodall",          nameAr: "جين غودال" },
  { name: "Richard Feynman",    wiki: "Richard_Feynman",       nameAr: "ريتشارد فاينمان" },
  { name: "Carl Sagan",         wiki: "Carl_Sagan",            nameAr: "كارل ساغان" },
  { name: "Niels Bohr",         wiki: "Niels_Bohr",            nameAr: "نيلز بور" },
  { name: "Werner Heisenberg",  wiki: "Werner_Heisenberg",     nameAr: "فيرنر هايزنبرغ" },
  { name: "Lise Meitner",       wiki: "Lise_Meitner",          nameAr: "ليز ميتنر" },
  { name: "Alan Turing",        wiki: "Alan_Turing",           nameAr: "آلان تورينغ" },
  { name: "Ada Lovelace",       wiki: "Ada_Lovelace",          nameAr: "آدا لافليس" },
  { name: "Max Planck",         wiki: "Max_Planck",            nameAr: "ماكس بلانك" },
  { name: "Paul Dirac",         wiki: "Paul_Dirac",            nameAr: "بول ديراك" },
  { name: "Ernest Rutherford",  wiki: "Ernest_Rutherford",     nameAr: "إرنست رذرفورد" },
  { name: "Louis Pasteur",      wiki: "Louis_Pasteur",         nameAr: "لويس باستور" },
  { name: "Erwin Schrödinger",  wiki: "Erwin_Schrödinger",     nameAr: "إرفين شرودينغر" },
];

export const SOURCE_MAP: Record<string, PersonEntry[]> = {
  lfw:      LFW_PERSONS,
  vggface2: VGG_PERSONS,
  web:      SCIENCE_PERSONS,
  all:      [...LFW_PERSONS, ...VGG_PERSONS, ...SCIENCE_PERSONS],
};

// ─── Wikipedia API ─────────────────────────────────────────────────────────────
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const UA       = "FaceVisionResearch/4.0 (academic; contact@facevision.ai)";

async function fetchWikipediaImage(wikiTitle: string): Promise<string | null> {
  try {
    const url = `${WIKI_API}?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=500&redirects=1`;
    const res  = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data: any  = await res.json();
    const pages = data?.query?.pages ?? {};
    const page  = Object.values(pages)[0] as any;
    return page?.thumbnail?.source ?? null;
  } catch { return null; }
}

async function imageUrlToBase64(imageUrl: string): Promise<string | null> {
  try {
    const res  = await fetch(imageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf  = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch { return null; }
}

async function updateRun(runId: number, update: Partial<{
  status: string; facesAdded: number; personsAdded: number;
  errorMessage: string; completedAt: Date;
}>) {
  await db.update(learningRunsTable).set(update).where(eq(learningRunsTable.id, runId));
}

// ─── Core Pipeline ─────────────────────────────────────────────────────────────
export async function runLearningPipeline(
  runId: number, source: string, maxImages: number,
): Promise<void> {
  if (_isRunning) {
    await updateRun(runId, { status: "failed", errorMessage: "Another run is active", completedAt: new Date() });
    return;
  }
  _isRunning = true;

  let facesAdded = 0, personsAdded = 0;
  try {
    await updateRun(runId, { status: "running" });
    const persons = SOURCE_MAP[source] ?? SOURCE_MAP.all;
    const limit   = Math.min(maxImages, persons.length);

    for (const entry of persons.slice(0, limit)) {
      try {
        const thumbUrl = await fetchWikipediaImage(entry.wiki);
        if (!thumbUrl) continue;

        const base64 = await imageUrlToBase64(thumbUrl);
        if (!base64) continue;

        const result = await extractEmbedding(base64);
        if (!result) continue;

        // Upsert person
        const existing = await db
          .select({ id: personsTable.id })
          .from(personsTable)
          .where(eq(personsTable.name, entry.name))
          .limit(1);

        let personId: number;
        if (existing.length > 0) {
          personId = existing[0].id;
        } else {
          const [p] = await db
            .insert(personsTable)
            .values({
              name:         entry.name,
              nameAr:       entry.nameAr ?? null,
              source:       source === "all" ? "mixed" : source,
              thumbnailUrl: thumbUrl,
            })
            .returning();
          personId = p.id;
          personsAdded++;
        }

        // Store full v4 embedding with all 5 sub-embeddings
        await db.insert(faceEmbeddingsTable).values({
          personId,
          embedding:        result.embedding,
          clbpEmbedding:    result.clbpEmbedding,
          lbpEmbedding:     result.lbpEmbedding,
          hogEmbedding:     result.hogEmbedding,
          lpqEmbedding:     result.lpqEmbedding,
          dctEmbedding:     result.dctEmbedding,
          confidence:       result.qualityScore,
          qualityScore:     result.qualityScore,
          algorithmVersion: result.algorithmVersion,
          imageUrl:         thumbUrl,
        });
        facesAdded++;

        if (facesAdded % 3 === 0) await updateRun(runId, { facesAdded, personsAdded });

        // Rate-limit: 500ms between Wikipedia requests
        await new Promise(r => setTimeout(r, 500));
      } catch { /* non-fatal per-person error */ }
    }

    await updateRun(runId, { status: "completed", facesAdded, personsAdded, completedAt: new Date() });
  } catch (err: any) {
    await updateRun(runId, { status: "failed", errorMessage: err?.message ?? "Unknown error", completedAt: new Date() });
  } finally {
    _isRunning = false;
  }
}

/** Schedule daily learning at midnight (re-schedules itself) */
export function scheduleDailyLearning(): void {
  const now      = new Date();
  const midnight = new Date();
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const [run] = await db
        .insert(learningRunsTable)
        .values({ source: "all", status: "pending", facesAdded: 0, personsAdded: 0, maxImages: 48 })
        .returning();
      await runLearningPipeline(run.id, "all", 48);
    } catch {}
    scheduleDailyLearning();
  }, ms);
}
