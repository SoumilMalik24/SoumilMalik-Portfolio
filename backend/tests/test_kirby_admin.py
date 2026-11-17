"""Admin Kirby endpoints: re-index, index status, playground."""
import json

import pytest

from app.cli import main as cli_main
from app.config import get_settings
from app.models.chat import MessageModel
from app.services import llm
from app.services.kb import index as kb_index
from tests.conftest import SEED_FILE


@pytest.fixture
def seeded():
    cli_main(["seed-content", "--file", str(SEED_FILE)])


def test_reindex_and_status(client, auth_headers, seeded):
    resp = client.post("/api/admin/kirby/reindex", headers=auth_headers)
    assert resp.status_code == 202
    status = client.get("/api/admin/kirby/index", headers=auth_headers).json()
    assert status["status"] == "idle" and status["chunks"] > 10 and status["model"] == "fake-384"
    assert status["last_indexed_at"].endswith("Z")


def test_reindex_conflict(client, auth_headers, seeded):
    assert kb_index._reindex_lock.acquire(blocking=False)
    try:
        resp = client.post("/api/admin/kirby/reindex", headers=auth_headers)
        assert resp.status_code == 409 and resp.json()["detail"] == "Re-index already running"
    finally:
        kb_index._reindex_lock.release()


def test_playground_uses_draft_and_logs_nothing(client, auth_headers, seeded, save_section, seed_sections, db,
                                                monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    get_settings.cache_clear()
    client.post("/api/admin/kirby/reindex", headers=auth_headers)
    save_section("kirby", dict(seed_sections["kirby"], display_name="Draftby"))

    prompts = []

    def fake(messages, model, tools=None, **kw):
        prompts.append(messages[0]["content"])
        if len(prompts) == 1:
            call = {"id": "a", "function": {"name": "search_portfolio", "arguments": json.dumps({"query": "CodeLens"})}}
            return {"choices": [{"message": {"content": None, "tool_calls": [call]}}]}
        return {"choices": [{"message": {"content": "Draft reply"}}]}

    monkeypatch.setattr(llm, "chat_completion", fake)
    body = client.post("/api/admin/kirby/playground", json={"messages": [{"role": "user", "content": "CodeLens?"}]},
                       headers=auth_headers).json()
    assert body["reply"] == "Draft reply" and "You are Draftby" in prompts[0]
    assert body["debug"]["tool_calls"] == [{"name": "search_portfolio", "args": {"query": "CodeLens"}}]
    assert body["debug"]["chunks"] and "score" in body["debug"]["chunks"][0]
    assert db.query(MessageModel).count() == 0

    prompts.clear()
    client.post("/api/admin/kirby/playground",
                json={"messages": [{"role": "user", "content": "hi"}], "use_draft": False}, headers=auth_headers)
    assert "You are Kirby" in prompts[0]


def test_playground_requires_key_and_auth(client, auth_headers, seeded):
    body = {"messages": [{"role": "user", "content": "hi"}]}
    assert client.post("/api/admin/kirby/playground", json=body).status_code == 401
    assert client.post("/api/admin/kirby/playground", json=body, headers=auth_headers).status_code == 503
