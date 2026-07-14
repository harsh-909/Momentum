"""email verification: users.email/email_verified + email_verifications table

Adds mandatory-email support. Existing rows get email = NULL and
email_verified = false, so they keep loading but are gated to add + verify an
email on next login. The unique index on email is PARTIAL (verified rows only),
so abandoned unverified signups may reuse an address.

Mirrors app/db.py exactly.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-14

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "email_verified", sa.Boolean(), nullable=False, server_default="0"
        ),
    )
    # One account per *verified* email; unverified signups may reuse an address.
    op.create_index(
        "users_verified_email_uq",
        "users",
        ["email"],
        unique=True,
        sqlite_where=sa.text("email_verified = 1"),
        postgresql_where=sa.text("email_verified"),
    )

    op.create_table(
        "email_verifications",
        sa.Column("token_hash", sa.Text(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "email_verifications_user_id_idx", "email_verifications", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "email_verifications_user_id_idx", table_name="email_verifications"
    )
    op.drop_table("email_verifications")
    op.drop_index("users_verified_email_uq", table_name="users")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "email")
