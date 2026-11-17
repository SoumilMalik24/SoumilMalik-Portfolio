"""Validation schemas for every content section (spec section 7.4).

Each section is stored as the normalized JSON produced by `model_dump(mode="json")`.
List items get a stable `id`: explicit ids are kept (duplicates rejected), missing ones are
derived from the item's name and de-duplicated.
"""
import re
import secrets
import string
from typing import Annotated, Any, Dict, List, Literal, Optional, Type
from urllib.parse import urlparse

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    model_validator,
)

# ---------------------------------------------------------------------------
# Shared field types
# ---------------------------------------------------------------------------


def Text(min_len: int, max_len: int) -> Any:
    """Stripped string with length bounds."""
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=min_len, max_length=max_len)]


SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
FACE_RE = re.compile(r"^[a-z-]{1,20}$")


def _https_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or " " in value:
        raise ValueError("Must be an https:// URL")
    return value


def _link_url(value: str) -> str:
    if value.startswith("mailto:"):
        address = value[len("mailto:"):]
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", address.split("?", 1)[0]):
            raise ValueError("Invalid mailto: address")
        return value
    return _https_url(value)


def _markup_line(value: str) -> str:
    if "<" in value or ">" in value:
        raise ValueError("HTML is not allowed; use **bold** for emphasis")
    return value


def _hex(value: str) -> str:
    if not HEX_RE.fullmatch(value):
        raise ValueError("Must be a hex color like #1a2b3c")
    return value


def _slug(value: str) -> str:
    if not SLUG_RE.fullmatch(value):
        raise ValueError("Must be lowercase letters, digits and dashes (max 40)")
    return value


def _face(value: str) -> str:
    if not FACE_RE.fullmatch(value):
        raise ValueError("Must be lowercase letters and dashes (max 20)")
    return value


Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500), AfterValidator(_https_url)]
LinkUrl = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500), AfterValidator(_link_url)]
HexColor = Annotated[str, StringConstraints(strip_whitespace=True), AfterValidator(_hex)]
MarkupLine = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160), AfterValidator(_markup_line)
]
Slug = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]
AssetId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=36)]
Mood = Literal["happy", "excited", "proud", "curious", "playful", "thinking", "confused", "shy", "laughing"]


