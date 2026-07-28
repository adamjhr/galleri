import os


class Config:
    SECRET_KEY = os.environ["FLASK_SECRET_KEY"]

    DB_HOST = os.environ["DB_HOST"]
    DB_PORT = int(os.environ.get("DB_PORT", 5432))
    DB_NAME = os.environ["DB_NAME"]
    DB_USER = os.environ["DB_USER"]
    DB_PASSWORD = os.environ["DB_PASSWORD"]

    DO_SPACES_KEY = os.environ["DO_SPACES_KEY"]
    DO_SPACES_SECRET = os.environ["DO_SPACES_SECRET"]
    DO_SPACES_REGION = os.environ.get("DO_SPACES_REGION", "ams3")
    DO_SPACES_BUCKET = os.environ["DO_SPACES_BUCKET"]
    DO_SPACES_CDN_ENDPOINT = os.environ["DO_SPACES_CDN_ENDPOINT"]
    # Optional: overrides the S3 endpoint used server-side (e.g. Docker service name)
    DO_SPACES_INTERNAL_ENDPOINT = os.environ.get("DO_SPACES_INTERNAL_ENDPOINT")

    MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

    ALLOWED_MIME_TYPES = {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/avif",
    }
