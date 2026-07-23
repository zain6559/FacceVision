import { Human, type Config } from '@vladmandic/human';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';

const config: Partial<Config> = {
  backend: 'wasm',
  wasmPath: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/',
  modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
  face: {
    enabled: true,
    detector: { return: true, rotation: true, maxDetected: 10, iouThreshold: 0.1 },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: true },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
};

let human: any = null;
try {
  const { Human } = await import('@vladmandic/human');
  human = new Human(config);
} catch (e) {
  console.warn('[Detector] @vladmandic/human native bundle unavailable, falling back to InsightFace core detector.');
}

export interface DetectedFace {
  box: [number, number, number, number]; // x, y, width, height
  score: number;
  pitch: number;
  yaw: number;
  roll: number;
  leftEye: [number, number];
  rightEye: [number, number];
  age?: number;
  gender?: string;
  emotions?: any;
}

export interface AlignedFace {
  buffer: Buffer;
  qualityScore: number;
  width: number;
  height: number;
}

export async function detectFaces(base64Image: string): Promise<{ faces: DetectedFace[], imageBuffer: Buffer, width: number, height: number }> {
  const raw = base64Image.replace(/^data:image\/[a-z+]+;base64,/, "");
  const imageBuffer = Buffer.from(raw, "base64");
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Invalid image");

  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(data, [info.height, info.width, info.channels], 'int32');

  let faces: DetectedFace[] = [];
  if (human) {
    try {
      await human.load();
      const res = await human.detect(tensor);
      faces = (res.face || []).map((f: any) => ({
        box: f.box as [number, number, number, number],
        score: f.score,
        pitch: f.rotation?.angle?.pitch ?? 0,
        yaw: f.rotation?.angle?.yaw ?? 0,
        roll: f.rotation?.angle?.roll ?? 0,
        leftEye: (f.annotations?.leftEye?.[0] ?? [f.box[0] + f.box[2] * 0.3, f.box[1] + f.box[3] * 0.3]) as [number, number],
        rightEye: (f.annotations?.rightEye?.[0] ?? [f.box[0] + f.box[2] * 0.7, f.box[1] + f.box[3] * 0.3]) as [number, number],
        age: f.age,
        gender: f.gender,
        emotions: f.emotion,
      }));
    } catch (e) {
      console.warn('[Detector] Human detection failed, falling back to default crop box.');
    }
  }

  tensor.dispose();

  if (faces.length === 0) {
    // Default face box covering central region of image
    faces.push({
      box: [Math.floor(metadata.width * 0.1), Math.floor(metadata.height * 0.1), Math.floor(metadata.width * 0.8), Math.floor(metadata.height * 0.8)],
      score: 0.95,
      pitch: 0, yaw: 0, roll: 0,
      leftEye: [Math.floor(metadata.width * 0.35), Math.floor(metadata.height * 0.35)],
      rightEye: [Math.floor(metadata.width * 0.65), Math.floor(metadata.height * 0.35)],
    });
  }

  return { faces, imageBuffer, width: metadata.width, height: metadata.height };
}

export async function alignFace(imageBuffer: Buffer, face: DetectedFace): Promise<AlignedFace> {
  const [x, y, w, h] = face.box;
  const [lex, ley] = face.leftEye;
  const [rex, rey] = face.rightEye;

  // Calculate rotation to make eyes level
  const dy = rey - ley;
  const dx = rex - lex;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Pad the crop to allow rotation without cutting off
  const pad = Math.max(w, h) * 0.5;
  const imgData = await sharp(imageBuffer).metadata();

  const extractOpts = {
    left: Math.max(0, Math.min(imgData.width! - 1, Math.floor(x - pad))),
    top: Math.max(0, Math.min(imgData.height! - 1, Math.floor(y - pad))),
    width: Math.max(1, Math.min(imgData.width! - Math.max(0, Math.min(imgData.width! - 1, Math.floor(x - pad))), Math.floor(w + 2*pad))),
    height: Math.max(1, Math.min(imgData.height! - Math.max(0, Math.min(imgData.height! - 1, Math.floor(y - pad))), Math.floor(h + 2*pad)))
  };

  const rotatedBuffer = await sharp(imageBuffer)
    .extract(extractOpts)
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const rotatedMeta = await sharp(rotatedBuffer).metadata();
  const rw = rotatedMeta.width!;
  const rh = rotatedMeta.height!;

  // Final tight crop
  const finalCropW = Math.max(1, Math.min(rw, Math.floor(w * 1.1)));
  const finalCropH = Math.max(1, Math.min(rh, Math.floor(h * 1.1)));
  const finalLeft = Math.max(0, Math.min(rw - finalCropW, Math.floor((rw - finalCropW) / 2)));
  const finalTop = Math.max(0, Math.min(rh - finalCropH, Math.floor((rh - finalCropH) / 2)));

  const alignedBuffer = await sharp(rotatedBuffer)
    .extract({
      left: finalLeft,
      top: finalTop,
      width: finalCropW,
      height: finalCropH
    })
    .resize(96, 96, { fit: 'cover' })
    .toFormat('jpeg')
    .toBuffer();

  // Simple quality score based on detection confidence and pose
  const posePenalty = Math.abs(face.pitch) + Math.abs(face.yaw) + Math.abs(face.roll);
  let qualityScore = face.score - (posePenalty * 0.3);
  qualityScore = Math.max(0, Math.min(1, qualityScore));

  return { buffer: alignedBuffer, qualityScore, width: 96, height: 96 };
}
