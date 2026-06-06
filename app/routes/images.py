import io
import uuid

import magic
from flask import Blueprint, jsonify, request, g, current_app

from app import auth as auth_helpers
from app.db import get_conn
from app import storage

bp = Blueprint("images", __name__, url_prefix="/api/images")

VALID_PRECISIONS = {"day", "week", "month", "year"}
IMAGE_COLS = "id, bucket_key, name, description, mime_type, file_size, uploaded_by, uploaded_at, date_value, date_precision"


def _serialize(row, cols):
    r = dict(zip(cols, row))
    r["id"] = str(r["id"])
    r["uploaded_by"] = str(r["uploaded_by"])
    if r.get("uploaded_at"):
        r["uploaded_at"] = r["uploaded_at"].isoformat()
    r["file_size"] = int(r["file_size"])
    if r.get("date_value"):
        r["date_value"] = r["date_value"].isoformat()
    return r


def _parse_date_fields(data):
    """Extract and validate date_value / date_precision from a request payload."""
    date_value = data.get("date_value")
    date_precision = data.get("date_precision")

    if date_value == "":
        date_value = None
    if date_precision == "":
        date_precision = None

    if date_value is not None and date_precision is None:
        raise ValueError("date_precision is required when date_value is set")
    if date_precision is not None and date_precision not in VALID_PRECISIONS:
        raise ValueError(f"date_precision must be one of: {', '.join(VALID_PRECISIONS)}")
    if date_value is None and date_precision is not None:
        date_precision = None

    return date_value, date_precision


@bp.get("")
@auth_helpers.require_auth
def list_images():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(f"SELECT {IMAGE_COLS} FROM images WHERE deleted = false ORDER BY uploaded_at DESC")
        cols = [d[0] for d in cur.description]
        rows = [_serialize(r, cols) for r in cur.fetchall()]
    return jsonify(rows)


@bp.get("/<image_id>")
@auth_helpers.require_auth
def get_image(image_id):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(f"SELECT {IMAGE_COLS} FROM images WHERE id = %s AND deleted = false", (image_id,))
        cols = [d[0] for d in cur.description]
        row = cur.fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(_serialize(row, cols))


@bp.post("")
@auth_helpers.require_auth
def upload_image():
    cfg = current_app.config

    files = request.files.getlist("file")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"error": "No file provided"}), 400

    name = (request.form.get("name") or "").strip()
    description = (request.form.get("description") or "").strip() or None

    try:
        date_value, date_precision = _parse_date_fields(request.form)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    results = []
    conn = get_conn()

    for file in files:
        header = file.read(2048)
        detected_mime = magic.from_buffer(header, mime=True)
        if detected_mime not in cfg["ALLOWED_MIME_TYPES"]:
            conn.rollback()
            return jsonify({"error": f"{file.filename}: unsupported file type ({detected_mime})"}), 415

        file.seek(0)
        file_bytes = file.read()
        file_size = len(file_bytes)
        if file_size > cfg["MAX_UPLOAD_BYTES"]:
            conn.rollback()
            return jsonify({"error": f"{file.filename}: exceeds 20 MB limit"}), 413

        bucket_key = str(uuid.uuid4())
        storage.upload_file(io.BytesIO(file_bytes), bucket_key, detected_mime)

        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO images (id, bucket_key, name, description, mime_type, file_size, uploaded_by, date_value, date_precision)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {IMAGE_COLS}
                """,
                (bucket_key, name, description, detected_mime, file_size, g.user_id, date_value, date_precision),
            )
            cols = [d[0] for d in cur.description]
            results.append(_serialize(cur.fetchone(), cols))

    conn.commit()
    return jsonify(results), 201


@bp.patch("/<image_id>")
@auth_helpers.require_auth
def update_image(image_id):
    data = request.get_json(silent=True) or {}

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT uploaded_by FROM images WHERE id = %s AND deleted = false", (image_id,))
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "Not found"}), 404
    if str(row[0]) != g.user_id and not g.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    fields = []
    values = []

    if "name" in data:
        fields.append("name = %s")
        values.append((data["name"] or "").strip())

    if "description" in data:
        fields.append("description = %s")
        values.append((data["description"] or "").strip() or None)

    if "date_value" in data or "date_precision" in data:
        try:
            date_value, date_precision = _parse_date_fields(data)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        fields.append("date_value = %s")
        values.append(date_value)
        fields.append("date_precision = %s")
        values.append(date_precision)

    if not fields:
        return jsonify({"error": "Nothing to update"}), 400

    values.append(image_id)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE images SET {', '.join(fields)} WHERE id = %s RETURNING {IMAGE_COLS}",
            values,
        )
        cols = [d[0] for d in cur.description]
        updated = cur.fetchone()
    conn.commit()

    return jsonify(_serialize(updated, cols))


@bp.delete("/<image_id>")
@auth_helpers.require_auth
def delete_image(image_id):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT uploaded_by FROM images WHERE id = %s AND deleted = false", (image_id,))
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "Not found"}), 404
    if str(row[0]) != g.user_id and not g.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    with conn.cursor() as cur:
        cur.execute("UPDATE images SET deleted = true WHERE id = %s", (image_id,))
    conn.commit()

    return jsonify({"message": "Deleted"}), 200


@bp.get("/<image_id>/url")
@auth_helpers.require_auth
def image_url(image_id):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT bucket_key FROM images WHERE id = %s AND deleted = false", (image_id,))
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "Not found"}), 404

    return jsonify({"url": storage.cdn_url(row[0])})
