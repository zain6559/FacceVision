/**
 * FaceVision — Adaptive Threshold Engine
 * 
 * Calculates dynamic thresholds based on:
 * - Image quality
 * - Face size
 * - Lighting conditions
 * - Pose
 * - Occlusion
 * - Gallery quality
 * 
 * Instead of fixed 0.5 or 0.6, adapts to context.
 */

import type { AdaptiveThreshold, ThresholdContext, ThresholdFactor } from "../pipeline/types.js";

/**
 * Base threshold values.
 */
const BASE_THRESHOLDS = {
  default: 0.5,
  highQuality: 0.45,
  lowQuality: 0.65,
  verification: 0.6,
  identification: 0.5
};

/**
 * Factor weights for threshold adjustment.
 */
const FACTOR_WEIGHTS = {
  sharpness: 0.15,
  faceSize: 0.20,
  pose: 0.15,
  occlusion: 0.10,
  lighting: 0.15,
  galleryQuality: 0.25
};

/**
 * Adaptive Threshold Engine.
 */
export class AdaptiveThresholdEngine {
  private modelVersion: string = "1.0.0";
  private calibrationData: Map<string, CalibrationPoint[]> = new Map();

  /**
   * Calculate adaptive threshold for given context.
   */
  async calculate(context: ThresholdContext): Promise<AdaptiveThreshold> {
    const factors: ThresholdFactor[] = [];
    let totalAdjustment = 0;

    // Factor 1: Image sharpness
    const sharpnessFactor = this.calculateSharpnessFactor(context.qualityScore.sharpness);
    factors.push({
      name: "Sharpness",
      influence: FACTOR_WEIGHTS.sharpness,
      value: context.qualityScore.sharpness,
      adjustedThreshold: sharpnessFactor
    });
    totalAdjustment += sharpnessFactor * FACTOR_WEIGHTS.sharpness;

    // Factor 2: Face size
    const faceSizeFactor = this.calculateFaceSizeFactor(context.faceSize);
    factors.push({
      name: "Face Size",
      influence: FACTOR_WEIGHTS.faceSize,
      value: context.faceSize,
      adjustedThreshold: faceSizeFactor
    });
    totalAdjustment += faceSizeFactor * FACTOR_WEIGHTS.faceSize;

    // Factor 3: Lighting condition
    const lightingFactor = this.calculateLightingFactor(context.lightingCondition);
    factors.push({
      name: "Lighting",
      influence: FACTOR_WEIGHTS.lighting,
      value: lightingFactor,
      adjustedThreshold: lightingFactor
    });
    totalAdjustment += lightingFactor * FACTOR_WEIGHTS.lighting;

    // Factor 4: Pose
    const poseFactor = this.calculatePoseFactor(context.poseScore);
    factors.push({
      name: "Pose",
      influence: FACTOR_WEIGHTS.pose,
      value: context.poseScore,
      adjustedThreshold: poseFactor
    });
    totalAdjustment += poseFactor * FACTOR_WEIGHTS.pose;

    // Factor 5: Occlusion
    const occlusionFactor = this.calculateOcclusionFactor(context.occlusionLevel);
    factors.push({
      name: "Occlusion",
      influence: FACTOR_WEIGHTS.occlusion,
      value: context.occlusionLevel,
      adjustedThreshold: occlusionFactor
    });
    totalAdjustment += occlusionFactor * FACTOR_WEIGHTS.occlusion;

    // Factor 6: Gallery quality
    if (context.galleryQuality !== undefined) {
      const galleryFactor = this.calculateGalleryFactor(context.galleryQuality);
      factors.push({
        name: "Gallery Quality",
        influence: FACTOR_WEIGHTS.galleryQuality,
        value: context.galleryQuality,
        adjustedThreshold: galleryFactor
      });
      totalAdjustment += galleryFactor * FACTOR_WEIGHTS.galleryQuality;
    }

    // Calculate final threshold
    const baseThreshold = BASE_THRESHOLDS.default;
    const threshold = Math.max(0.3, Math.min(0.9, baseThreshold + totalAdjustment));

    return {
      value: Math.round(threshold * 1000) / 1000,
      factors,
      model: this.modelVersion
    };
  }

  /**
   * Calculate factor for image sharpness.
   */
  private calculateSharpnessFactor(sharpness: number): number {
    // Higher sharpness = lower threshold adjustment
    // Sharpness 0-100 maps to adjustment -0.15 to +0.15
    return ((100 - sharpness) / 100) * 0.3 - 0.15;
  }

