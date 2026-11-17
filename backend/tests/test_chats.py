"""Tests for admin conversation browsing, filtering, and detail inspection."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.chat import ConversationModel, MessageModel
from app.utils.time import utcnow


@pytest.fixture
def sample_conversations(db: Session):
    """Seed test conversations with various states and messages."""
    now = utcnow()

    # Conversation 1: Normal, starred, hero section
    c1 = ConversationModel(
        id="convo_1",
        visitor_id="visitor_1",
        started_at=now,
        last_at=now,
        message_count=2,
        starred=True,
        archived=False,
        note="Interesting lead",
    )
    m1_user = MessageModel(
        conversation_id="convo_1",
        role="user",
        content="Tell me about your experience with Kubernetes cluster ops.",
        created_at=now,
        unanswered=False,
    )
    m1_asst = MessageModel(
        conversation_id="convo_1",
        role="assistant",
        content="I have managed enterprise Kubernetes clusters.",
        created_at=now,
        section="experience",
        mood="proud",
    )
    c1.messages = [m1_user, m1_asst]

    # Conversation 2: Unanswered question, not starred
    c2 = ConversationModel(
        id="convo_2",
        visitor_id="visitor_2",
        started_at=now,
        last_at=now,
        message_count=2,
        starred=False,
        archived=False,
    )
    m2_user = MessageModel(
        conversation_id="convo_2",
        role="user",
        content="What is your favorite cooking recipe?",
        created_at=now,
        unanswered=True,  # Kirby could not answer
    )
    m2_asst = MessageModel(
        conversation_id="convo_2",
        role="assistant",
        content="I only know about Soumil's professional portfolio!",
        created_at=now,
        section="hero",
        mood="confused",
    )
    c2.messages = [m2_user, m2_asst]

    # Conversation 3: Archived conversation
    c3 = ConversationModel(
        id="convo_3",
        visitor_id="visitor_3",
        started_at=now,
        last_at=now,
        message_count=2,
        starred=False,
        archived=True,
    )
    m3_user = MessageModel(
        conversation_id="convo_3",
        role="user",
        content="Spam message here.",
        created_at=now,
        unanswered=False,
    )
    m3_asst = MessageModel(
        conversation_id="convo_3",
        role="assistant",
        content="Hello!",
        created_at=now,
    )
    c3.messages = [m3_user, m3_asst]

    db.add_all([c1, c2, c3])
    db.commit()
    return c1, c2, c3


def test_conversations_auth_required(client: TestClient):
    """Conversations endpoints require admin authentication."""
    assert client.get("/api/admin/conversations").status_code == 401
    assert client.get("/api/admin/conversations/convo_1").status_code == 401


def test_conversations_list_shape_and_fields(
    client: TestClient, auth_headers: dict, sample_conversations
):
    """GET /conversations returns {items, total} and ConversationOut fields."""
    res = client.get("/api/admin/conversations", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    # By default, archived=False, so convo_1 and convo_2 are returned
    assert data["total"] == 2
    assert len(data["items"]) == 2

    first = data["items"][0]
    required_fields = {
        "id", "preview", "started_at", "last_at", "messages",
        "starred", "archived", "note", "has_unanswered"
    }
    assert required_fields.issubset(first.keys())
    assert isinstance(first["messages"], int)
    assert isinstance(first["has_unanswered"], bool)


def test_conversations_q_search_filter(
    client: TestClient, auth_headers: dict, sample_conversations
):
    """Filter conversations by case-insensitive message content substring."""
    res = client.get("/api/admin/conversations?q=kubernetes", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == "convo_1"

    res_empty = client.get("/api/admin/conversations?q=nonexistent_string_123", headers=auth_headers)
    assert res_empty.status_code == 200
    assert len(res_empty.json()["items"]) == 0


def test_conversations_starred_and_archived_filters(
    client: TestClient, auth_headers: dict, sample_conversations
):
    """Filter by starred and archived flags."""
    # Starred
    res_starred = client.get("/api/admin/conversations?starred=true", headers=auth_headers)
    assert res_starred.status_code == 200
    items_starred = res_starred.json()["items"]
    assert len(items_starred) == 1
    assert items_starred[0]["id"] == "convo_1"

    # Archived = True
    res_archived = client.get("/api/admin/conversations?archived=true", headers=auth_headers)
    assert res_archived.status_code == 200
    items_archived = res_archived.json()["items"]
    assert len(items_archived) == 1
    assert items_archived[0]["id"] == "convo_3"


def test_conversations_unanswered_filter(
    client: TestClient, auth_headers: dict, sample_conversations
):
    """Filter by unanswered=true returns only conversations with unanswered messages."""
    res_unanswered = client.get("/api/admin/conversations?unanswered=true", headers=auth_headers)
    assert res_unanswered.status_code == 200
    items = res_unanswered.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == "convo_2"
    assert items[0]["has_unanswered"] is True

    res_answered = client.get("/api/admin/conversations?unanswered=false", headers=auth_headers)
    assert res_answered.status_code == 200
    items_ans = res_answered.json()["items"]
    assert len(items_ans) == 1
    assert items_ans[0]["id"] == "convo_1"
    assert items_ans[0]["has_unanswered"] is False


def test_conversation_detail_endpoint(
    client: TestClient, auth_headers: dict, sample_conversations
):
    """GET /conversations/{id} includes full messages array with all fields."""
    res = client.get("/api/admin/conversations/convo_1", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "convo_1"
    assert data["starred"] is True
    assert data["note"] == "Interesting lead"
    assert len(data["messages"]) == 2

    msg_user, msg_asst = data["messages"]
    assert msg_user["role"] == "user"
    assert "Kubernetes" in msg_user["content"]
    assert msg_user["at"].endswith("Z")
    assert msg_user["unanswered"] is False

    assert msg_asst["role"] == "assistant"
    assert msg_asst["section"] == "experience"
    assert msg_asst["mood"] == "proud"


def test_conversation_detail_unknown_id_returns_404(
    client: TestClient, auth_headers: dict
):
    """Unknown conversation ID returns 404."""
    res = client.get("/api/admin/conversations/nonexistent_xyz", headers=auth_headers)
    assert res.status_code == 404
    assert res.json() == {"detail": "Conversation not found"}
