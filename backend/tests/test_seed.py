"""`python -m app.cli seed-content` with the real seed file."""
import json

import pytest
from sqlalchemy import select

from app.cli import main
from app.models.content import ContentSection
from tests.conftest import SEED_FILE


def test_seed_real_file_publishes_everything(client, db, capsys):
    main(["seed-content", "--file", str(SEED_FILE)])
    out = capsys.readouterr().out
    assert "Published 9 section(s)" in out

    rows = db.scalars(select(ContentSection)).all()
    assert len(rows) == 9 and all(r.published == r.draft and r.version == 1 for r in rows)

    public = client.get("/api/content").json()
    assert public["version"] == 1 and len(public["sections"]) == 8
    assert public["sections"]["profile"]["name"] == "Soumil Malik"


def test_seed_skips_existing_unless_forced(db, tmp_path, capsys):
    main(["seed-content", "--file", str(SEED_FILE)])
    capsys.readouterr()
    main(["seed-content", "--file", str(SEED_FILE)])
    assert "Nothing to seed." in capsys.readouterr().out

    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    data["sections"] = {"profile": dict(data["sections"]["profile"], role="Changed Role")}
    custom = tmp_path / "seed.json"
    custom.write_text(json.dumps(data), encoding="utf-8")
    main(["seed-content", "--file", str(custom), "--force"])
    db.expire_all()
    assert db.get(ContentSection, "profile").published["role"] == "Changed Role"


def test_seed_rejects_invalid_file(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"sections": {"profile": {"name": ""}}}), encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        main(["seed-content", "--file", str(bad)])
    assert exc.value.code == 1
