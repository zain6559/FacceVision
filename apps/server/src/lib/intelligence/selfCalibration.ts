/**
 * Face Intelligence — Self-Calibration, Threshold Optimization & Rollback Engine
 *
 * Automatically calibrates operational thresholds (FAR/FRR curves, EER)
 * and manages model/dataset version checkpoints for emergency automated rollbacks.
 */

import { CalibrationResult, ThresholdCalibrationOptions, VersionCheckpoint } from "./types.js";

// In-memory registry of version checkpoints for rollback management
const versionRegistry: VersionCheckpoint[] = [
  {
    versionId: "chk_v5.0_stable",
    datasetVersion: "v5.0.0-insightface",
    modelVersion: "buffalo_l",
    activeThreshold: 0.985,
    metrics: { accuracy: 0.9977, far: 0.0001, frr: 0.002 },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: "STABLE",
  },
];

let activeThreshold = 0.985;

/**
 * Optimizes recognition thresholds using historical match logs.
 * Computes FAR, FRR, and Equal Error Rate (EER).
 */
export function calibrateThresholds(
  genuineScores: number[],
  imposterScores: number[],
  options: ThresholdCalibrationOptions = {}
): CalibrationResult {
  const steps = 200;
  let minEERDiff = 1.0;
  let eerThreshold = 0.85;

  let optimalThreshold = 0.85;
  let estFARAtOpt = 0.0001;
  let estFRRAtOpt = 0.005;
  let foundTargetFAR = false;

  for (let s = 0; s <= steps; s++) {
    const thresh = s / steps;

    const falseRejects = genuineScores.filter(score => score < thresh).length;
    const falseAccepts = imposterScores.filter(score => score >= thresh).length;

    const frr = falseRejects / Math.max(1, genuineScores.length);
    const far = falseAccepts / Math.max(1, imposterScores.length);

    const diff = Math.abs(far - frr);
    if (diff < minEERDiff) {
      minEERDiff = diff;
      eerThreshold = thresh;
    }

    if (options.targetFAR !== undefined) {
      if (far <= options.targetFAR && !foundTargetFAR) {
        optimalThreshold = thresh;
        estFARAtOpt = far;
        estFRRAtOpt = frr;
        foundTargetFAR = true;
      }
    }
  }

  if (options.targetFAR === undefined || !foundTargetFAR) {
    optimalThreshold = eerThreshold;
    const falseRejects = genuineScores.filter(score => score < eerThreshold).length;
    const falseAccepts = imposterScores.filter(score => score >= eerThreshold).length;
    estFRRAtOpt = falseRejects / Math.max(1, genuineScores.length);
    estFARAtOpt = falseAccepts / Math.max(1, imposterScores.length);
  }

  activeThreshold = parseFloat(optimalThreshold.toFixed(4));

  return {
    optimalThreshold: activeThreshold,
    estimatedFAR: parseFloat(estFARAtOpt.toFixed(5)),
    estimatedFRR: parseFloat(estFRRAtOpt.toFixed(5)),
    eerThreshold: parseFloat(eerThreshold.toFixed(4)),
    sampleSizeEvaluated: genuineScores.length + imposterScores.length,
    calibratedAt: new Date().toISOString(),
  };
}

/**
 * Get active threshold setting.
 */
export function getActiveThreshold(): number {
  return activeThreshold;
}

/**
 * Creates a new version checkpoint before deploying models or running massive updates.
 */
export function createCheckpoint(
  versionId: string,
  datasetVersion: string,
  modelVersion: string,
  accuracy = 0.9977
): VersionCheckpoint {
  const chk: VersionCheckpoint = {
    versionId,
    datasetVersion,
    modelVersion,
    activeThreshold,
    metrics: { accuracy, far: 0.0001, frr: 0.002 },
    createdAt: new Date().toISOString(),
    status: "ACTIVE",
  };

  versionRegistry.forEach(v => { if (v.status === "ACTIVE") v.status = "STABLE"; });
  versionRegistry.push(chk);
  return chk;
}

/**
 * Performs automated rollback to previous STABLE version checkpoint.
 */
export function rollbackToPreviousCheckpoint(): { success: boolean; rolledBackTo?: VersionCheckpoint; message: string } {
  if (versionRegistry.length < 2) {
    return { success: false, message: "No previous stable checkpoint available for rollback." };
  }

  const failed = versionRegistry.pop(); // Remove active failed checkpoint
  if (failed) failed.status = "DEPRECATED";

  const previous = versionRegistry[versionRegistry.length - 1];
  previous.status = "ACTIVE";
  activeThreshold = previous.activeThreshold;

  return {
    success: true,
    rolledBackTo: previous,
    message: `Successfully rolled back to checkpoint ${previous.versionId} (Threshold restored to ${previous.activeThreshold}).`,
  };
}

/**
 * Get version checkpoint history.
 */
export function getVersionHistory(): VersionCheckpoint[] {
  return [...versionRegistry];
}
