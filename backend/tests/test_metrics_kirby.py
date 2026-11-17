"""Kirby and publish blocks in GET /api/admin/metrics (existing keys unchanged)."""
from datetime import timedelta

from app.models.chat import ConversationModel, MessageModel
from app.utils.time import utcnow

LEGACY_KEYS = {"range_days", "generated_at", "live", "totals", "prev_totals", "daily", "sections",
               "best_section", "devices", "referrers", "visitor_mix"}


def test_kirby_and_publish_blocks(client, auth_headers, db, save_section, seed_sections):
    now = utcnow()
    for cid, offset in (("conv_m_1", 0), ("conv_m_2", 0), ("conv_m_old", 40)):
        when = now - timedelta(days=offset)
        db.add(ConversationModel(id=cid, started_at=when, last_at=when, message_count=2))
        db.add(MessageModel(conversation_id=cid, role="user", content="Tell me about CodeLens!",
                            created_at=when, unanswered=(cid == "conv_m_2")))
        db.add(MessageModel(conversation_id=cid, role="assistant", content="Sure", created_at=when,
                            section="projects"))
    db.commit()
    save_section("seo", seed_sections["seo"])
    client.post("/api/admin/publish", headers=auth_headers)

    body = client.get("/api/admin/metrics?days=7&tz=330", headers=auth_headers).json()
    assert LEGACY_KEYS <= set(body)
    k = body["kirby"]
    assert k["conversations"] == 2 and k["messages"] == 4
    assert k["unanswered_rate"] == 0.5
    assert len(k["daily"]) == 7 and sum(d["messages"] for d in k["daily"]) == 4
    assert k["top_questions"] == [{"question": "Tell me about CodeLens!", "count": 2}]
    assert k["navigations"] == {"projects": 2}
    assert len(body["publishes"]) == 1 and body["publishes"][0]["created_at"].endswith("Z")


def test_empty_kirby_block(client, auth_headers):
    k = client.get("/api/admin/metrics?days=7", headers=auth_headers).json()["kirby"]
    assert k["conversations"] == 0 and k["unanswered_rate"] == 0.0 and k["top_questions"] == []
