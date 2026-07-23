/**
 * InsightFace Face Alignment Engine — 5-Point Similarity Transformation
 *
 * Implements least-squares 2D Affine Similarity Transformation to align faces
 * to the official 112×112 ArcFace / InsightFace reference landmark template.
 *
 * Reference:
 * InsightFace alignment standard:
 *   Left Eye:      [38.2946, 51.6963]
 *   Right Eye:     [73.5318, 51.5014]
 *   Nose Tip:      [56.0252, 71.7366]
 *   Left Mouth:    [41.5493, 92.3655]
 *   Right Mouth:   [70.7299, 92.2041]
 */

import sharp from "sharp";
import { Landmark5, Point2D } from "./types.js";

export const ARCFACE_REF_LANDMARKS_112: [number, number][] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

export interface AffineMatrix2D {
  a: number; // m00
  b: number; // m01
  c: number; // tx
  d: number; // m10
  e: number; // m11
  f: number; // ty
}

/**
 * Computes optimal similarity transformation (scale, rotation, translation)
 * mapping source 5-point landmarks to the ArcFace reference landmarks.
 */
export function estimateSimilarityTransform(srcLandmarks: Landmark5): AffineMatrix2D {
  const dst = ARCFACE_REF_LANDMARKS_112;
  const src = srcLandmarks.map(pt => [pt.x, pt.y]);

  let srcMeanX = 0, srcMeanY = 0;
  let dstMeanX = 0, dstMeanY = 0;

  for (let i = 0; i < 5; i++) {
    srcMeanX += src[i][0];
    srcMeanY += src[i][1];
    dstMeanX += dst[i][0];
    dstMeanY += dst[i][1];
  }

  srcMeanX /= 5;
  srcMeanY /= 5;
  dstMeanX /= 5;
  dstMeanY /= 5;

  let srcVar = 0;
  let numA = 0, numB = 0;

  for (let i = 0; i < 5; i++) {
    const rx = src[i][0] - srcMeanX;
    const ry = src[i][1] - srcMeanY;
    const dx = dst[i][0] - dstMeanX;
    const dy = dst[i][1] - dstMeanY;

    srcVar += rx * rx + ry * ry;
    numA += rx * dx + ry * dy;
    numB += rx * dy - ry * dx;
  }

  const scale = Math.sqrt(numA * numA + numB * numB) / Math.max(1e-5, srcVar);
  const angle = Math.atan2(numB, numA);

  const cos = scale * Math.cos(angle);
  const sin = scale * Math.sin(angle);

  const tx = dstMeanX - (cos * srcMeanX - sin * srcMeanY);
  const ty = dstMeanY - (sin * srcMeanX + cos * srcMeanY);

  return {
    a: cos,
    b: -sin,
    c: tx,
    d: sin,
    e: cos,
    f: ty,
  };
}

/**
 * Performs 5-point similarity transformation alignment on input image buffer
 * to output a sharp, normalized 112×112 ArcFace crop.
 */
export async function alignFaceToArcFaceStandard(
  imageBuffer: Buffer,
  landmarks: Landmark5
): Promise<Buffer> {
  const mat = estimateSimilarityTransform(landmarks);

  // Compute inverse transformation matrix for image resampling
  const det = mat.a * mat.e - mat.b * mat.d;
  const invDet = Math.abs(det) < 1e-6 ? 1 : 1 / det;

  const invA = mat.e * invDet;
  const invB = -mat.b * invDet;
  const invC = (mat.b * mat.f - mat.c * mat.e) * invDet;
  const invD = -mat.d * invDet;
  const invE = mat.a * invDet;
  const invF = (mat.c * mat.d - mat.a * mat.f) * invDet;

  const metadata = await sharp(imageBuffer).metadata();
  const imgW = metadata.width || 640;
  const imgH = metadata.height || 480;

  // Extract raw RGB pixels from source
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const srcPixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const outW = 112;
  const outH = 112;
  const outPixels = new Uint8Array(outW * outH * 3);

  // Bilinear interpolation warp affine
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcX = invA * x + invB * y + invC;
      const srcY = invD * x + invE * y + invF;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const clampX0 = Math.max(0, Math.min(imgW - 1, x0));
      const clampY0 = Math.max(0, Math.min(imgH - 1, y0));
      const x1 = Math.max(0, Math.min(imgW - 1, x0 + 1));
      const y1 = Math.max(0, Math.min(imgH - 1, y0 + 1));

      const dx = Math.max(0, Math.min(1, srcX - x0));
      const dy = Math.max(0, Math.min(1, srcY - y0));

      const outIdx = (y * outW + x) * 3;
      const idx00 = (clampY0 * imgW + clampX0) * 3;
      const idx10 = (clampY0 * imgW + x1) * 3;
      const idx01 = (y1 * imgW + clampX0) * 3;
      const idx11 = (y1 * imgW + x1) * 3;

      for (let c = 0; c < 3; c++) {
        const v00 = srcPixels[idx00 + c];
        const v10 = srcPixels[idx10 + c];
        const v01 = srcPixels[idx01 + c];
        const v11 = srcPixels[idx11 + c];

        const top = v00 * (1 - dx) + v10 * dx;
        const bottom = v01 * (1 - dx) + v11 * dx;
        const val = top * (1 - dy) + bottom * dy;

        outPixels[outIdx + c] = Math.round(Math.max(0, Math.min(255, val)));
      }
    }
  }

  // Convert raw 112x112 RGB pixels back to PNG/JPEG buffer
  return sharp(Buffer.from(outPixels.buffer), {
    raw: { width: outW, height: outH, channels: 3 },
  })
    .png()
    .toBuffer();
}
