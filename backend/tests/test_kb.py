"""Kirby knowledge base: embedders, chunker, incremental re-index, search."""
import copy
import re

import pytest
import requests

from app.cli import main as cli_main
from app.services.kb import embeddings as emb
from app.services.kb import index as kb_index
from app.services.kb.chunker import MAX_NOTE_CHUNK, build_chunks, split_note
from app.services.kb.embeddings import EmbeddingError, FakeEmbedder, HFEmbedder
from app.services.system_kv import get_kv
from tests.conftest import SEED_FILE


class CountingEmbedder(FakeEmbedder):
    def __init__(self):
        self.calls = []

    def embed(self, texts):
        self.calls.append(list(texts))
        return super().embed(texts)

    @property
    def embedded(self):
        return sum(len(c) for c in self.calls)


@pytest.fixture
def seeded():
    cli_main(["seed-content", "--file", str(SEED_FILE)])


def test_fake_embedder_properties():
    e = FakeEmbedder()
    a, b, c = e.embed(["LangGraph multi-agent research", "LangGraph multi-agent research", "chocolate cake"])
    assert len(a) == 384 and a == b
    assert abs(sum(x * x for x in a) - 1.0) < 1e-9
    q = e.embed(["multi-agent research with LangGraph"])[0]
    dot = lambda u, v: sum(x * y for x, y in zip(u, v))  # noqa: E731
    assert dot(q, a) > dot(q, c)


def test_hf_embedder_batches_and_retries(monkeypatch):
    calls = []

    class Resp:
        def __init__(self, status, payload=None):
            self.status_code, self._payload = status, payload

        def json(self):
            return self._payload

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append(len(json["inputs"]))
        if len(calls) == 1:
            return Resp(503)
        return Resp(200, [[1.0, 0.0, 0.0]] * len(json["inputs"]))

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(emb, "RETRY_DELAYS_S", (0, 0))
    out = HFEmbedder("https://hf.example", "tok").embed([f"t{i}" for i in range(40)])
    assert calls == [32, 32, 8] and len(out) == 40 and out[0] == [1.0, 0.0, 0.0]

    monkeypatch.setattr(requests, "post", lambda *a, **k: Resp(401))
    with pytest.raises(EmbeddingError):
        HFEmbedder("https://hf.example", "tok").embed(["x"])
    with pytest.raises(EmbeddingError):
        HFEmbedder("https://hf.example", "")


def test_hf_embedder_mean_pools_token_vectors():
    out = HFEmbedder._parse([[[1.0, 0.0], [0.0, 1.0]]], 1)
    assert out[0] == pytest.approx([2 ** -0.5, 2 ** -0.5])


def test_chunker(seed_sections):
    data = copy.deepcopy(seed_sections)
    data["projects"]["items"][1]["hidden"] = True
    chunks = build_chunks(data)
    texts = " ".join(c.text for c in chunks)
    assert not any(c.item_id == "smart-finance-ai" for c in chunks)
    assert any(c.section == "projects" and c.item_id == "researchsynth" for c in chunks)
    faq = [c for c in chunks if c.source == "faq"]
    assert faq and faq[0].text.startswith("Q: How can I contact") and " A: " in faq[0].text
    assert not re.search(r"\+?\d[\d\s-]{8,}\d", texts)  # phone numbers are never part of the knowledge
    assert {c.section for c in chunks if c.source == "content"} <= {"hero", "about", "projects", "experience", "contact"}


def test_split_note_limits():
    long_para = "word " * 400
    pieces = split_note("short intro\n\n" + long_para + "\n\nshort outro")
    assert all(len(p) <= MAX_NOTE_CHUNK for p in pieces) and len(pieces) >= 3
    assert split_note("a\n\nb") == ["a\n\nb"]


def test_incremental_reindex(db, seeded, save_section, client, auth_headers, seed_sections):
    e = CountingEmbedder()
    first = kb_index.reindex(db, embedder=e)
    assert first["embedded"] == first["chunks"] > 10
    status = get_kv(db, "kb_status")
    assert status["status"] == "idle" and status["chunks"] == first["chunks"] and status["model"] == "fake-384"

    e2 = CountingEmbedder()
    assert kb_index.reindex(db, embedder=e2)["embedded"] == 0

    projects = copy.deepcopy(seed_sections["projects"])
    projects["items"][0]["description"] = "A brand new description of ResearchSynth."
    save_section("projects", projects)
    client.post("/api/admin/publish", json={"sections": ["projects"]}, headers=auth_headers)
    e3 = CountingEmbedder()
    assert kb_index.reindex(db, embedder=e3)["embedded"] == 0  # publish already re-indexed it

    projects["items"] = projects["items"][:1]
    save_section("projects", projects)
    client.post("/api/admin/publish", json={"sections": ["projects"]}, headers=auth_headers)
    db.expire_all()
    from app.models.kb import KbChunk
    item_ids = {r.item_id for r in db.query(KbChunk).filter(KbChunk.section == "projects")}
    assert item_ids == {"researchsynth"}


def test_reindex_counts_one_changed_item(db, seeded, seed_sections):
    kb_index.reindex(db, embedder=FakeEmbedder())
    from app.models.content import ContentSection
    row = db.get(ContentSection, "projects")
    published = copy.deepcopy(row.published)
    published["items"][2]["description"] = "Changed CodeLens description."
    row.published = published
    db.commit()
    e = CountingEmbedder()
    assert kb_index.reindex(db, embedder=e)["embedded"] == 1


def test_reindex_failure_recorded(db, seeded):
    class Broken(FakeEmbedder):
        def embed(self, texts):
            raise EmbeddingError("boom")

    with pytest.raises(EmbeddingError):
        kb_index.reindex(db, embedder=Broken())
    status = kb_index.get_status(db)
    assert status["status"] == "failed" and "boom" in status["last_error"]


def test_search_finds_the_right_section(db, seeded):
    kb_index.reindex(db)
    hits = kb_index.search(db, "CodeLens 6-agent CrewAI code review", k=3)
    assert hits and hits[0][2] == "projects" and "CodeLens" in hits[0][1]
    assert kb_index.search(db, "   ") == []