  /**
   * Calculate factor for face size.
   */
  private calculateFaceSizeFactor(faceSize: number): number {
    // Larger face = lower threshold
    // Face size 50-300+ maps to adjustment -0.2 to +0.2
    if (faceSize >= 200) return -0.2;
    if (faceSize >= 150) return -0.1;
    if (faceSize >= 100) return 0;
    if (faceSize >= 64) return 0.1;
    return 0.2; // Too small
  }

  /**
   * Calculate factor for lighting condition.
   */
  private calculateLightingFactor(condition: "GOOD" | "MODERATE" | "POOR"): number {
    switch (condition) {
      case "GOOD": return -0.1;
      case "MODERATE": return 0;
      case "POOR": return 0.15;
    }
  }

  /**
   * Calculate factor for pose deviation.
   */
  private calculatePoseFactor(poseScore: number): number {
    // Pose score 0-1 (0 = perfect, 1 = extreme)
    // Maps to adjustment 0 to +0.2
    return poseScore * 0.2;
  }

  /**
   * Calculate factor for occlusion level.
   */
  private calculateOcclusionFactor(occlusion: number): number {
    // Occlusion 0-1 maps to adjustment 0 to +0.15
    return occlusion * 0.15;
  }

  /**
   * Calculate factor for gallery quality.
   */
  private calculateGalleryFactor(galleryQuality: number): number {
    // Gallery quality 0-100 maps to adjustment +0.15 to -0.15
    return ((100 - galleryQuality) / 100) * 0.3 - 0.15;
  }

  /**
   * Calibrate threshold engine with evaluation data.
   */
  async calibrate(
    trueMatchScores: number[],
    falseMatchScores: number[]
  ): Promise<{ optimalThreshold: number; eer: number }> {
    // Calculate Equal Error Rate (EER)
    // EER is where false acceptance rate = false rejection rate
    
    // Simplified EER calculation
    const allScores = [
      ...trueMatchScores.map(s => ({ score: s, isMatch: true })),
      ...falseMatchScores.map(s => ({ score: s, isMatch: false }))
    ].sort((a, b) => b.score - a.score);

    let far = 0; // False Acceptance Rate
    let frr = allScores.filter(s => s.isMatch).length; // False Rejection Rate
    const totalFalse = allScores.filter(s => !s.isMatch).length;
    const totalTrue = allScores.filter(s => s.isMatch).length;

    let eer = 0.5;
    let bestThreshold = 0.5;

    for (const item of allScores) {
      if (!item.isMatch) {
        far++;
      } else {
        frr--;
      }

      const currentFar = far / totalFalse;
      const currentFrr = frr / totalTrue;
      const diff = Math.abs(currentFar - currentFrr);

      if (diff < Math.abs(eer - 0.5)) {
        eer = (currentFar + currentFrr) / 2;
        bestThreshold = item.score;
      }
    }

    this.modelVersion = `1.1.0`; // Update after calibration

    return {
      optimalThreshold: Math.round(bestThreshold * 1000) / 1000,
      eer: Math.round(eer * 1000) / 1000
    };
  }

  /**
   * Record a calibration data point.
   */
  recordCalibrationPoint(
    scenario: string,
    similarity: number,
    isTrueMatch: boolean
  ): void {
    const points = this.calibrationData.get(scenario) || [];
    points.push({ similarity, isTrueMatch, timestamp: new Date() });
    this.calibrationData.set(scenario, points);
  }

  /**
   * Get calibration statistics.
   */
  getCalibrationStats(): Record<string, {
    dataPoints: number;
    trueMatches: number;
    falseMatches: number;
  }> {
    const stats: Record<string, any> = {};

    for (const [scenario, points] of this.calibrationData.entries()) {
      stats[scenario] = {
        dataPoints: points.length,
        trueMatches: points.filter(p => p.isTrueMatch).length,
        falseMatches: points.filter(p => !p.isTrueMatch).length
      };
    }

    return stats;
  }
}

interface CalibrationPoint {
  similarity: number;
  isTrueMatch: boolean;
  timestamp: Date;
}

/**
 * Factory function.
 */
export function createAdaptiveThreshold(): AdaptiveThresholdEngine {
  return new AdaptiveThresholdEngine();
}
