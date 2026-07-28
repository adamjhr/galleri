-- Run as the galleri_app role on the galleri database.
-- Authelia now owns login; drop the password/invite/refresh-token machinery.

ALTER TABLE users
    DROP COLUMN password_hash,
    DROP COLUMN invite_token;

DROP TABLE IF EXISTS refresh_tokens;
