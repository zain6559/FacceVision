/**
 * Face Intelligence — Cluster Analysis & Duplicate Detection Engine
 *
 * Implements Cosine DBSCAN clustering for discovering unknown identity groups
 * and pairwise identity distance scanning for detecting duplicate enrolled subjects.
 */

import { ClusterGroup, DuplicatePair, FaceClusterNode } from "./types.js";

export function l2NormalizeVector(v: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map(x => x / norm);
}

function cosineDistance(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 1.0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1.0;
  const sim = Math.max(-1.0, Math.min(1.0, dot / denom));
  return Math.max(0.0, Math.min(2.0, 1.0 - sim));
}

/**
 * Cosine DBSCAN Clustering Algorithm
 * Group facial embeddings into identity clusters without prior label knowledge.
 */
export function clusterFacesDBSCAN(
  nodes: FaceClusterNode[],
  eps = 0.30,          // Max cosine distance threshold for neighbors
  minSamples = 2       // Min points to form a cluster core
): ClusterGroup[] {
  const visited = new Set<number>();
  const clustered = new Set<number>();
  const clusters: ClusterGroup[] = [];
  let clusterIdCounter = 1;

  function getNeighbors(targetIdx: number): number[] {
    const neighbors: number[] = [];
    const target = nodes[targetIdx];
    for (let i = 0; i < nodes.length; i++) {
      if (i === targetIdx) continue;
      const dist = cosineDistance(target.embedding, nodes[i].embedding);
      if (dist <= eps) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < nodes.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const neighbors = getNeighbors(i);
    if (neighbors.length < minSamples - 1) continue; // Noise point for now

    // Form new cluster
    const currentCluster: number[] = [i];
    clustered.add(i);

    const seedQueue = [...neighbors];
    const seedSet = new Set<number>(seedQueue);
    let qIdx = 0;

    while (qIdx < seedQueue.length) {
      const neighborIdx = seedQueue[qIdx++];
      if (!visited.has(neighborIdx)) {
        visited.add(neighborIdx);
        const subNeighbors = getNeighbors(neighborIdx);
        if (subNeighbors.length >= minSamples - 1) {
          for (const sn of subNeighbors) {
            if (!seedSet.has(sn)) {
              seedSet.add(sn);
              seedQueue.push(sn);
            }
          }
        }
      }
      if (!clustered.has(neighborIdx)) {
        clustered.add(neighborIdx);
        currentCluster.push(neighborIdx);
      }
    }

    // Build ClusterGroup structure
    const memberNodes = currentCluster.map(idx => nodes[idx]);
    const dim = memberNodes[0].embedding.length;
    const rawCentroid = new Array(dim).fill(0);

    for (const m of memberNodes) {
      for (let d = 0; d < dim; d++) rawCentroid[d] += m.embedding[d];
    }
    for (let d = 0; d < dim; d++) rawCentroid[d] /= memberNodes.length;
    const centroid = l2NormalizeVector(rawCentroid);

    // Cohesion score (average similarity to normalized centroid)
    let sumSim = 0;
    for (const m of memberNodes) {
      sumSim += Math.max(0, 1 - cosineDistance(m.embedding, centroid));
    }
    const cohesionScore = parseFloat((sumSim / memberNodes.length).toFixed(4));

    clusters.push({
      clusterId: clusterIdCounter++,
      suggestedName: memberNodes.find(m => m.personName)?.personName || `Cluster_${clusterIdCounter - 1}`,
      memberCount: memberNodes.length,
      members: memberNodes,
      centroid,
      cohesionScore,
    });
  }

  return clusters;
}

/**
 * Scans enrolled subjects to detect potential duplicate identities.
 */
export function detectDuplicateIdentities(
  subjects: { id: number; name: string; centroidEmbedding: number[] }[],
  duplicateThreshold = 0.85
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < subjects.length; i++) {
    for (let j = i + 1; j < subjects.length; j++) {
      const subA = subjects[i];
      const subB = subjects[j];

      const dist = cosineDistance(subA.centroidEmbedding, subB.centroidEmbedding);
      const sim = Math.max(0, 1 - dist);

      if (sim >= duplicateThreshold) {
        duplicates.push({
          personA: { id: subA.id, name: subA.name },
          personB: { id: subB.id, name: subB.name },
          similarity: parseFloat(sim.toFixed(4)),
          recommendation: sim >= 0.95 ? "MERGE_REQUIRED" : "REVIEW_RECOMMENDED",
        });
      }
    }
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}
