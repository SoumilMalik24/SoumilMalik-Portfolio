"""Managing conversations (star/archive/note/delete) and the unanswered-questions loop."""
from datetime import timedelta

from app.models.chat import ConversationModel, MessageModel
from app.utils.time import utcnow


def _chat(db, cid, questions, unanswered=True, days_ago=0):
    when = utcnow() - timedelta(days=days_ago)
    convo = ConversationModel(id=cid, visitor_id=None, started_at=when, last_at=when, message_count=0)
    db.add(convo)
    for q in questions:
        db.add(MessageModel(conversation_id=cid, role="user", content=q, created_at=when, unanswered=unanswered))
        db.add(MessageModel(conversation_id=cid, role="assistant", content="Not sure!", created_at=when))
        convo.message_count += 2
    db.commit()


def test_patch_conversation(client, auth_headers, db):
    _chat(db, "conv_patch_1", ["hello?"], unanswered=False)
    url = "/api/admin/conversations/conv_patch_1"
    body = client.patch(url, json={"starred": True, "note": "  follow up  "}, headers=auth_headers).json()
    assert body["starred"] is True and body["note"] == "follow up" and body["archived"] is False
    body = client.patch(url, json={"archived": True}, headers=auth_headers).json()
    assert body["archived"] is True and body["note"] == "follow up"
    body = client.patch(url, json={"note": None}, headers=auth_headers).json()
    assert body["note"] is None and body["starred"] is True
    assert client.patch(url, json={"bogus": 1}, headers=auth_headers).status_code == 422
    assert client.patch("/api/admin/conversations/nope", json={}, headers=auth_headers).status_code == 404


def test_delete_conversation(client, auth_headers, db):
    _chat(db, "conv_delete_1", ["bye?"])
    url = "/api/admin/conversations/conv_delete_1"
    assert client.delete(url, headers=auth_headers).status_code == 204
    assert client.get(url, headers=auth_headers).status_code == 404
    assert db.query(MessageModel).filter_by(conversation_id="conv_delete_1").count() == 0


def test_search_escapes_wildcards(client, auth_headers, db):
    _chat(db, "conv_pct_1", ["is it 100% remote?"], unanswered=False)
    _chat(db, "conv_pct_2", ["is it 100 remote?"], unanswered=False)
    items = client.get("/api/admin/conversations?q=100%25", headers=auth_headers).json()["items"]
    assert [i["id"] for i in items] == ["conv_pct_1"]


def test_unanswered_grouping(client, auth_headers, db):
    _chat(db, "conv_u_1", ["What is his salary?"])
    _chat(db, "conv_u_2", ["what is his  salary"])
    _chat(db, "conv_u_3", ["WHAT IS HIS SALARY!!"])
    _chat(db, "conv_u_4", ["Does he like cats?"])
    _chat(db, "conv_u_5", ["old question"], days_ago=60)
    _chat(db, "conv_u_6", ["answered one"], unanswered=False)
    items = client.get("/api/admin/questions/unanswered?days=30", headers=auth_headers).json()["items"]
    counts = {i["question"].lower(): i["count"] for i in items}
    assert "old question" not in counts and "answered one" not in counts
    assert items[0]["count"] == 3 and len(items) == 2
    assert sorted(items[0]["conversation_ids"]) == ["conv_u_1", "conv_u_2", "conv_u_3"]
    assert counts["does he like cats?"] == 1


def test_answer_adds_faq_to_knowledge_draft(client, auth_headers, save_section, seed_sections):
    resp = client.post("/api/admin/questions/answer",
                       json={"question": "Visa status?", "answer": "No sponsorship needed."}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == 1 and body["published"] is None
    assert body["draft"]["faq"] == [{"id": "visa-status", "q": "Visa status?", "a": "No sponsorship needed."}]

    save_section("knowledge", seed_sections["knowledge"])
    body = client.post("/api/admin/questions/answer", json={"question": "Notice period?", "answer": "Immediate."},
                       headers=auth_headers).json()
    assert len(body["draft"]["faq"]) == len(seed_sections["knowledge"]["faq"]) + 1
    assert body["draft"]["notes"] == seed_sections["knowledge"]["notes"]