class Strict(BaseModel):
    """Base for all section models: unknown keys are rejected."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------------------------------------------------------------------------
# Id assignment
# ---------------------------------------------------------------------------


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40].strip("-")
    return slug


def _random_slug() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def assign_ids(items: List[Any], name_attr: str) -> None:
    """Keep explicit ids (must be unique and valid), derive missing ones from `name_attr`."""
    taken: set = set()
    for item in items:
        if item.id:
            _slug(item.id)
            if item.id in taken:
                raise ValueError(f"Duplicate id '{item.id}'")
            taken.add(item.id)
    for item in items:
        if item.id:
            continue
        base = slugify(getattr(item, name_attr, "") or "") or _random_slug()
        candidate, n = base, 2
        while candidate in taken:
            suffix = f"-{n}"
            candidate = base[: 40 - len(suffix)] + suffix
            n += 1
        item.id = candidate
        taken.add(candidate)


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


class ProfileSection(Strict):
    name: Text(1, 60)
    role: Text(1, 80)
    location: Text(0, 80) = ""
    status: Text(0, 80) = ""
    open_to_work: bool = True
    portrait_asset_id: Optional[AssetId] = None


class Fact(Strict):
    label: Text(1, 30)
    value: Text(1, 80)


class AboutSection(Strict):
    facts: List[Fact] = Field(default_factory=list, max_length=8)
    paragraphs: List[Text(1, 1200)] = Field(default_factory=list, max_length=5)


class Project(Strict):
    id: Optional[Slug] = None
    num: Text(0, 4) = ""
    name: Text(1, 80)
    description: Text(1, 800)
    tags: List[Text(1, 30)] = Field(default_factory=list, max_length=12)
    github: Optional[Url] = None
    live: Optional[Url] = None
    image_asset_id: Optional[AssetId] = None
    hidden: bool = False


class ProjectsSection(Strict):
    items: List[Project] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def _ids(self) -> "ProjectsSection":
        assign_ids(self.items, "name")
        return self


class ExperienceItem(Strict):
    id: Optional[Slug] = None
    kicker: Text(1, 30)
    name: Text(1, 60)
    role: Text(1, 120)
    when: Text(1, 40)
    dur: Text(0, 20) = ""
    points: List[Text(1, 200)] = Field(default_factory=list, max_length=8)
    tools: List[Text(1, 30)] = Field(default_factory=list, max_length=8)
    hidden: bool = False


class NextCard(Strict):
    enabled: bool = True
    kicker: Text(0, 30) = ""
    name: Text(0, 60) = ""
    role: Text(0, 160) = ""


class ExperienceSection(Strict):
    items: List[ExperienceItem] = Field(default_factory=list, max_length=20)
    next_card: NextCard = Field(default_factory=NextCard)

    @model_validator(mode="after")
    def _ids(self) -> "ExperienceSection":
        assign_ids(self.items, "name")
        return self


class SkillGroup(Strict):
    id: Optional[Slug] = None
    name: Text(1, 40)
    bg: HexColor
    text: HexColor
    pills: List[Text(1, 40)] = Field(min_length=1, max_length=20)
    tagline: Text(0, 120) = ""
    featured: List[Text(1, 40)] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _pills(self) -> "SkillGroup":
        if len(set(self.pills)) != len(self.pills):
            raise ValueError("Skills in a group must be unique")
        missing = [f for f in self.featured if f not in self.pills]
        if missing:
            raise ValueError(f"Featured skills must also be in pills: {', '.join(missing)}")
        return self


class SkillsSection(Strict):
    groups: List[SkillGroup] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _ids(self) -> "SkillsSection":
        assign_ids(self.groups, "name")
        return self


class ExtraLink(Strict):
    label: Text(1, 30)
    url: LinkUrl


class ContactSection(Strict):
    email: EmailStr
    github: Optional[Url] = None
    linkedin: Optional[Url] = None
    resume_asset_id: Optional[AssetId] = None
    extra_links: List[ExtraLink] = Field(default_factory=list, max_length=6)


class SeoSection(Strict):
    title: Text(1, 70)
    description: Text(1, 200)
    og_description: Text(0, 200) = ""
    site_url: Optional[Url] = None
    og_image_asset_id: Optional[AssetId] = None


class TourEntry(Strict):
    state: Mood
    face: Optional[Annotated[str, AfterValidator(_face)]] = None
    lines: List[MarkupLine] = Field(min_length=1, max_length=10)


class Tour(Strict):
    hero: TourEntry
    about: TourEntry
    projects: TourEntry
    experience: TourEntry
    contact: TourEntry


class KirbySection(Strict):
    enabled: bool = True
    display_name: Text(1, 30) = "Kirby"
    tone: Text(0, 300) = ""
    model: Optional[Text(1, 80)] = None
    fallback_reply: Text(1, 200)
    daily_message_cap: int = Field(default=300, ge=0, le=5000)
    tour: Tour


class Note(Strict):
    id: Optional[Slug] = None
    title: Text(1, 80)
    text: Text(1, 4000)


class Faq(Strict):
    id: Optional[Slug] = None
    q: Text(1, 300)
    a: Text(1, 1000)


class KnowledgeSection(Strict):
    notes: List[Note] = Field(default_factory=list, max_length=50)
    faq: List[Faq] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _ids(self) -> "KnowledgeSection":
        assign_ids(self.notes, "title")
        assign_ids(self.faq, "q")
        return self


SECTION_SCHEMAS: Dict[str, Type[Strict]] = {
    "profile": ProfileSection,
    "about": AboutSection,
    "projects": ProjectsSection,
    "experience": ExperienceSection,
    "skills": SkillsSection,
    "contact": ContactSection,
    "seo": SeoSection,
    "kirby": KirbySection,
    "knowledge": KnowledgeSection,
}

# Where each section references uploaded assets: (dotted path template, asset kind).
# "items[].image_asset_id" means the field on every element of `items`.
ASSET_FIELDS: Dict[str, List[tuple]] = {
    "profile": [("portrait_asset_id", "image")],
    "projects": [("items[].image_asset_id", "image")],
    "contact": [("resume_asset_id", "resume")],
    "seo": [("og_image_asset_id", "image")],
}


# ---------------------------------------------------------------------------
# Request / response bodies
# ---------------------------------------------------------------------------


class SaveSectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data: Dict[str, Any]
    version: int = Field(ge=0)


class SectionState(BaseModel):
    key: str
    draft: Optional[Dict[str, Any]]
    published: Optional[Dict[str, Any]]
    version: int
    dirty: bool
    draft_updated_at: Optional[str]
    published_at: Optional[str]


class AllSections(BaseModel):
    sections: Dict[str, SectionState]
