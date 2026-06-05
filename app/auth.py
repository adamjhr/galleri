import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from flask import current_app, g, jsonify, request


def hash_password(plaintext: str) -> str:
    return bcrypt.hashpw(plaintext.encode(), bcrypt.gensalt(rounds=12)).decode()


def check_password(plaintext: str, hashed: str) -> bool:
    return bcrypt.checkpw(plaintext.encode(), hashed.encode())


def _make_access_token(user_id: str, username: str, is_admin: bool) -> str:
    cfg = current_app.config
    exp = datetime.now(timezone.utc) + timedelta(minutes=cfg["JWT_ACCESS_EXPIRES_MINUTES"])
    return jwt.encode(
        {"sub": user_id, "username": username, "is_admin": is_admin, "exp": exp},
        cfg["JWT_SECRET"],
        algorithm="HS256",
    )


def _make_refresh_token() -> str:
    return str(uuid.uuid4())


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_tokens(conn, user_id: str, username: str, is_admin: bool):
    cfg = current_app.config
    access = _make_access_token(user_id, username, is_admin)
    refresh_raw = _make_refresh_token()
    refresh_hash = _hash_token(refresh_raw)
    expires_at = datetime.now(timezone.utc) + timedelta(days=cfg["JWT_REFRESH_EXPIRES_DAYS"])

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
            VALUES (gen_random_uuid(), %s, %s, %s)
            """,
            (user_id, refresh_hash, expires_at),
        )
    conn.commit()
    return access, refresh_raw


def revoke_refresh_token(conn, raw_token: str):
    token_hash = _hash_token(raw_token)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE refresh_tokens SET revoked = true WHERE token_hash = %s",
            (token_hash,),
        )
    conn.commit()


def rotate_refresh_token(conn, raw_token: str):
    """Validate old refresh token, revoke it, issue a new pair."""
    token_hash = _hash_token(raw_token)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT rt.user_id, u.username, u.is_admin
            FROM refresh_tokens rt
            JOIN users u ON u.id = rt.user_id
            WHERE rt.token_hash = %s
              AND rt.revoked = false
              AND rt.expires_at > now()
            """,
            (token_hash,),
        )
        row = cur.fetchone()

    if not row:
        return None, None

    user_id, username, is_admin = row
    revoke_refresh_token(conn, raw_token)
    return issue_tokens(conn, str(user_id), username, is_admin)


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth_header[7:]
        try:
            payload = jwt.decode(
                token,
                current_app.config["JWT_SECRET"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        g.user_id = payload["sub"]
        g.username = payload["username"]
        g.is_admin = payload.get("is_admin", False)
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
