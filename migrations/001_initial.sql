-- Run as the galleri_app role on the galleri database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT        UNIQUE NOT NULL,
    email           TEXT        UNIQUE NOT NULL,
    password_hash   TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_admin        BOOLEAN     NOT NULL DEFAULT false,
    invite_token    TEXT        UNIQUE
);

CREATE TABLE IF NOT EXISTS images (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_key  TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    description TEXT,
    mime_type   TEXT        NOT NULL,
    file_size   BIGINT      NOT NULL,
    uploaded_by UUID        NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted     BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images (uploaded_at DESC) WHERE deleted = false;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
