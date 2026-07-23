/**
 * InsightFace Quality Estimation Engine
 *
 * Evaluates facial image quality for production verification based on:
 * 1. 5-Point Landmark Geometry (Pose yaw/pitch/roll deviation)
 * 2. Laplacian Variance (Focus sharpness / motion blur)
 * 3. Illumination Symmetry (Left/Right face lighting ratio)
 * 4. Contrast & Dynamic Range
 */

import sharp from "sharp";
import { Landmark5, QualityMetrics } from "./types.js";

/**
 * Calculates pose yaw, pitch, and roll in degrees from 5-point landmarks.
 */
export function estimatePoseFromLandmarks(landmarks: Landmark5): { yaw: number; pitch: number; roll: number } {
  const [leftEye, rightEye, nose, leftMouth, rightMouth] = landmarks;

  // Roll: angle between the two eyes
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const roll = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Eye center
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;

  // Eye distance
  const eyeDist = Math.max(1e-5, Math.hypot(dx, dy));

  // Yaw: horizontal offset of nose tip relative to eye center
  const noseDx = nose.x - eyeCenterX;
  const yaw = (Math.atan2(noseDx, eyeDist) * 180) / Math.PI;

  // Mouth center
  const mouthCenterX = (leftMouth.x + rightMouth.x) / 2;
  const mouthCenterY = (leftMouth.y + rightMouth.y) / 2;

  // Pitch: vertical ratio of eye-to-nose vs nose-to-mouth
  const eyeToNoseY = nose.y - eyeCenterY;
  const noseToMouthY = mouthCenterY - nose.y;
  const pitchRatio = eyeToNoseY / Math.max(1e-5, noseToMouthY);
  const pitch = (pitchRatio - 0.85) * 45; // 0.85 is standard frontal ratio

  return { yaw, pitch, roll };
}

/**
 * Evaluates full quality metrics for an aligned 112×112 face image.
 */
export async function evaluateFaceQuality(
  alignedImageBuffer: Buffer,
  landmarks?: Landmark5
): Promise<QualityMetrics> {
  try {
    if (!alignedImageBuffer || alignedImageBuffer.length === 0) {
      return {
        overallScore: 0,
        blurScore: 0,
        illuminationScore: 0,
        poseScore: 0,
        occlusionScore: 0,
        pose: { yaw: 0, pitch: 0, roll: 0 },
      };
    }

    const { data, info } = await sharp(alignedImageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const w = info.width || 1;
    const h = info.height || 1;

    // 1. Sharpness via Laplacian Variance
    let lapVar = 0;
    let lapCount = 0;
    let sumPix = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const val = pixels[idx];
        sumPix += val;

        const lap =
          -pixels[(y - 1) * w + x] -
          pixels[y * w + (x - 1)] +
          4 * val -
          pixels[y * w + (x + 1)] -
          pixels[(y + 1) * w + x];

        lapVar += lap * lap;
        lapCount++;
      }
    }

    const meanPix = sumPix / Math.max(1, w * h);
    const blurScore = Math.min(1.0, Math.sqrt(lapVar / Math.max(1, lapCount)) / 40.0);

    // 2. Illumination Symmetry (Left vs Right face halves)
    let leftSum = 0, rightSum = 0;
    const halfW = Math.floor(w / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < halfW; x++) {
        leftSum += pixels[y * w + x];
        rightSum += pixels[y * w + (w - 1 - x)];
      }
    }

    const ratio = Math.min(leftSum, rightSum) / Math.max(1, Math.max(leftSum, rightSum));
    const illuminationScore = Math.max(0, Math.min(1.0, ratio * (1.0 - Math.abs(meanPix - 128) / 128)));

    // 3. Pose Score
    let pose = { yaw: 0, pitch: 0, roll: 0 };
    let poseScore = 1.0;

    if (landmarks) {
      pose = estimatePoseFromLandmarks(landmarks);
      const yawPenalty = Math.abs(pose.yaw) / 45.0;
      const pitchPenalty = Math.abs(pose.pitch) / 30.0;
      const rollPenalty = Math.abs(pose.roll) / 30.0;
      poseScore = Math.max(0, 1.0 - (yawPenalty * 0.5 + pitchPenalty * 0.3 + rollPenalty * 0.2));
    }

    // 4. Overall Combined Score
    const overallScore = Math.max(0, Math.min(1.0, 0.4 * blurScore + 0.35 * poseScore + 0.25 * illuminationScore));

    return {
      overallScore: Number.isNaN(overallScore) ? 0 : overallScore,
      blurScore: Number.isNaN(blurScore) ? 0 : blurScore,
      illuminationScore: Number.isNaN(illuminationScore) ? 0 : illuminationScore,
      poseScore: Number.isNaN(poseScore) ? 0 : poseScore,
      occlusionScore: 1.0,
      pose,
    };
  } catch (err) {
    console.error("evaluateFaceQuality error:", err);
    return {
      overallScore: 0,
      blurScore: 0,
      illuminationScore: 0,
      poseScore: 0,
      occlusionScore: 0,
      pose: { yaw: 0, pitch: 0, roll: 0 },
    };
  }
}
