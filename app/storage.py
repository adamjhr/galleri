import boto3
from botocore.config import Config as BotoConfig
from flask import current_app


def _endpoint_url():
    cfg = current_app.config
    # Explicit internal endpoint takes priority (e.g. Docker service name for local dev)
    if cfg.get("DO_SPACES_INTERNAL_ENDPOINT"):
        return cfg["DO_SPACES_INTERNAL_ENDPOINT"]
    return f"https://{cfg['DO_SPACES_REGION']}.digitaloceanspaces.com"


def _client():
    cfg = current_app.config
    return boto3.client(
        "s3",
        region_name=cfg["DO_SPACES_REGION"],
        endpoint_url=_endpoint_url(),
        aws_access_key_id=cfg["DO_SPACES_KEY"],
        aws_secret_access_key=cfg["DO_SPACES_SECRET"],
        config=BotoConfig(signature_version="s3v4"),
    )


def upload_file(file_obj, bucket_key: str, mime_type: str):
    cfg = current_app.config
    _client().upload_fileobj(
        file_obj,
        cfg["DO_SPACES_BUCKET"],
        bucket_key,
        ExtraArgs={
            "ContentType": mime_type,
            "ACL": "public-read",
        },
    )


def delete_file(bucket_key: str):
    cfg = current_app.config
    _client().delete_object(Bucket=cfg["DO_SPACES_BUCKET"], Key=bucket_key)


def cdn_url(bucket_key: str) -> str:
    endpoint = current_app.config["DO_SPACES_CDN_ENDPOINT"].rstrip("/")
    return f"{endpoint}/{bucket_key}"
