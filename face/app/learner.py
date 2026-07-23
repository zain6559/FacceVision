import os
import httpx
import cv2
import numpy as np
import asyncio
from app.augmenter import FaceAugmenter

class ContinuousLearner:
    """
    محرك التعلم المستمر الذي يقوم بتحميل وتصفية الصور ومعالجتها،
    ثم إدخالها تلقائياً وفهرستها في فهرس الوجوه الذكي.
    """
    def __init__(self, db, processor, download_dir="app/temp_crops"):
        self.db = db
        self.processor = processor
        self.download_dir = download_dir
        os.makedirs(self.download_dir, exist_ok=True)

    async def digest_scraped_data(self, scraped_posts: list, target_name: str):
        identity_id = self.db.add_identity(target_name)

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            tasks = [self.process_post_item(client, post, identity_id, target_name) for post in scraped_posts]
            await asyncio.gather(*tasks)

    async def process_post_item(self, client: httpx.AsyncClient, post: dict, identity_id: int, target_name: str):
        img_url = post["image_url"]
        source = post["source"]

        local_filename = f"dl_{abs(hash(img_url))}.jpg"
        local_path = os.path.join(self.download_dir, local_filename)

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = await client.get(img_url, headers=headers)
            if response.status_code == 200:
                with open(local_path, "wb") as f:
                    f.write(response.content)

                faces = self.processor.detect_faces(local_path)

                if not faces:
                    self.db.add_activity_log("LEARN", "FAILED", f"No face detected in scraped post: {img_url}")
                    return

                for f_idx, face in enumerate(faces):
                    crop = face["crop"]
                    # إجراء تعديلات وتوليد زوايا متعددة لكل وجه مكتشف لضمان دقة التعرف
                    variations = FaceAugmenter.augment(crop, count=10)

                    for var_idx, var_img in enumerate(variations):
                        temp_var_path = os.path.join(self.download_dir, f"var_{var_idx}_{local_filename}")
                        cv2.imwrite(temp_var_path, var_img)

                        embedding = self.processor.get_embedding(temp_var_path)
                        if embedding:
                            analysis = self.processor.analyze_face(temp_var_path)
                            age = analysis[0].get("age") if analysis else 30
                            gender = analysis[0].get("dominant_gender") if analysis else "Unspecified"
                            emotion = analysis[0].get("dominant_emotion") if analysis else "Neutral"

                            liveness = self.processor.compute_liveness(var_img)

                            self.db.add_face(
                                identity_id=identity_id,
                                embedding=embedding,
                                image_url=img_url,
                                source=source,
                                liveness_score=liveness,
                                age=age,
                                gender=gender,
                                emotion=emotion
                            )

                        if os.path.exists(temp_var_path):
                            os.remove(temp_var_path)

                self.db.add_activity_log(
                    "LEARN",
                    "SUCCESS",
                    f"Target '{target_name}' thoroughly digested from {source}. Added 10 aligned face variations."
                )

        except Exception as e:
            self.db.add_activity_log("LEARN", "FAILED", f"Error digesting image {img_url}: {str(e)}")
        finally:
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception:
                    pass