"""Command-line interface (CLI) for database migrations and admin management."""
import argparse
import getpass
import sys
from pathlib import Path
from typing import List, Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import select

from app.constants import PHONE_REGEX
from app.db import SessionLocal
from app.models.admin import Admin
from app.services.audit import log_audit
from app.services.auth.passwords import hash_password, validate_password_policy
from app.services.auth.sessions import revoke_all_sessions
from app.utils.time import utcnow


def _check_policy(password: str, email: str) -> None:
    """Exit with each policy problem printed, instead of a generic message."""
    from app.errors import ApiError

    try:
        validate_password_policy(password, email=email)
    except ApiError as exc:
        for err in exc.errors or [{"msg": exc.detail}]:
            sys.stderr.write(f"Error: {err['msg']}\n")
        sys.exit(1)


def run_migrate() -> None:
    """Run alembic upgrade head programmatically."""
    ini_path = Path("alembic.ini").resolve()
    if not ini_path.is_file():
        sys.stderr.write("Error: alembic.ini not found in current directory\n")
        sys.exit(1)
    cfg = Config(str(ini_path))
    command.upgrade(cfg, "head")
    print("Database migrations applied successfully.")


def run_create_admin(args: argparse.Namespace) -> None:
    """Create a new admin user with password policy verification."""
    clean_email = args.email.strip().lower()
    clean_name = args.name.strip()
    if not clean_email or not clean_name:
        sys.stderr.write("Error: Email and Name cannot be empty\n")
        sys.exit(1)

    clean_phone: Optional[str] = None
    if args.phone:
        clean_phone = args.phone.strip()
        if not PHONE_REGEX.match(clean_phone):
            sys.stderr.write("Error: Invalid phone number format (must be E.164)\n")
            sys.exit(1)

    with SessionLocal() as db:
        existing = db.scalars(select(Admin).where(Admin.email == clean_email)).first()
        if existing:
            sys.stderr.write(f"Error: Admin with email {clean_email} already exists\n")
            sys.exit(1)

        if clean_phone:
            existing_phone = db.scalars(select(Admin).where(Admin.phone == clean_phone)).first()
            if existing_phone:
                sys.stderr.write(f"Error: Admin with phone {clean_phone} already exists\n")
                sys.exit(1)

        if args.password_stdin:
            password = sys.stdin.readline().rstrip("\r\n")
        else:
            p1 = getpass.getpass("Password: ")
            p2 = getpass.getpass("Confirm password: ")
            if p1 != p2:
                sys.stderr.write("Error: Passwords do not match\n")
                sys.exit(1)
            password = p1

        _check_policy(password, clean_email)

        now = utcnow()
        pw_hash = hash_password(password)
        admin = Admin(
            email=clean_email,
            phone=clean_phone,
            display_name=clean_name,
            password_hash=pw_hash,
            is_active=True,
            failed_logins=0,
            password_changed_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        log_audit(db, action="admin.create", admin_id=admin.id, target=clean_email)
        print(f"Admin {clean_email} created successfully.")


def run_reset_password(args: argparse.Namespace) -> None:
    """Reset an admin's password and revoke all sessions."""
    clean_email = args.email.strip().lower()

    with SessionLocal() as db:
        admin = db.scalars(select(Admin).where(Admin.email == clean_email)).first()
        if admin is None:
            sys.stderr.write(f"Error: Admin with email {clean_email} not found\n")
            sys.exit(1)

        if args.password_stdin:
            password = sys.stdin.readline().rstrip("\r\n")
        else:
            p1 = getpass.getpass("New password: ")
            p2 = getpass.getpass("Confirm password: ")
            if p1 != p2:
                sys.stderr.write("Error: Passwords do not match\n")
                sys.exit(1)
            password = p1

        _check_policy(password, clean_email)

        now = utcnow()
        admin.password_hash = hash_password(password)
        admin.password_changed_at = now
        admin.failed_logins = 0
        admin.locked_until = None
        admin.updated_at = now

        revoke_all_sessions(db, admin_id=admin.id)
        db.commit()

        log_audit(db, action="admin.password.reset", admin_id=admin.id, target=clean_email)
        print(f"Password reset for {clean_email} successfully.")


def run_list_admins() -> None:
    """List all registered admins."""
    with SessionLocal() as db:
        admins = db.scalars(select(Admin).order_by(Admin.id.asc())).all()
        header = f"{'ID':<4} {'EMAIL':<30} {'PHONE':<18} {'NAME':<20} {'ACTIVE':<8} {'LAST LOGIN'}"
        print(header)
        print("-" * len(header))
        for a in admins:
            ll = a.last_login_at.isoformat() if a.last_login_at else "never"
            print(f"{a.id:<4} {a.email:<30} {a.phone or '-':<18} {a.display_name:<20} {str(a.is_active):<8} {ll}")


def run_set_active(args: argparse.Namespace) -> None:
    """Toggle admin active state."""
    clean_email = args.email.strip().lower()
    is_active = args.active.lower() in ("true", "1", "yes")

    with SessionLocal() as db:
        admin = db.scalars(select(Admin).where(Admin.email == clean_email)).first()
        if admin is None:
            sys.stderr.write(f"Error: Admin with email {clean_email} not found\n")
            sys.exit(1)

        admin.is_active = is_active
        admin.updated_at = utcnow()
        if not is_active:
            revoke_all_sessions(db, admin_id=admin.id)
        db.commit()
        print(f"Admin {clean_email} active set to {is_active}.")


def run_seed_content(args: argparse.Namespace) -> None:
    """Load seed content into draft and published copies (skips existing sections unless --force)."""
    import json

    from app.constants import CONTENT_KEYS
    from app.errors import ApiError
    from app.models.content import Publish
    from app.services import content as content_service
    from app.services.public_content import clear_cache
    from app.services.publish import add_revision

    path = Path(args.file)
    if not path.is_file():
        sys.stderr.write(f"Error: seed file not found: {path}\n")
        sys.exit(1)
    try:
        sections = json.loads(path.read_text(encoding="utf-8"))["sections"]
    except (ValueError, KeyError, TypeError):
        sys.stderr.write('Error: seed file must be JSON shaped like {"sections": {key: data}}\n')
        sys.exit(1)

    unknown = [k for k in sections if k not in CONTENT_KEYS]
    if unknown:
        sys.stderr.write(f"Error: unknown sections in seed file: {', '.join(unknown)}\n")
        sys.exit(1)

    with SessionLocal() as db:
        normalized = {}
        for key in CONTENT_KEYS:
            if key not in sections:
                continue
            if content_service.get_row(db, key) is not None and not args.force:
                print(f"skip   {key} (already exists; use --force to overwrite)")
                continue
            try:
                normalized[key] = content_service.validate_section(db, key, sections[key], prefix=key)
            except ApiError as exc:
                for err in exc.errors or [{"field": key, "msg": exc.detail}]:
                    sys.stderr.write(f"Error: {err['field']}: {err['msg']}\n")
                sys.exit(1)

        if not normalized:
            print("Nothing to seed.")
            return

        now = utcnow()
        pub = Publish(sections=list(normalized), admin_id=None, reindex_status="skipped",
                      deploy_status="disabled", created_at=now, finished_at=now)
        db.add(pub)
        db.flush()
        for key, data in normalized.items():
            row = content_service.write_draft(db, key, data)
            row.version = 1
            row.published = data
            row.published_at = now
            db.flush()
            add_revision(db, key, data, "import", None, pub.id)
            print(f"seeded {key}")
        db.commit()
        clear_cache()
        print(f"Published {len(normalized)} section(s) as content version {pub.id}.")


def run_reindex() -> None:
    """Rebuild Kirby's knowledge index synchronously."""
    import json

    from app.services.kb import index as kb_index

    with SessionLocal() as db:
        try:
            kb_index.reindex(db)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"Error: re-index failed: {exc}\n")
            sys.exit(1)
        print(json.dumps(kb_index.get_status(db), indent=2))


