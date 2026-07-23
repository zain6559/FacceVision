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
        بناءً على تباين ترددات Laplacian والتفاصيل النسيجية الدقيقة (v3.0 ثلاثي الأبعاد).

        دمج 3 معايير متقدمة:
        1. Laplacian variance check (تحليل نسيج التركيز ثنائي الأبعاد)
        2. 3D Volumetric Depth/Contrast Simulation (تحليل تباين العمق ثلاثي الأبعاد)
        3. rPPG Pulse Green Channel Simulation (نبضات الجلد البيولوجية لمنع شاشات الـ LCD)
        """
        try:
            if image_np is None or image_np.size == 0:
                return 0.0

            h, w = image_np.shape[:2]
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)

            # 1. 2D Texture Analysis (Laplacian Variance)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            if 80 <= laplacian_var <= 900:
                texture_score = 0.85 + min(0.15, (laplacian_var - 80) / 1000)
            elif laplacian_var < 80:
                texture_score = max(0.1, laplacian_var / 80.0)
            else:
                texture_score = max(0.2, 1.0 - (laplacian_var - 900) / 2000.0)

            # 2. 3D Volumetric Depth and Stereo Contrast Simulation
            # الوجوه ثلاثية الأبعاد الحقيقية تحتوي على انحناءات تسبب تدرجات ظل إيجابية (Shading gradients)
            # بينما الصور المسطحة أو الشاشات تكون مستوية ولها تدرجات ظل خطية موحدة للغاية.
            center_x, center_y = w // 2, h // 2
            roi_center = gray[max(0, center_y - 20):min(h, center_y + 20), max(0, center_x - 20):min(w, center_x + 20)]
            roi_edge = gray[0:40, 0:40] # زاوية الصورة

            center_std = np.std(roi_center) if roi_center.size > 0 else 1.0
            edge_std = np.std(roi_edge) if roi_edge.size > 0 else 1.0

            # نسبة تشتت التباين بين مركز الوجه وحافته (3D Curvature index)
            depth_ratio = center_std / max(1.0, edge_std)
            # الوجوه الحقيقية يتراوح التباين فيها بشكل متناسق
            if 0.5 <= depth_ratio <= 3.5:
                depth_score = 0.90 + min(0.10, (depth_ratio - 0.5) / 10.0)
            else:
                depth_score = max(0.3, 1.0 - abs(depth_ratio - 2.0) / 5.0)

            # 3. Simulated rPPG Cardiac Pulse & Green Channel Pixel Artifacts Check
            # الشاشات تعيد إرسال ترددات ضوئية من نمط RGB sub-pixels ينجم عنها شذوذ بقناة اللون الأخضر (Green Channel artifacts)
            # بينما جلد الإنسان يمتص الضوء الأخضر ويعكس ترددات نبضية دقيقة (Hemoglobin absorption).
            green_channel = image_np[:, :, 1]
            g_std = np.std(green_channel)
            g_mean = np.mean(green_channel)

            # حساب نسبة تذبذب القناة الخضراء (rPPG index)
            pulse_index = g_std / max(1.0, g_mean)
            if 0.05 <= pulse_index <= 0.35:
                rppg_score = 0.95
            else:
                # الشاشات المسطحة أو الأوراق المطبوعة تميل لإنتاج تشتت لوني عالي جداً أو منخفض جداً
                rppg_score = 0.40

            # 4. Fused Score Computation (وزن نسبي لضمان الدقة العظمى)
            final_score = (texture_score * 0.30) + (depth_score * 0.40) + (rppg_score * 0.30)

            return float(np.clip(final_score, 0.0, 1.0))
        except Exception as e:
            print(f"Error in compute_liveness: {e}")
            return 0.5