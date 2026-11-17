"""0002_content: content sections, publishes, revisions, assets

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-17 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "content_sections",
        sa.Column("key", sa.String(32), primary_key=True),
        sa.Column("draft", json_type, nullable=False),
        sa.Column("published", json_type, nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("draft_updated_at", sa.DateTime(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "publishes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("sections", json_type, nullable=False),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reindex_status", sa.String(12), nullable=False),
        sa.Column("deploy_status", sa.String(12), nullable=False),
        sa.Column("deploy_ref", sa.String(120), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "content_revisions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "section_key", sa.String(32),
            sa.ForeignKey("content_sections.key", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("data", json_type, nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("publish_id", sa.Integer(), sa.ForeignKey("publishes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_content_revisions_section_key", "content_revisions", ["section_key"])

    op.create_table(
        "assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("storage_id", sa.String(255), nullable=False),
        sa.Column("mime", sa.String(50), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("assets")
    op.drop_index("ix_content_revisions_section_key", table_name="content_revisions")
    op.drop_table("content_revisions")
    op.drop_table("publishes")
    op.drop_table("content_sections")
