import secrets
import uuid

from flask import Blueprint, jsonify, request, g

from app import auth as auth_helpers
from app.db import get_conn

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

REFRESH_COOKIE = "refresh_token"
COOKIE_OPTS = dict(httponly=True, secure=True, samesite="Strict", path="/api/auth")


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    token = (data.get("invite_token") or "").strip()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not token or not username or not password:
        return jsonify({"error": "invite_token, username and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM users WHERE invite_token = %s",
            (token,),
        )
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "Invalid or expired invite token"}), 400

    user_id = str(row[0])
    password_hash = auth_helpers.hash_password(password)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET username = %s, password_hash = %s, invite_token = NULL
            WHERE id = %s AND invite_token IS NOT NULL
            """,
            (username, password_hash, user_id),
        )
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify({"error": "Invalid or expired invite token"}), 400
    conn.commit()

    return jsonify({"message": "Registration complete. You can now log in."}), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, password_hash, is_admin FROM users WHERE username = %s AND invite_token IS NULL",
            (username,),
        )
        row = cur.fetchone()

    if not row or not auth_helpers.check_password(password, row[1]):
        return jsonify({"error": "Invalid credentials"}), 401

    user_id, _, is_admin = row
    access, refresh_raw = auth_helpers.issue_tokens(conn, str(user_id), username, is_admin)

    resp = jsonify({"access_token": access})
    resp.set_cookie(REFRESH_COOKIE, refresh_raw, **COOKIE_OPTS)
    return resp


@bp.post("/refresh")
def refresh():
    refresh_raw = request.cookies.get(REFRESH_COOKIE)
    if not refresh_raw:
        return jsonify({"error": "No refresh token"}), 401

    conn = get_conn()
    access, new_refresh = auth_helpers.rotate_refresh_token(conn, refresh_raw)
    if not access:
        return jsonify({"error": "Invalid or expired refresh token"}), 401

    resp = jsonify({"access_token": access})
    resp.set_cookie(REFRESH_COOKIE, new_refresh, **COOKIE_OPTS)
    return resp


@bp.post("/logout")
@auth_helpers.require_auth
def logout():
    refresh_raw = request.cookies.get(REFRESH_COOKIE)
    if refresh_raw:
        auth_helpers.revoke_refresh_token(get_conn(), refresh_raw)

    resp = jsonify({"message": "Logged out"})
    resp.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    return resp


# ── Admin endpoints ────────────────────────────────────────────────────────────

@bp.post("/invite")
@auth_helpers.require_admin
def create_invite():
    """Admin: create a pending user row with an invite token."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email is required"}), 400

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409

    invite_token = secrets.token_urlsafe(32)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, username, password_hash, invite_token)
            VALUES (gen_random_uuid(), %s, %s, '', %s)
            """,
            (email, f"pending_{uuid.uuid4().hex[:8]}", invite_token),
        )
    conn.commit()

    return jsonify({"invite_token": invite_token}), 201


@bp.get("/users")
@auth_helpers.require_admin
def list_users():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, username, email, is_admin, created_at,
                   (invite_token IS NOT NULL) AS pending
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
