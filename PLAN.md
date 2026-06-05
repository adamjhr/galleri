# Galleri — Application Plan

## Overview

A private, invite-only gallery application for uploading, viewing, and downloading images. Images are stored in a DigitalOcean Spaces bucket and served via the DO CDN endpoint. The Flask backend and plain HTML/JS frontend are hosted together on one Debian 12 app server; PostgreSQL runs on a separate Debian 12 database server.

---

## Architecture

```
Browser
  │
  ▼ (HTTPS)
Nginx (already configured, TLS in place)
  │
  ▼
Flask App (Gunicorn, systemd service)
  │                    │
  ▼                    ▼
PostgreSQL          DO Spaces bucket (private)
(DB server)           │
                      ▼
                   DO CDN endpoint
          https://adamjhr-storage.ams3.cdn.digitaloceanspaces.com
```

---

## Technology Stack

| Layer | Choice |
|---|---|
| Backend language | Python 3 |
| Web framework | Flask |
| WSGI server | Gunicorn |
| Process manager | systemd |
| Reverse proxy | Nginx (already in place) |
| Frontend | Plain HTML + vanilla JS (no build step) |
| Database | PostgreSQL (separate server) |
| DB driver | psycopg2 |
| Auth | JWT (access + refresh tokens), bcrypt passwords |
| Object storage | DigitalOcean Spaces (S3-compatible) |
| Bucket SDK | boto3 |
| CDN | DO CDN — `https://adamjhr-storage.ams3.cdn.digitaloceanspaces.com` |

---

## Project Structure

```
galleri/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── config.py            # Config from environment
│   ├── db.py                # psycopg2 connection pool
│   ├── auth.py              # JWT helpers, bcrypt
│   ├── storage.py           # boto3 / DO Spaces helpers
│   ├── routes/
│   │   ├── auth.py          # /api/auth/*
│   │   └── images.py        # /api/images/*
│   └── static/
│       ├── index.html
│       ├── login.html
│       ├── css/
│       └── js/
├── migrations/
│   └── 001_initial.sql
├── .env.example
├── requirements.txt
├── wsgi.py
└── PLAN.md
```

---

## Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| username | TEXT UNIQUE NOT NULL | |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | bcrypt |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| is_admin | BOOLEAN NOT NULL DEFAULT false | |
| invite_token | TEXT UNIQUE | set when invite is issued, cleared on first login |

### `images`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| bucket_key | TEXT NOT NULL | GUID (no extension) — object name in Spaces |
| name | TEXT NOT NULL | Human-readable label |
| description | TEXT | Optional |
| mime_type | TEXT NOT NULL | e.g. `image/jpeg` |
| file_size | BIGINT NOT NULL | Bytes |
| uploaded_by | UUID NOT NULL FK → users.id | |
| uploaded_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| deleted | BOOLEAN NOT NULL DEFAULT false | Soft delete |

### `refresh_tokens`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL FK → users.id | |
| token_hash | TEXT NOT NULL | SHA-256 of the raw token |
| issued_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| expires_at | TIMESTAMPTZ NOT NULL | |
| revoked | BOOLEAN NOT NULL DEFAULT false | |

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Invite token in body | Complete registration via invite |
| POST | `/api/auth/login` | — | Issue JWT access + refresh tokens |
| POST | `/api/auth/refresh` | Refresh token (cookie) | Rotate access token |
| POST | `/api/auth/logout` | Access token | Revoke refresh token |

### Images (`/api/images`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/images` | List non-deleted images (metadata only) |
| GET | `/api/images/<id>` | Get metadata for one image |
| POST | `/api/images` | Upload image (`multipart/form-data`) |
| PATCH | `/api/images/<id>` | Update name / description |
| DELETE | `/api/images/<id>` | Soft-delete |
| GET | `/api/images/<id>/url` | Return CDN URL (or signed URL) for viewing/downloading |

All image endpoints require a valid JWT access token.

---

## Auth Flow — Invite-Only Registration

1. An admin generates an invite token (stored in `users.invite_token`, emailed manually or shared).
2. Recipient visits `/register?token=<invite_token>`.
3. On submission, the server validates the token, creates the user, and clears the token.
4. Subsequent logins issue a short-lived JWT access token (15 min) and a longer-lived refresh token (7 days) stored in an `HttpOnly` cookie.

