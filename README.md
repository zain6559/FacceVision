# 💎 Face Intelligence Platform

> **المواصفة الاستثمارية ودليل التطوير للمؤسسات والشركات الناشئة**
> المنصة الذكية المتكاملة للتعرف الفائق على الوجوه، التحليل الجنائي البيومتري، والضبط الذاتي المستمر المبنية على معمارية **InsightFace (ArcFace/SCRFD)** وتكامل **CompreFace** والمسرّعة بـ **PostgreSQL pgvector (HNSW)**.

---

[![Docker Build](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](./docker-compose.yml)
[![Architecture](https://img.shields.io/badge/Engine-InsightFace%20%7C%20ArcFace%20512d-7B2CBF?style=for-the-badge)](./ARCHITECTURE.md)
[![Database](https://img.shields.io/badge/VectorDB-pgvector%20HNSW-336791?style=for-the-badge&logo=postgresql&logoColor=white)](./packages/db)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](./LICENSE)
[![Status](https://img.shields.io/badge/Enterprise-v2.5%20Production-blue?style=for-the-badge)](#)

---

## 📋 جدول المحتويات

- [1. رؤية المنصة والقيمة الاستثمارية (Platform & Investment Vision)](#1-رؤية-المنصة-والقيمة-الاستثمارية-platform--investment-vision)
  - [المقارنة التنافسية (Competitive Matrix)](#المقارنة-التنافسية-competitive-matrix)
- [2. المعمارية المتقدمة والمحرك العصبي (Advanced Architecture)](#2-المعمارية-المتقدمة-والمحرك-العصبي-advanced-architecture)
  - [2.1 المحرك العصبي InsightFace & ArcFace](#21-المحرك-العصبي-insightface--arcface)
  - [2.2 الطبقة المؤسسية المتعددة المستأجرين (CompreFace Architecture)](#22-الطبقة-المؤسسية-المتعددة-المستأجرين-compreface-architecture)
  - [2.3 طبقة الذكاء البيومتري المستقل (Autonomous Intelligence Layer)](#23-طبقة-الذكاء-البيومتري-المستقل-autonomous-intelligence-layer)
  - [2.4 تسريع الاستعلام المتجهي عبر pgvector HNSW](#24-تسريع-الاستعلام-المتجهي-عبر-pgvector-hnsw)
- [3. دليل التشغيل السريع والإنتاج عبر Docker (Quick Start Guide)](#3-دليل-التشغيل-السريع-والإنتاج-عبر-docker-quick-start-guide)
  - [التشغيل ببنقرة واحدة عبر Docker Compose](#التشغيل-ببنقرة-واحدة-عبر-docker-compose)
  - [التشغيل للتطوير المحلي (Local Development)](#التشغيل-للتطوير-المحلي-local-development)
  - [متغيرات البيئة (Environment Variables)](#متغيرات-البيئة-environment-variables)
- [4. توثيق الـ API المؤسسي (Enterprise API Documentation)](#4-توثيق-الـ-api-المؤسسي-enterprise-api-documentation)
  - [مصادقة الأمان (Authentication)](#مصادقة-الأمان-authentication)
  - [أبرز نقاط الاتصال (Core REST Endpoints)](#أبرز-نقاط-الاتصال-core-rest-endpoints)
- [5. سوق الإضافات وهندسة الـ Webhooks (Plugins & Marketplace)](#5-سوق-الإضافات-وهندسة-الـ-webhooks-plugins--marketplace)
- [6. خارطة الطريق والمساهمة (Roadmap & License)](#6-خارطة-الطريق-والمساهمة-roadmap--license)

---

## 1. رؤية المنصة والقيمة الاستثمارية (Platform & Investment Vision)

تُمثل منصة **Face Intelligence Platform** نقلة نوعية في أنظمة الرصد والتحليل البيومتري. تُعالج المنصة الثغرات الهيكلية التي تُعاني منها الحلول التقليدية المغلقة أو الأنظمة البحثية غير المجهزة للإنتاج، حيث تجمع بين **الدقة المتناهية للمحركات العصبية (InsightFace / ArcFace)** والـ **المعمارية المؤسسية المرنة المستوحاة من CompreFace**، مع دعم التحليل الجنائي والتفسير الذكي للقرارات (XAI).

> [!IMPORTANT]
> **لماذا تفوق Face Intelligence Platform المنافسين؟**
> - **تتجاوز InsightFace**: بتوفير طبقة إدارية مؤسسية، قاعدة بيانات متجهية مقياسية (pgvector HNSW)، وواجهة مستخدم ثنائية اللغة (عربي/إنجليزي) بدون حاجة لكتابة كود بايثون مخصص.
> - **تتجاوز CompreFace**: بتضمين محرك الذكاء البيومتري التفسيري (Saliency Saliency Decomposition)، والتكتيل التلقائي غير الموجه (DBSCAN Clustering)، والضبط التلقائي لمعايير الخطأ (FAR/FRR Self-Calibration).
> - **تتجاوز الأنظمة المغلقة (Clearview AI / Palantir)**: توفر الملكية الكاملة للبيانات (Self-Hosted/On-Premise)، والتوافق الكامل مع قوانين حماية البيانات (GDPR / NDMO)، وسوق إضافات مفتوح لتوسيع القدرات البرمجية.

### المقارنة التنافسية (Competitive Matrix)

| الميزة / المعيار | **Face Intelligence Platform** | InsightFace | CompreFace | Clearview AI | Palantir Gotham |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **المحرك العصبي (Backbone)** | ArcFace 512-dim + SCRFD | ArcFace / SCRFD | FaceNet / InsightFace | proprietary | proprietary |
| **قاعدة البيانات المتجهية** | pgvector (HNSW Index) | ❌ لا يوجد | PostgreSQL (Basic) | ❌ مغلق | Proprietary DB |
| **العزل المؤسسي (Multi-Tenant)** | ✅ Projects & API Keys | ❌ لا يوجد | ✅ متوفر | ❌ مغلق | ✅ enterprise |
| **التفسير البيومتري (XAI)** | ✅ 5 Anatomical Regions | ❌ لا يوجد | ❌ لا يوجد | ❌ لا يوجد | ❌ لا يوجد |
| **التكتيل الذاتي (DBSCAN)** | ✅ Cosine DBSCAN | ❌ لا يوجد | ❌ لا يوجد | ❌ لا يوجد | ⚠️ محدد |
| **الضبط الذاتي (Self-Calibration)**| ✅ Dynamic EER Curve | ❌ لا يوجد | ❌ لا يوجد | ❌ لا يوجد | ❌ لا يوجد |
| **الاستضافة الخاصة (On-Premise)** | ✅ Docker / Kubernetes | ⚠️ مكتبات فقط | ✅ Docker | ❌ سحابي فقط | ✅ On-Premise |
| **سوق الإضافات (Plugins)** | ✅ Event Hooks & API | ❌ لا يوجد | ❌ لا يوجد | ❌ لا يوجد | ✅ Module system |

---

## 2. المعمارية المتقدمة والمحرك العصبي (Advanced Architecture)

تم بناء المنصة وفق معمارية دقيقة تفصل بين المحرك العصبي، طبقة إدارة الموارد المؤسسية، وطبقة التحليل البيومتري المستقل.

```mermaid
graph TD
    Client[📱 React 19 Frontend / External Clients] -->|REST API / Bearer Token| Gateway[🔒 Enterprise Express API Gateway]

    subgraph Core System Stack
        Gateway --> Auth[Key Management & RBAC Layer]
        Gateway --> Engine[🧠 InsightFace Neural Core]
        Gateway --> Intel[🔮 Autonomous Intelligence Layer]
        Gateway --> PluginManager[🔌 Plugin & Webhook Engine]
    end

    subgraph Neural Processing Pipeline
        Engine --> SCRFD[SCRFD Face Detector & 5-Pt Alignment]
        SCRFD --> ArcFace[ArcFace 512-d Feature Extractor]
    end

    subgraph Intelligence Module
        Intel --> XAI[Anatomical Saliency Decomposition]
        Intel --> DBSCAN[Cosine DBSCAN Density Clustering]
        Intel --> Calib[FAR/FRR & EER Self-Calibration]
    end

    subgraph Data Store
        ArcFace --> VectorDB[(🐘 PostgreSQL 16 + pgvector HNSW)]
        DBSCAN --> VectorDB
    end
```

### 2.1 المحرك العصبي InsightFace & ArcFace
- **الكشف والمحاذاة (Detection & Alignment)**: استخدام نموذج **SCRFD** السريع للكشف عن الوجه وتحديد 5 نقاط بيومترية أساسية (العينين، الأنف، وزاويتي الفم)، ثم تطبيق التحويل الهندسي المتماثل (Affine Transformation) لمعايرة الصورة وفق قالب ArcFace الرسمي (112×112).
- **المتجهات البيومترية (Embeddings)**: استخراج متجهات ميزات عالية الدقة مكوّنة من **512 بُعداً (512-dimensional vector)** مع تطبيع L2 لضمان المسافة الكوسينية الدقيقة.
- **حزم النماذج المدعومة (Model Zoo)**: دعم حزم `buffalo_l` (الدقة القصوى), `buffalo_m`, `buffalo_s`, وحزم `antelopev2`.

### 2.2 الطبقة المؤسسية المتعددة المستأجرين (CompreFace Architecture)
- **المشاريع والتعليمات (Projects & Subject Collections)**: إمكانية فصل البيانات البيومترية بين الأقسام أو المشاريع المختلفة بمرونة كاملة.
- **إدارة المفاتيح التشفيرية**: إصدار واستبدال مفاتيح API آمنة مسبوقة بـ `fv_live_` ومحمية بتوقيع HMAC-SHA256.
- **سجل التفتيش (Audit Logging)**: تسجيل تفصيلي لجميع عمليات المطابقة، الإدخال، والتعديل مع حظر الوصول غير المصرح به.

### 2.3 طبقة الذكاء البيومتري المستقل (Autonomous Intelligence Layer)
- **محرك التفسير الجنائي (Explainability Engine - XAI)**: تفكيك درجة المطابقة بين وجهين إلى 5 مناطق تشريحية أساسية:
  1. `ocular_left` (العين والجانب الأيسر)
  2. `ocular_right` (العين والجانب الأيمن)
  3. `nasal_bridge` (جسر الأنف)
  4. `oral_mandibular` (الفم والفك)
  5. `facial_contour` (محيط الوجه والهيكل)
- **التكتيل الذاتي المستقل (Cosine DBSCAN Clustering)**: تحليل قاعدة البيانات لاكتشاف الهويات غير المعرفة تلقائياً وتجميع الصور المكررة دون حاجة للتدخل البشري (`eps: 0.30`).
- **المعايرة والتوليف الذاتي (Self-Calibration & Auto-Tuning)**: قياس معدلات الخلل التلقائي (FAR و FRR)، حساب نقطة متساوي الخطأ (EER)، وتحديث عتبات المطابقة تلقائياً مع دعم التراجع الفوري (1-Click Rollback) إلى النسخ السابقة.

### 2.4 تسريع الاستعلام المتجهي عبر pgvector HNSW
تم اعتماد إندكس **HNSW (Hierarchical Navigable Small World)** داخل قاعدة البيانات PostgreSQL لضمان سرعة بحث الاستعلام المتجهي بأقل من **5 ملي ثانية** لقواعد بيانات تحتوي على ملايين الوجوه.
- إعدادات الفهرس: `m = 32`, `ef_construction = 256`, `ef_search = 200`.

---

## 3. دليل التشغيل السريع والإنتاج عبر Docker (Quick Start Guide)

### التشغيل ببنقرة واحدة عبر Docker Compose

للتشغيل المباشر في بيئة الإنتاج بكل المكونات (قاعدة البيانات المتجهية + السيرفر + الواجهة):

```bash
# 1. استنساخ المستودع
git clone https://github.com/YOUR_USERNAME/Face-Learn-Net.git
cd Face-Learn-Net

# 2. تشغيل الحاوية المكتملة
docker compose up -d --build

# 3. التحقق من صحة النظام
docker compose ps
```

سيكون النظام متاحاً فوراً على:
- **واجهة المنصة (Dashboard & Web UI)**: `http://localhost:8080`
- **نقطة فحص الصحة (Healthcheck)**: `http://localhost:8080/api/healthz`

---

### التشغيل للتطوير المحلي (Local Development)

#### المتطلبات الأساسية:
- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **PostgreSQL 16** متضمنة إضافة `pgvector`

```bash
# تثبيت التبعيات
pnpm install

# إعداد ملف البيئة
cp .env.example .env
# تعديل DATABASE_URL في ملف .env

# مزامنة مخطط قاعدة البيانات
pnpm db:push

# تشغيل خادم الـ API (Port 8080)
pnpm dev:server

# في نافذة أخرى: تشغيل الواجهة الأمامية (Port 24082)
pnpm dev:web
```

---

### متغيرات البيئة (Environment Variables)

| المتغير | التوضيح | القيمة الافتراضية / المثال |
| :--- | :--- | :--- |
| `DATABASE_URL` | سلسلة اتصال قاعدة بيانات PostgreSQL | `postgresql://user:pass@localhost:5432/facevision_db` |
| `PORT` | منفذ تشغيل الخادم | `8080` |
| `NODE_ENV` | بيئة التشغيل (`development` / `production`) | `production` |
| `INSIGHTFACE_MODEL_PACK` | حزمة نموذج الذكاء الاصطناعي | `buffalo_l` |
| `RATE_LIMIT_MAX` | الحد الأقصى للطلبات في الدقيقة | `1000` |
| `CORS_ORIGINS` | النطاقات المسموح لها بالاتصال | `*` |

---

## 4. توثيق الـ API المؤسسي (Enterprise API Documentation)

### مصادقة الأمان (Authentication)
تعتمد جميع نقاط الاتصال المؤسسية على الترويسة القياسية:
```http
Authorization: Bearer fv_live_9a8b7c6d5e4f3a2b1c0d
```
أو عبر الترويسة المخصصة:
```http
x-api-key: fv_live_9a8b7c6d5e4f3a2b1c0d
```

---

### أبرز نقاط الاتصال (Core REST Endpoints)

#### 1. التعرف البيومتري والمطابقة (Biometric Recognition)

##### • التعرف على وجه (Identify Face)
`POST /api/recognition/identify`
- **الوصف**: رفع صورة للتعرف على هوية الشخص من قاعدة البيانات ومقارنتها عبر متجهات ArcFace 512-d.
- **Request (Multipart Form-Data)**:
  - `image`: ملف الصورة (JPG/PNG)
  - `limit` *(optional)*: عدد النتائج (Default: 5)
  - `threshold` *(optional)*: عتبة التماثل (Default: 0.60)
- **Response `200 OK`**:
```json
{
  "success": true,
  "matchFound": true,
  "person": {
    "id": "usr_99812",
    "name": "د. أحمد الخالد",
    "externalId": "EMP-4401"
  },
  "confidence": 0.942,
  "executionTimeMs": 14.2,
  "candidates": [
    { "id": "usr_99812", "name": "د. أحمد الخالد", "similarity": 0.942 }
  ]
}
```

##### • التحقق من تطابق وجهين (Verify / Compare)
`POST /api/recognition/compare`
- **Request (Multipart Form-Data)**: `imageA`, `imageB`
- **Response `200 OK`**:
```json
{
  "isMatch": true,
  "similarity": 0.887,
  "threshold": 0.65,
  "distance": 0.113
}
```

---

#### 2. إدارة الهويات والأوجه (Identity Management)

| الميثود | المسار (Endpoint) | الوصف |
| :--- | :--- | :--- |
| `GET` | `/api/persons` | استرجاع قائمة الهويات المسجلة مع إحصائيات الأوجه |
| `POST` | `/api/persons` | تسجيل هوية جديدة (`name`, `externalId`, `metadata`) |
| `GET` | `/api/persons/:id` | جلب تفاصيل هوية معينة مع كافة الصور المتجهية |
| `DELETE` | `/api/persons/:id` | حذف هوية وكافة بصماتها البيومترية |
| `POST` | `/api/persons/:id/faces` | إضافة وجه جديد لهوية قائمة وتحديث البصمة المتجهية |

---

#### 3. الذكاء البيومتري والتحليل الجنائي (Biometric Intelligence & XAI)

##### • التفسير الجنائي للمطابقة (Explain Match Saliency)
`POST /api/intelligence/explain`
- **Request**:
```json
{
  "sourceFaceId": "face_101",
  "targetFaceId": "face_202"
}
```
- **Response `200 OK`**:
```json
{
  "overallSimilarity": 0.912,
  "saliencyDecomposition": {
    "ocular_left": 0.94,
    "ocular_right": 0.92,
    "nasal_bridge": 0.89,
    "oral_mandibular": 0.86,
    "facial_contour": 0.95
  },
  "verdict": "HIGH_CONFIDENCE_MATCH",
  "explanation": "أعلى نسبة تماثل تتركز في محرك العينين ومحيط الوجه."
}
```

##### • التكتيل التلقائي لغير المعرفين (DBSCAN Clustering)
`POST /api/intelligence/cluster`
- **Request**: `{"eps": 0.30, "minSamples": 2}`
- **Response `200 OK`**:
```json
{
  "totalProcessed": 1250,
  "clustersFound": 14,
  "unassignedNoise": 32,
  "newIdentitiesCreated": 14
}
```

##### • المعايرة والضبط التلقائي (Self-Calibration & Auto-Tuning)
`POST /api/intelligence/self-calibrate`
- **Response `200 OK`**:
```json
{
  "previousThreshold": 0.60,
  "optimalThreshold": 0.642,
  "calculatedEER": 0.0012,
  "status": "CALIBRATED_AND_APPLIED",
  "versionId": "calib_v8812"
}
```

---

#### 4. إدارة المؤسسات والأمان (Enterprise & Security)

| الميثود | المسار (Endpoint) | الوصف |
| :--- | :--- | :--- |
| `GET / POST` | `/api/enterprise/projects` | إنشاء وإدارة المشاريع المستقلة |
| `GET / POST` | `/api/enterprise/api-keys` | إصدار وإلغاء مفاتيح API المؤمّنة |
| `GET` | `/api/enterprise/audit-logs` | استعراض سجلات الأحداث الأمنية والتشغيلية |

---

## 5. سوق الإضافات وهندسة الـ Webhooks (Plugins & Marketplace)

تمتلك المنصة نظام إضافات مدعوم بنمط الأحداث (Event-Driven Plugin Architecture)، يتيح للمطورين والشركات ربط أنظمتهم المخصصة بسهولة.

### خطوط الأحداث المدعومة (Event Hooks):
- `onFaceRecognized`: يُطلق فور التعرف على أي وجه في الأنظمة الحية.
- `onFaceEnrolled`: يُطلق عند تسجيل هوية أو وجه جديد.
- `onAnomalyDetected`: يُطلق عند اكتشاف محاولة انتحال أو تباين بيومتري غير عادي.
- `onAuditLog`: يُطلق مع كل حدث أمني في النظام.

### التوقيع والتحقق لـ Webhooks:
يتم إرسال كافة التنبيهات مع الترويسة الأمنية `X-FaceVision-Signature` الموقعة بـ **HMAC-SHA256** لضمان عدم تزوير الطلبات:

```typescript
// مثال للتحقق من التوقيع بالـ Node.js
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## 6. خارطة الطريق والمساهمة (Roadmap & License)

### 🚀 خارطة الطريق المستقبليّة (Platform Roadmap)
- [x] **v2.5 (الإنتاج الحالي)**: محرك InsightFace / ArcFace + pgvector HNSW + التفسير الجنائي XAI + دعم Docker.
- [ ] **v3.0 (Q4 2026)**: كشف الأحياء الثلاثي الأبعاد (3D Liveness Detection) لتفادي الانتحال بالصور والفيديوهات.
- [ ] **v3.5**: دعم معالجة بث الكاميرات الحية المباشر عبر **RTSP / WebRTC Stream Worker Nodes**.
- [ ] **v4.0**: التشفير البيومتري التام (Fully Homomorphic Encryption) للبحث في البيانات المشفرة دون فك تشفيرها.

---

### 📄 الترخيص (License)

هذا المشروع مرخص بموجب رخصة **MIT License**. يمكنك استخدام المنصة، تعديلها، ونشرها في المشاريع التجارية والمؤسسية بحرية كاملة.

---

<p center="true" style="text-align: center; color: #888;">
<strong>Face Intelligence Platform</strong> — تم التطوير والإعداد بواسطة فريق الهندسة والذكاء البيومتري الفائق.
</p>
