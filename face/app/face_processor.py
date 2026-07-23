import cv2
import numpy as np
import os
from deepface import DeepFace

class FaceProcessor:
    def __init__(self):
        # نستخدم نموذج ArcFace الدقيق جداً والذي يعطي مصفوفة من 512 بعداً لبصمة الوجه
        self.model_name = "ArcFace"
        self.detector_backend = "opencv"

    def analyze_face(self, image_path: str, actions=['age', 'gender', 'emotion']):
        """
        تحليل سمات الوجه العمر، الجنس، والتعبيرات الحالية.
        """
        try:
            results = DeepFace.analyze(
                img_path=image_path,
                actions=actions,
                enforce_detection=False,
                detector_backend=self.detector_backend
            )
            return results
        except Exception as e:
            print(f"Error in analyze_face: {e}")
            return []

    def get_embedding(self, image_path: str):
        """
        توليد بصمة وجه رياضية من 512 بعداً مع تطبيق L2-normalization لمقارنة دقيقة جداً.
        """
        try:
            embeddings_data = DeepFace.represent(
                img_path=image_path,
                model_name=self.model_name,
                enforce_detection=False,
                detector_backend=self.detector_backend
            )
            if embeddings_data and len(embeddings_data) > 0:
                emb = np.array(embeddings_data[0]["embedding"], dtype=np.float32)
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                return emb.tolist()
        except Exception as e:
            print(f"Error in get_embedding: {e}")
        return None

    def detect_faces(self, image_path: str):
        """
        اكتشاف جميع الوجوه داخل الصورة وإرجاع مواقعها وصور مقطوعة ومصطفة لكل وجه.
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                return []

            extracted = DeepFace.extract_faces(
                img_path=image_path,
                enforce_detection=False,
                detector_backend=self.detector_backend
            )

            faces = []
            for face_item in extracted:
                facial_area = face_item["facial_area"]
                x = facial_area["x"]
                y = facial_area["y"]
                w = facial_area["w"]
                h = facial_area["h"]

                crop = img[y:y+h, x:x+w]

                faces.append({
                    "box": (x, y, w, h),
                    "crop": crop,
                    "confidence": face_item.get("confidence", 1.0)
                })
            return faces
        except Exception as e:
            print(f"Error in detect_faces: {e}")
            return []

    def compute_liveness(self, image_np: np.ndarray) -> float:
        """
        حساب الحيوية للكشف عن محاولات التزييف عبر الشاشات أو الصور المطبوعة
        بناءً على تباين ترددات Laplacian والتفاصيل النسيجية الدقيقة.
        """
        try:
            if image_np is None or image_np.size == 0:
                return 0.0

            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

            if 80 <= laplacian_var <= 900:
                texture_score = 0.85 + min(0.15, (laplacian_var - 80) / 1000)
            elif laplacian_var < 80:
                texture_score = max(0.1, laplacian_var / 80.0)
            else:
                texture_score = max(0.2, 1.0 - (laplacian_var - 900) / 2000.0)

            return float(np.clip(texture_score, 0.0, 1.0))
        except Exception as e:
            print(f"Error in compute_liveness: {e}")
            return 0.5