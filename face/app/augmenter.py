import cv2
import numpy as np

class FaceAugmenter:
    """
    يقوم بمحاكاة الظروف البيئية وكاميرات المراقبة المختلفة لزيادة دقة التعرف
    على الصور التي يتم التقاطها من زوايا أو في إضاءة صعبة.
    """
    @staticmethod
    def augment(image_np: np.ndarray, count: int = 10) -> list:
        if image_np is None or image_np.size == 0:
            return []

        augmented_images = [image_np.copy()] # الصورة الأصلية

        # 1. قلب الصورة أفقياً (Mirroring)
        flipped = cv2.flip(image_np, 1)
        augmented_images.append(flipped)

        # 2. إضاءة خافتة وضجيج كاميرات المراقبة (CCTV Static Noise)
        h, w, c = image_np.shape
        cctv = image_np.copy()
        cctv = cv2.convertScaleAbs(cctv, alpha=0.4, beta=10)
        noise = np.random.normal(0, 15, (h, w, c)).astype(np.int16)
        cctv = np.clip(cctv.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        augmented_images.append(cctv)

        # 3. دوران لليسار 5 درجات
        matrix = cv2.getRotationMatrix2D((w/2, h/2), 5, 1.0)
        rot_l = cv2.warpAffine(image_np, matrix, (w, h))
        augmented_images.append(rot_l)

        # 4. دوران لليمين 5 درجات
        matrix = cv2.getRotationMatrix2D((w/2, h/2), -5, 1.0)
        rot_r = cv2.warpAffine(image_np, matrix, (w, h))
        augmented_images.append(rot_r)

        # 5. تعزيز تباين الإضاءة القوية (Bright Sunlight Simulation)
        bright = cv2.convertScaleAbs(image_np, alpha=1.3, beta=20)
        augmented_images.append(bright)

        # 6. إضافة تأثير الظل الشديد (Direct Shadow Mapping)
        shadow = image_np.copy().astype(np.float32)
        for i in range(h):
            factor = 0.4 + (i / float(h)) * 0.6
            shadow[i, :, :] *= factor
        shadow = np.clip(shadow, 0, 255).astype(np.uint8)
        augmented_images.append(shadow)

        # 7. نظام الرؤية الليلية الخضراء لكاميرات الأمن (Night Vision Mode)
        green_cctv = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        green_cctv = cv2.merge([np.zeros_like(green_cctv), green_cctv, np.zeros_like(green_cctv)])
        green_cctv = cv2.convertScaleAbs(green_cctv, alpha=0.8, beta=15)
        augmented_images.append(green_cctv)

        # 8. تشويش ضبابي خفيف (Focus Blur Simulation)
        blurred = cv2.GaussianBlur(image_np, (5, 5), 0)
        augmented_images.append(blurred)

        # 9. تمايل الوجه المحاكي (Yaw Shear Mapping)
        pts1 = np.float32([[5, 5], [w-5, 5], [5, h-5]])
        pts2 = np.float32([[0, 5], [w-10, 8], [5, h-5]])
        M = cv2.getAffineTransform(pts1, pts2)
        yaw = cv2.warpAffine(image_np, M, (w, h))
        augmented_images.append(yaw)

        return augmented_images[:count]