def run_purge() -> None:
    """Apply the data-retention purge now."""
    from app.services.maintenance import purge

    with SessionLocal() as db:
        counts = purge(db)
    for name, n in counts.items():
        print(f"{name}: {n} deleted")


def main(argv: Optional[List[str]] = None) -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Portfolio Backend Admin CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # migrate
    subparsers.add_parser("migrate", help="Run database migrations")

    # create-admin
    p_create = subparsers.add_parser("create-admin", help="Create a new admin account")
    p_create.add_argument("--email", required=True, help="Admin email address")
    p_create.add_argument("--name", required=True, help="Display name")
    p_create.add_argument("--phone", default=None, help="E.164 phone number")
    p_create.add_argument("--password-stdin", action="store_true", help="Read password from standard input")

    # reset-password
    p_reset = subparsers.add_parser("reset-password", help="Reset an admin's password")
    p_reset.add_argument("--email", required=True, help="Admin email address")
    p_reset.add_argument("--password-stdin", action="store_true", help="Read password from standard input")

    # list-admins
    subparsers.add_parser("list-admins", help="List registered admin accounts")

    # set-active
    p_active = subparsers.add_parser("set-active", help="Set active status of an admin account")
    p_active.add_argument("--email", required=True, help="Admin email address")
    p_active.add_argument("--active", required=True, help="true or false")

    # seed-content
    p_seed = subparsers.add_parser("seed-content", help="Load initial content from a seed JSON file")
    p_seed.add_argument("--file", default="seed/content.seed.json", help="Path to the seed file")
    p_seed.add_argument("--force", action="store_true", help="Overwrite sections that already exist")

    subparsers.add_parser("reindex", help="Rebuild Kirby's knowledge index")
    subparsers.add_parser("purge", help="Delete data past its retention period")

    args = parser.parse_args(argv)

    if args.command == "migrate":
        run_migrate()
    elif args.command == "create-admin":
        run_create_admin(args)
    elif args.command == "reset-password":
        run_reset_password(args)
    elif args.command == "list-admins":
        run_list_admins()
    elif args.command == "set-active":
        run_set_active(args)
    elif args.command == "seed-content":
        run_seed_content(args)
    elif args.command == "reindex":
        run_reindex()
    elif args.command == "purge":
        run_purge()


if __name__ == "__main__":
    main()
