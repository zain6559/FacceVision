import { db, faceEmbeddingsTable, personsTable } from "@workspace/db";
import { cosineSimilarity } from "./faceRecognition.js";

interface ScorePair {
  score: number;
  isSame: boolean;
}

export async function runInternalBenchmark() {
  const embeddings = await db.select().from(faceEmbeddingsTable);

  const pairs: ScorePair[] = [];

  // Generate pairs for False Acceptance Rate (FAR) and False Rejection Rate (FRR)
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const a = embeddings[i];
      const b = embeddings[j];

      const isSame = a.personId === b.personId;
      const sim = cosineSimilarity(a.embedding as number[], b.embedding as number[]);
      pairs.push({ score: sim, isSame });
    }
  }

  // Calculate EER, Precision, Recall at different thresholds
  const thresholds = [0.4, 0.45, 0.5, 0.52, 0.55, 0.6];
  const results = thresholds.map(t => {
    let tp = 0, fp = 0, tn = 0, fn = 0;

    pairs.forEach(p => {
      const pred = p.score >= t;
      if (pred && p.isSame) tp++;
      else if (pred && !p.isSame) fp++;
      else if (!pred && !p.isSame) tn++;
      else if (!pred && p.isSame) fn++;
    });

    const far = fp / (fp + tn || 1);
    const frr = fn / (fn + tp || 1);
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const accuracy = (tp + tn) / pairs.length;

    return { threshold: t, far, frr, precision, recall, accuracy };
  });

  // Find EER (where FAR ≈ FRR)
  let eerIdx = 0;
  let minDiff = Infinity;
  results.forEach((r, idx) => {
    const diff = Math.abs(r.far - r.frr);
    if (diff < minDiff) {
      minDiff = diff;
      eerIdx = idx;
    }
  });

  return {
    totalPairs: pairs.length,
    results,
    eerEstimate: results[eerIdx]
  };
}
