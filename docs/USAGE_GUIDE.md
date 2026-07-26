# 📚 دليل الاستخدام السريع - FaceVision

## 🎯 نظرة عامة

هذا الدليل يشرح كيفية تشغيل واستخدام نظام **FaceVision** للتعرف على الوجوه.

---

## 🚀 التشغيل السريع

### 1. تثبيت المشروع

```bash
# استنساخ المشروع
git clone https://github.com/zain6559/FacceVision.git
cd FacceVision

# تثبيت التبعيات
npm install
```

### 2. تشغيل التطبيق

```bash
# تشغيل وضع التطوير
npm run dev
```

### 3. فتح المتصفح

```
🌐 http://localhost:24082/
```

---

## 📱 شرح الواجهة

### 🏠 الصفحة الرئيسية

عند فتح التطبيق ستجد الواجهة الرئيسية مع:
- ✅ شريط تنقل علوي
- ✅ قائمة جانبية للصفحات
- ✅ منطقة رفع الصور
- ✅ زر SCAN للتعرف

### 🌐 تغيير اللغة

في أعلى الصفحة، اضغط على:
- **العربية [AR]** للتبديل للعربية
- اللغة الحالية تظهر بجانب الزر

---

## 🔍 كيفية التعرف على الوجوه

### الخطوة 1: رفع صورة

```typescript
// الطريقة 1: Drag & Drop
// اسحب الصورة وأفلتها في منطقة الرفع

// الطريقة 2: Click
// اضغط على منطقة الرفع واختر ملف

// الطريقة 3: URL
// أدخل رابط الصورة في حقل URL
```

### الخطوة 2: بدء التعرف

```
اضغط على زر [ SCAN ] أو [ مسح ]
```

### الخطوة 3: عرض النتائج

النتائج تظهر:
- 📊 عدد الوجوه المكتشفة
- 👤 الهوية (إن وُجدت)
- 📈 نسبة الثقة (0% - 100%)
- 📍 موقع الوجه (Bounding Box)

---

## 👥 إدارة قاعدة البيانات

### الانتقال لصفحة Persons

```
الصفحة الرئيسية → Database
أو مباشرة: /persons
```

### إضافة شخص جديد

1. اضغط على **Add New Person**
2. أدخل الاسم
3. ارفع صورة واحدة أو أكثر
4. اضغط **Save**

### تعديل/حذف شخص

| العملية | الخطوات |
|--------|---------|
| تعديل | اضغط على ☎️ أو ✏️ |
| حذف | اضغط على 🗑️ |

---

## 🔑 إنشاء مفتاح API

### الانتقال لصفحة API Keys

```
/api-keys
```

### إنشاء مفتاح جديد

1. اختر الدور (Role):
   - `ADMIN` - جميع الصلاحيات
   - `SERVICE` - للتطبيقات
   - `DEVELOPER` - تطوير
   - `READONLY` - قراءة فقط

2. أدخل اسم المفتاح
3. اضغط **Generate API Key**

### استخدام المفتاح

```bash
curl -X POST http://localhost:3001/api/v1/recognition/identify \
  -H "Authorization: Bearer fv_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://example.com/photo.jpg"}'
```

---

## 📊 صفحة التحليلات

### الانتقال

```
/stats
```

### المعروض

| المقياس | الوصف |
|---------|-------|
| Total Recognitions | عدد عمليات التعرف |
| Success Rate | معدل النجاح |
| Avg Latency | متوسط وقت الاستجابة |
| EER | Equal Error Rate |

---

## 🧠 صفحة الذكاء

### الانتقال

```
/intelligence
```

### الميزات

| الميزة | الوصف |
|--------|-------|
| Emotion Analysis | تحليل المشاعر |
| Deepfake Detection | كشف التزييف |
| Liveness Check | كشف الانتحال |

---

## 🔄 صفحة Learning Pipeline

### الانتقال

```
/learning
```

### العمليات

| العملية | الوصف |
|--------|-------|
| Trigger Training | بدء تدريب جديد |
| Import Model | استيراد نموذج |
| Export Model | تصدير نموذج |

---

## 🏢 صفحة المشاريع

### الانتقال

```
/projects
```

### إدارة المشاريع

- إنشاء مشروع جديد
- إضافة Team Members
- إدارة الصلاحيات

---

## 🛒 Marketplace

### الانتقال

```
/marketplace
```

### المتوفر

- 🔮 نماذج جاهزة
- 🧩 إضافات
- 📋 قوالب

---

## 🔐 الأمان

### ما يتم حمايته تلقائياً

```
✅ تشفير البيانات البيومترية
✅ حماية API Keys
✅ Rate Limiting
✅ Cross-Tenant Isolation
✅ Secure Logging
```

### ما لا يُسجَّل أبداً

```
❌ API Keys
❌ Face Embeddings
❌ صور الوجوه
❌ كلمات المرور
```

---

## 📡 أمثلة API

### التعرف على الوجوه

```bash
# POST /api/v1/recognition/identify
curl -X POST http://localhost:3001/api/v1/recognition/identify \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://example.com/photo.jpg",
    "limit": 5
  }'
```

### التحقق من وجهين

```bash
# POST /api/v1/recognition/verify
curl -X POST http://localhost:3001/api/v1/recognition/verify \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_a_url": "https://example.com/photo1.jpg",
    "image_b_url": "https://example.com/photo2.jpg"
  }'
```

### جلب الهويات

```bash
# GET /api/v1/identities
curl http://localhost:3001/api/v1/identities \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### إضافة هوية جديدة

```bash
# POST /api/v1/identities
curl -X POST http://localhost:3001/api/v1/identities \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "أحمد محمد",
    "images": ["https://example.com/photo.jpg"]
  }'
```

---

## 🔧 حل المشاكل

### المشكلة: التطبيق لا يعمل

```bash
# 1. تأكد من تثبيت التبعيات
npm install

# 2. امسح الكاش
rm -rf node_modules package-lock.json
npm install

# 3. أعد تشغيل التطبيق
npm run dev
```

### المشكلة: Port مشغول

```bash
# اعرف الـ process على الـ port
lsof -i:24082

# اقتله
kill -9 <PID>
```

### المشكلة: أخطاء TypeScript

```bash
# تأكد من تثبيت TypeScript
npm install typescript --save-dev

# تحقق من الأخطاء
npx tsc --noEmit
```

---

## 📞 المساعدة

| القناة | الرابط |
|--------|--------|
| GitHub Issues | https://github.com/zain6559/FacceVision/issues |
| Email | support@facevision.example.com |

---

## 📋 ملخص الأوامر

| الأمر | الوصف |
|-------|-------|
| `npm install` | تثبيت التبعيات |
| `npm run dev` | تشغيل التطوير |
| `npm run build` | بناء التطبيق |
| `npm run web` | تشغيل الواجهة فقط |
| `npm run server` | تشغيل API فقط |

---

## 🔗 روابط سريعة

| الصفحة | الرابط |
|--------|--------|
| الرئيسية | http://localhost:24082/ |
| Database | http://localhost:24082/persons |
| API Keys | http://localhost:24082/api-keys |
| Analytics | http://localhost:24082/stats |
| Intelligence | http://localhost:24082/intelligence |
| Learning | http://localhost:24082/learning |
| Projects | http://localhost:24082/projects |
| Monitoring | http://localhost:24082/monitoring |
| API Server | http://localhost:3001/api/v1 |

---

<div align="center">

**FaceVision v1.0** - نظام التعرف على الوجوه المتقدم

</div>
