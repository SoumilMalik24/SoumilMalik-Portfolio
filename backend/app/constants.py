import re

SECTIONS = ["hero", "about", "projects", "experience", "contact"]
MOODS = ["happy", "excited", "proud", "curious", "playful", "thinking", "confused", "shy", "laughing"]
CONTENT_KEYS = ["profile", "about", "projects", "experience", "skills", "contact", "seo", "kirby", "knowledge"]
KB_KEYS = [k for k in CONTENT_KEYS if k != "seo"]

ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
BOT_REGEX = re.compile(r"bot|crawl|spider|headless|lighthouse", re.IGNORECASE)
MAX_MESSAGE_CHARS = 4000
PHONE_REGEX = re.compile(r"^\+[1-9]\d{7,14}$")

APP_VERSION = "2.0.0"
