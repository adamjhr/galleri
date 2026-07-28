from flask import Blueprint, jsonify, g

from app import auth as auth_helpers
from app.db import get_conn

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.get("/me")
@auth_helpers.require_auth
def me():
    return jsonify({"username": g.username, "is_admin": g.is_admin})


@bp.get("/users")
@auth_helpers.require_admin
def list_users():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, username, email, is_admin, created_at
            FROM users
            ORDER BY created_at DESC
            """
        )
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    for r in rows:
        r["id"] = str(r["id"])
        if r["created_at"]:
            r["created_at"] = r["created_at"].isoformat()
    return jsonify(rows)
