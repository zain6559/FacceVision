import os
import shutil
import pytest
import numpy as np
import cv2
from app.database import DatabaseManager
from app.face_processor import FaceProcessor
from app.scraper import SocialScraperEngine
from app.learner import ContinuousLearner

@pytest.fixture(scope="module")
def setup_dirs():
    os.makedirs("tests/temp_test", exist_ok=True)
    yield
    if os.path.exists("tests/temp_test"):
        shutil.rmtree("tests/temp_test")

def test_database_manager(setup_dirs):
    db_path = "tests/temp_test/test.db"
    faiss_path = "tests/temp_test/test.index"

    db = DatabaseManager(db_path=db_path, faiss_path=faiss_path, dimension=512)
    assert db.index.ntotal == 0

    identity_id = db.add_identity("John Doe", {"notes": "Test target"})
    assert identity_id > 0

    same_id = db.add_identity("John Doe")
    assert same_id == identity_id

    dummy_emb = [0.1] * 512
    face_id = db.add_face(
        identity_id=identity_id,
        embedding=dummy_emb,
        image_url="http://example.com/test.jpg",
        source="Instagram",
        liveness_score=0.95,
        age=30,
        gender="Man",
        emotion="Happy"
    )
    assert face_id > 0
    assert db.index.ntotal == 1

    search_results = db.search_face(dummy_emb, k=1)
    assert len(search_results) == 1
    assert search_results[0]["name"] == "John Doe"
    assert search_results[0]["source"] == "Instagram"
    assert search_results[0]["age"] == 30

def test_face_processor_liveness():
    processor = FaceProcessor()

    live_img = np.zeros((200, 200, 3), dtype=np.uint8)
    for i in range(200):
        for j in range(200):
            live_img[i, j] = (i * j) % 256

    score = processor.compute_liveness(live_img)
    assert 0.0 <= score <= 1.0

def test_scraper_engine():
    engine = SocialScraperEngine()

    inst_fallback = engine.instagram_fallback_scrape("elonmusk")
    assert len(inst_fallback) > 0
    assert inst_fallback[0]["source"] == "Instagram"
    assert inst_fallback[0]["identity_name"] == "elonmusk"

    fb_fallback = engine.facebook_fallback_scrape("mark")
    assert len(fb_fallback) > 0
    assert fb_fallback[0]["source"] == "Facebook"

    osint_res = asyncio_run(engine.osint_reverse_search("http://some_img.jpg"))
    assert len(osint_res) == 3
    assert "similarity" in osint_res[0]

def asyncio_run(coro):
    import asyncio
    return asyncio.get_event_loop().run_until_complete(coro)