"""Turns content sections into searchable text chunks for Kirby (spec 9.2)."""
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

MAX_NOTE_CHUNK = 800


@dataclass(frozen=True)
class Chunk:
    source: str              # content | note | faq
    section: Optional[str]   # page section Kirby can navigate to, or None
    item_id: Optional[str]
    text: str


def _join(*parts: str) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


def _list(label: str, values: List[str]) -> str:
    return f"{label}: {', '.join(values)}." if values else ""


def split_note(text: str, limit: int = MAX_NOTE_CHUNK) -> List[str]:
    """Split on blank lines and pack paragraphs into chunks of at most `limit` characters."""
    chunks: List[str] = []
    current = ""
    for para in (p.strip() for p in text.replace("\r\n", "\n").split("\n\n")):
        if not para:
            continue
        while len(para) > limit:  # a single oversized paragraph is hard-split
            if current:
                chunks.append(current)
                current = ""
            cut = para.rfind(" ", 0, limit)
            cut = cut if cut > limit // 2 else limit
            chunks.append(para[:cut].strip())
            para = para[cut:].strip()
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= limit:
            current = candidate
        else:
            chunks.append(current)
            current = para
    if current:
        chunks.append(current)
    return chunks


def build_chunks(sections: Dict[str, Any]) -> List[Chunk]:
    """Build chunks from a {key: section_data} mapping (published or draft)."""
    out: List[Chunk] = []
    profile = sections.get("profile") or {}
    owner = profile.get("name") or "The site owner"

    if profile:
        out.append(Chunk("content", "hero", None, _join(
            f"{owner} is {profile.get('role', '')}".strip() + ".",
            f"Based in {profile['location']}." if profile.get("location") else "",
            f"Status: {profile['status']}." if profile.get("status") else "",
            "Open to work." if profile.get("open_to_work") else "Not currently looking for work.",
        )))

    about = sections.get("about") or {}
    facts = about.get("facts") or []
    if facts:
        out.append(Chunk("content", "about", None,
                         f"About {owner}: " + " ".join(f"{f['label']}: {f['value']}." for f in facts)))
    for paragraph in about.get("paragraphs") or []:
        out.append(Chunk("content", "about", None, paragraph))

    for item in (sections.get("projects") or {}).get("items") or []:
        if item.get("hidden"):
            continue
        out.append(Chunk("content", "projects", item.get("id"), _join(
            f"Project {item['name']}: {item['description']}",
            _list("Tech", item.get("tags") or []),
            f"GitHub: {item['github']}." if item.get("github") else "",
            f"Live demo: {item['live']}." if item.get("live") else "",
        )))

    for item in (sections.get("experience") or {}).get("items") or []:
        if item.get("hidden"):
            continue
        dur = f", {item['dur']}" if item.get("dur") else ""
        out.append(Chunk("content", "experience", item.get("id"), _join(
            f"{item['kicker']}: {item['role']} at {item['name']} ({item['when']}{dur}).",
            " ".join(p.rstrip(".") + "." for p in item.get("points") or []),
            _list("Tools", item.get("tools") or []),
        )))

    for group in (sections.get("skills") or {}).get("groups") or []:
        out.append(Chunk("content", "about", group.get("id"), _join(
            f"Skills in {group['name']}: {', '.join(group.get('pills') or [])}.",
            group.get("tagline") or "",
        )))

    contact = sections.get("contact") or {}
    if contact:
        out.append(Chunk("content", "contact", None, _join(
            f"Contact {owner}: email {contact.get('email')}.",
            f"GitHub: {contact['github']}." if contact.get("github") else "",
            f"LinkedIn: {contact['linkedin']}." if contact.get("linkedin") else "",
            "A resume PDF is available on the site." if contact.get("resume_asset_id") else "",
            " ".join(f"{l['label']}: {l['url']}." for l in contact.get("extra_links") or []),
        )))

    knowledge = sections.get("knowledge") or {}
    for note in knowledge.get("notes") or []:
        for piece in split_note(note["text"]):
            out.append(Chunk("note", None, note.get("id"), f"{note['title']}: {piece}"))
    for faq in knowledge.get("faq") or []:
        out.append(Chunk("faq", None, faq.get("id"), f"Q: {faq['q']} A: {faq['a']}"))

    return out
