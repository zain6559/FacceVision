import os
import faiss
import numpy as np
import sqlite3
import json

class DatabaseManager:
    def __init__(self, db_path="app/data.db", faiss_path="app/faiss.index", dimension=512):
        self.db_path = db_path
        self.faiss_path = faiss_path
        self.dimension = dimension

        # إنشاء اتصال بقاعدة بيانات SQLite لتخزين النصوص والعلاقات
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.create_tables()

        # إعداد فهرس FAISS الفائق السرعة للبحث في فضاء المتجهات المتعدد الأبعاد (HNSWFlat)
        if os.path.exists(self.faiss_path):
            self.index = faiss.read_index(self.faiss_path)
        else:
            self.index = faiss.IndexHNSWFlat(self.dimension, 32)
            faiss.write_index(self.index, self.faiss_path)

    def create_tables(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS identities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS faces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identity_id INTEGER,
                faiss_id INTEGER UNIQUE,
                image_url TEXT,
                source TEXT,
                liveness_score REAL,
                age REAL,
                gender TEXT,
                emotion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(identity_id) REFERENCES identities(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT,
                status TEXT,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER,
                target_id INTEGER,
                relation_type TEXT,
                strength REAL DEFAULT 1.0,
                FOREIGN KEY(source_id) REFERENCES identities(id),
                FOREIGN KEY(target_id) REFERENCES identities(id),
                UNIQUE(source_id, target_id, relation_type)
            )
        """)
        self.conn.commit()

    def add_identity(self, name: str, metadata: dict = None) -> int:
        cursor = self.conn.cursor()
        metadata_str = json.dumps(metadata or {})
        try:
            cursor.execute("INSERT INTO identities (name, metadata) VALUES (?, ?)", (name, metadata_str))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            cursor.execute("SELECT id FROM identities WHERE name = ?", (name,))
            row = cursor.fetchone()
            if row:
                return row[0]
        return -1

    def update_identity_metadata(self, identity_id: int, metadata: dict):
        cursor = self.conn.cursor()
        cursor.execute("SELECT metadata FROM identities WHERE id = ?", (identity_id,))
        row = cursor.fetchone()
        current_meta = {}
        if row and row[0]:
            try:
                current_meta = json.loads(row[0])
            except Exception:
                pass
        current_meta.update(metadata)
        cursor.execute("UPDATE identities SET metadata = ? WHERE id = ?", (json.dumps(current_meta), identity_id))
        self.conn.commit()

    def add_face(self, identity_id: int, embedding: list, image_url: str, source: str,
                 liveness_score: float = 1.0, age: float = None, gender: str = None, emotion: str = None) -> int:
        if len(embedding) != self.dimension:
            raise ValueError(f"Embedding must be {self.dimension}-dimensional")

        cursor = self.conn.cursor()
        vec = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        vec = np.expand_dims(vec, axis=0)

        faiss_id = self.index.ntotal
        self.index.add(vec)
        faiss.write_index(self.index, self.faiss_path)

        cursor.execute("""
            INSERT INTO faces (identity_id, faiss_id, image_url, source, liveness_score, age, gender, emotion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (identity_id, faiss_id, image_url, source, liveness_score, age, gender, emotion))
        self.conn.commit()
        return cursor.lastrowid

    def search_face(self, embedding: list, k: int = 5, distance_threshold: float = 0.5):
        if self.index.ntotal == 0:
            return []

        if len(embedding) != self.dimension:
            raise ValueError(f"Embedding must be {self.dimension}-dimensional")

        vec = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        vec = np.expand_dims(vec, axis=0)

        distances, indices = self.index.search(vec, k)

        results = []
        cursor = self.conn.cursor()
        for idx, dist in zip(indices[0], distances[0]):
            if idx == -1:
                continue

            cursor.execute("""
                SELECT f.id, f.image_url, f.source, f.liveness_score, f.age, f.gender, f.emotion,
                       i.id as identity_id, i.name, i.metadata
                FROM faces f
                JOIN identities i ON f.identity_id = i.id
                WHERE f.faiss_id = ?
            """, (int(idx),))
            row = cursor.fetchone()
            if row:
                conf = max(0.0, min(1.0, 1.0 - float(dist)))
                results.append({
                    "face_id": row[0],
                    "image_url": row[1],
                    "source": row[2],
                    "liveness_score": row[3],
                    "age": row[4],
                    "gender": row[5],
                    "emotion": row[6],
                    "identity_id": row[7],
                    "name": row[8],
                    "metadata": json.loads(row[9]) if row[9] else {},
                    "distance": float(dist),
                    "confidence": conf
                })
        return results

    def add_activity_log(self, action_type: str, status: str, details: str):
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO activity_logs (action_type, status, details) VALUES (?, ?, ?)",
                       (action_type, status, details))
        self.conn.commit()

    def get_activity_logs(self, limit: int = 50):
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, action_type, status, details, timestamp FROM activity_logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [{
            "id": r[0],
            "action_type": r[1],
            "status": r[2],
            "details": r[3],
            "timestamp": r[4]
        } for r in rows]

    def get_all_identities_with_stats(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT i.id, i.name, i.metadata, i.created_at, COUNT(f.id) as face_count
            FROM identities i
            LEFT JOIN faces f ON i.id = f.identity_id
            GROUP BY i.id
            ORDER BY face_count DESC
        """)
        rows = cursor.fetchall()
        return [{
            "id": r[0],
            "name": r[1],
            "metadata": json.loads(r[2]) if r[2] else {},
            "created_at": r[3],
            "face_count": r[4]
        } for r in rows]

    def add_relationship(self, source_id: int, target_id: int, relation_type: str, strength: float = 1.0):
        if source_id == target_id:
            return
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO relationships (source_id, target_id, relation_type, strength)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(source_id, target_id, relation_type) DO UPDATE SET strength = strength + 0.5
            """, (source_id, target_id, relation_type, strength))
            self.conn.commit()
        except Exception as e:
            print(f"Error adding relationship: {e}")

    def get_social_graph(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, name FROM identities")
        nodes_rows = cursor.fetchall()
        nodes = [{"id": r[0], "label": r[1]} for r in nodes_rows]

        cursor.execute("""
            SELECT source_id, target_id, relation_type, strength FROM relationships
        """)
        edges_rows = cursor.fetchall()
        edges = [{
            "from": r[0],
            "to": r[1],
            "type": r[2],
            "weight": r[3]
        } for r in edges_rows]
        return {"nodes": nodes, "edges": edges}