---

## Image Upload Flow

1. Authenticated client POSTs `multipart/form-data` with: `file`, `name`, `description`.
2. Server validates MIME type (magic-byte check via `python-magic`) and size (≤ 20 MB).
3. Server generates a UUID4 → `bucket_key`.
4. Server uploads to DO Spaces under `bucket_key` with the correct `Content-Type`.
5. Server inserts a row into `images`.
6. Response: new image record JSON.

## Image View / Download Flow

1. Authenticated client requests `GET /api/images/<id>/url`.
2. Server fetches `bucket_key` from DB.
3. **If bucket objects are public via CDN:** returns `https://adamjhr-storage.ams3.cdn.digitaloceanspaces.com/<bucket_key>` directly.
4. **If bucket is private:** generates a presigned S3 URL (short TTL, e.g. 1 hour) via boto3.
5. Client browser fetches the image directly from CDN/Spaces — never proxied through the app server.

---

## Security

- HTTPS everywhere (Nginx already handles TLS).
- JWT access tokens: 15-minute lifetime, signed with a strong secret.
- Refresh tokens: 7-day lifetime, stored as SHA-256 hashes in DB; rotated on use.
- Refresh token delivered in `HttpOnly; Secure; SameSite=Strict` cookie — not accessible to JS.
- Passwords: bcrypt, cost factor 12.
- File uploads: MIME validated server-side with magic bytes (`python-magic`); max 20 MB enforced in both Nginx and Flask.
- DO Spaces bucket: **private** by default; CDN configured with appropriate CORS and referrer restrictions.
- DB server: accessible only from the app server's private IP (firewall + `pg_hba.conf`).
- Rate limiting: Nginx `limit_req_zone` on `/api/auth/*`.
- Flask `SECRET_KEY`, DB credentials, Spaces keys: all in `.env`, never committed.
- `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers set in Nginx.
- Gunicorn runs as a dedicated non-root user.

---

## Server Setup Steps

### App Server (Debian 12)

1. Create a dedicated system user (`galleri`).
2. Install: `python3`, `python3-venv`, `python3-pip`, `libmagic1`.
3. Clone repo to `/srv/galleri`; create virtualenv; `pip install -r requirements.txt`.
4. Write `/etc/systemd/system/galleri.service` (Gunicorn unit).
5. Add Nginx `location` block proxying to Gunicorn socket.
6. Set Nginx `client_max_body_size 22M` and rate-limit rules.
7. Place `.env` at `/srv/galleri/.env` (mode `640`, owner `galleri`).
8. `systemctl enable --now galleri`.

### Database Server (Debian 12)

1. Install PostgreSQL 15.
2. Create DB `galleri` and role `galleri_app` with a strong password.
3. `pg_hba.conf`: allow `galleri_app` from app server private IP only.
4. `postgresql.conf`: bind to private IP only (`listen_addresses`).
5. Run `migrations/001_initial.sql`.
6. Schedule `pg_dump` daily backup (cron + offsite copy).

---

## Environment Variables (`.env.example`)

```
# Flask
FLASK_SECRET_KEY=

# Database
DB_HOST=
DB_PORT=5432
DB_NAME=galleri
DB_USER=galleri_app
DB_PASSWORD=

# DigitalOcean Spaces
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_REGION=ams3
DO_SPACES_BUCKET=adamjhr-storage
DO_SPACES_CDN_ENDPOINT=https://adamjhr-storage.ams3.cdn.digitaloceanspaces.com

# JWT
JWT_SECRET=
JWT_ACCESS_EXPIRES_MINUTES=15
JWT_REFRESH_EXPIRES_DAYS=7
```

---

## Remaining Questions

1. What domain name will the app be served under? (needed for Nginx config and CORS)
2. Should the Spaces bucket objects be fully public (CDN serves them without signing) or private (presigned URLs per request)? Public is simpler and faster; private gives stricter access control.
3. Is there a specific port or Unix socket convention already in use on the app server?
4. Do you want an admin CLI command (e.g. `flask create-invite <email>`) to generate invite tokens, or a simple web admin page?

## Answers

1. It will be served under adamrose.dk, DNS configured in cloudflare
2. Can you explain in further detail what the two different approaches look like
3. How do i check this?
4. I'd prefer a web admin page
