from functools import wraps

from flask import current_app, g, jsonify, request

from app.db import get_conn

ADMIN_GROUP = "admins"


def _get_or_create_user(conn, username: str, email: str, is_admin: bool):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, is_admin FROM users WHERE username = %s",
            (username,),
        )
        row = cur.fetchone()

    if row:
        user_id, existing_is_admin = row
        if existing_is_admin != is_admin:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_admin = %s WHERE id = %s",
                    (is_admin, user_id),
                )
            conn.commit()
        return str(user_id), is_admin

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, username, email, is_admin)
            VALUES (gen_random_uuid(), %s, %s, %s)
            ON CONFLICT (username) DO UPDATE SET is_admin = EXCLUDED.is_admin
            RETURNING id
            """,
            (username, email, is_admin),
        )
        user_id = cur.fetchone()[0]
    conn.commit()
    return str(user_id), is_admin


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        username = request.headers.get("Remote-User", "").strip()
        email = request.headers.get("Remote-Email", "").strip()
        groups_header = request.headers.get("Remote-Groups", "")

        if not username:
            bypass_user = current_app.config.get("DEV_AUTH_BYPASS_USER")
            if bypass_user:
                username = bypass_user
                email = current_app.config["DEV_AUTH_BYPASS_EMAIL"]
                groups_header = current_app.config["DEV_AUTH_BYPASS_GROUPS"]

        if not username:
            return jsonify({"error": "Missing identity"}), 401

        groups = [
            grp.strip()
            for grp in groups_header.split(",")
            if grp.strip()
        ]
        is_admin = ADMIN_GROUP in groups

        conn = get_conn()
        user_id, is_admin = _get_or_create_user(conn, username, email, is_admin)

        g.user_id = user_id
        g.username = username
        g.is_admin = is_admin
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if not g.is_admin:
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated
