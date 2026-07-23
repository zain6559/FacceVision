# Face Intelligence Platform — Architectural Reference Manual

## 1. Executive Summary & Platform Vision

**Face Intelligence Platform** is an enterprise-grade, research-ready biometric intelligence ecosystem designed to transcend traditional face recognition systems. Built upon an official **InsightFace (ArcFace/SCRFD)** neural backbone, a **CompreFace-inspired multi-tenant management layer**, an **autonomous Biometric Intelligence Layer**, and a modular **Plugin & Webhook Architecture**, it provides high-throughput, explainable, and self-calibrating face intelligence for enterprise, research, and edge environments.

---

## 2. Platform Component Architecture

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Face Intelligence Platform UI           │
                  │  (Recognition | Database | Intelligence | Marketplace)  │
                  └──────────────────────────┬──────────────────────────────┘
                                             │ REST API / WebSockets
                  ┌──────────────────────────▼──────────────────────────────┐
                  │              Enterprise REST API & Auth Layer           │
                  │   (RBAC | API Keys | Projects | Audit Logs | Webhooks)  │
                  └──────────────────────────┬──────────────────────────────┘
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      │                                                                             │
┌─────▼──────────────────────────────────────┐    ┌─────────────────────────────────▼─────────────────────┐
│    InsightFace Core Neural Engine          │    │         Autonomous Biometric Intelligence             │
│ (SCRFD 5-Point | ArcFace 512-dim Embedder) │    │  (Saliency Explainability | Cosine DBSCAN Cluster)    │
│ (Buffalo Model Packs | ONNX Runtime)       │    │  (FAR/FRR Self-Calibration | Emergency Rollback)      │
└─────────────────────┬──────────────────────┘    └─────────────────────────────────┬─────────────────────┘
                      │                                                             │
                      └──────────────────────────────┬──────────────────────────────┘
                                                     │
                                   ┌─────────────────▼────────────────┐
                                   │ PostgreSQL 16 + pgvector (HNSW) │
                                   │ (m=32, ef_construction=256, LRU) │
                                   └──────────────────────────────────┘
```

---

## 3. Core Architectural Modules

### 3.1 InsightFace Neural Core Engine (`apps/server/src/lib/insightface/`)
* **Detection & Alignment**: SCRFD 5-Point Anchor Detection + Affine Similarity Matrix Transformation mapping facial geometry to the official 112×112 ArcFace landmark template.
* **Embeddings**: ArcFace / Partial FC 512-dimensional L2-normalized feature vectors.
* **Model Packs**: Supported InsightFace packs (`buffalo_l`, `buffalo_m`, `buffalo_s`, `buffalo_sc`, `antelopev2`).

### 3.2 Enterprise Multi-Tenant Platform (`apps/server/src/routes/enterprise.ts`)
* **Projects & Collections**: CompreFace-style workspace abstraction with isolated subject collections.
* **API Key Provisioning**: HMAC-SHA256 signed API Keys (`fv_live_...`).
* **Audit Trail**: Real-time logging of security and recognition events.

### 3.3 Autonomous Biometric Intelligence (`apps/server/src/lib/intelligence/`)
* **Explainability Engine**: Decomposes embeddings into 5 anatomical regions (`ocular_left`, `ocular_right`, `nasal_bridge`, `oral_mandibular`, `facial_contour`) to output human-readable match saliency reports.
* **Density Clustering**: Cosine DBSCAN (`eps: 0.30`) for discovering unassigned identities and detecting duplicate subjects (`similarity > 0.85`).
* **Self-Calibration**: Dynamic FAR/FRR curve calculation, Equal Error Rate (EER) optimization, and 1-click Version Rollback.

### 3.4 Plugin & Webhook Engine (`apps/server/src/lib/plugins/` & `webhooks/`)
* **Event Hooks**: `onFaceRecognized`, `onFaceEnrolled`, `onAuditLog`, `onAnomalyDetected`.
* **Signed Webhooks**: Event dispatching with `X-FaceVision-Signature` HMAC-SHA256 headers.

---

## 4. Deployment Environments

* **Containerized Docker Stack**: Multi-stage `Dockerfile` + `docker-compose.yml` with health checks.
* **Vector Indexing**: PostgreSQL `pgvector` with tuned HNSW index (`m: 32`, `ef_construction: 256`, `ef_search: 200`).
