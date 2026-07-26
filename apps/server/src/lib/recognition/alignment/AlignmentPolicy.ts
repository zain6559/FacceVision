/**
 * FaceVision — Alignment Policy
 * 
 * Makes alignment optional based on:
 * - Model requirements (ArcFace needs it, some don't)
 * - Face pose
 * - Quality
 * 
 * Instead of forcing alignment, this makes it a decision.
 */

import type { Landmark5 } from "../pipeline/types.js";
import type { QualityScore } from "../../ingestion/pipeline/types.js";

/**
 * Alignment requirements by model.
 */
const MODEL_ALIGNMENT_REQUIREMENTS: Record<string, {
  required: boolean;
  method: "AFFINE" | "SIMILARITY";
  targetSize: [number, number];
}> = {
  "arcface": {
    required: true,
    method: "AFFINE",
    targetSize: [112, 112]
  },
  "adaface": {
    required: false,
    method: "SIMILARITY",
    targetSize: [112, 112]
  },
  "magface": {
    required: false,
    method: "SIMILARITY",
    targetSize: [112, 112]
  },
  "elasticface": {
    required: false,
    method: "SIMILARITY",
    targetSize: [112, 112]
  },
  "facenet": {
    required: false,
    method: "SIMILARITY",
    targetSize: [160, 160]
  }
};

/**
 * Alignment Policy - Decides when and how to align faces.
 */
export class AlignmentPolicy {
  private currentModel: string = "arcface";

  /**
   * Set the current recognition model.
   */
  setModel(model: string): void {
    this.currentModel = model;
  }

  /**
   * Check if alignment is needed based on policy.
   */
  needsAlignment(
    landmarks?: Landmark5,
    quality?: QualityScore
  ): boolean {
    const modelReqs = MODEL_ALIGNMENT_REQUIREMENTS[this.currentModel] || {
      required: true,
      method: "AFFINE" as const,
      targetSize: [112, 112] as [number, number]
    };

    // If model requires alignment, do it
    if (modelReqs.required) {
      return true;
    }

    // Check face pose - if extreme, align anyway
    if (quality?.pose) {
      if (Math.abs(quality.pose.yaw) > 15 || 
          Math.abs(quality.pose.pitch) > 15 || 
          Math.abs(quality.pose.roll) > 10) {
        return true;
      }
    }

    // Check landmark availability
    if (!landmarks) {
      return true;
    }

    // Check if landmarks are valid
    const validLandmarks = landmarks.every(lm => 
      lm.x > 0 && lm.y > 0 && !isNaN(lm.x) && !isNaN(lm.y)
    );

    if (!validLandmarks) {
      return true;
    }

    // Default: no alignment needed
    return false;
  }

  /**
   * Get alignment parameters for current model.
   */
  getAlignmentParams(): {
    method: "AFFINE" | "SIMILARITY";
    targetSize: [number, number];
  } {
    const modelReqs = MODEL_ALIGNMENT_REQUIREMENTS[this.currentModel] || {
      method: "AFFINE" as const,
      targetSize: [112, 112] as [number, number]
    };

    return {
      method: modelReqs.method,
      targetSize: modelReqs.targetSize
    };
  }

  /**
   * Calculate alignment transformation matrix.
   */
  calculateTransformation(
    landmarks: Landmark5,
    targetSize: [number, number]
  ): {
    matrix: number[][];
    output: Buffer;
  } {
    // Simplified similarity transform using eye centers
    const leftEye = landmarks[0];
    const rightEye = landmarks[1];
    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + 
      Math.pow(rightEye.y - leftEye.y, 2)
    );

    const targetEyeDistance = targetSize[0] * 0.4; // 40% of width
    const scale = targetEyeDistance / eyeDistance;

    // Center of face
    const faceCenterX = (leftEye.x + rightEye.x) / 2;
    const faceCenterY = (leftEye.y + rightEye.y) / 2;

    // Target center
    const targetCenterX = targetSize[0] / 2;
    const targetCenterY = targetSize[1] / 2;

    // Transformation matrix (simplified)
    const matrix = [
      [scale, 0, targetCenterX - scale * faceCenterX],
      [0, scale, targetCenterY - scale * faceCenterY],
      [0, 0, 1]
    ];

    return {
      matrix,
      output: Buffer.alloc(targetSize[0] * targetSize[1] * 3) // RGB
    };
  }

  /**
   * Get supported models and their alignment requirements.
   */
  getModelRequirements(): Record<string, {
    required: boolean;
    method: string;
    targetSize: [number, number];
  }> {
    return { ...MODEL_ALIGNMENT_REQUIREMENTS };
  }
}

/**
 * Factory function.
 */
export function createAlignmentPolicy(): AlignmentPolicy {
  return new AlignmentPolicy();
}
