import io
from datetime import date

from PIL import Image

_TAG_DATETIME_ORIGINAL = 36867
_TAG_DATETIME = 306


def extract_date(file_bytes: bytes) -> date | None:
    """Best-effort EXIF date extraction. Returns None on any failure or absence."""
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            exif = img.getexif()
            raw = exif.get(_TAG_DATETIME_ORIGINAL) or exif.get(_TAG_DATETIME)
        if not raw:
            return None
        # EXIF datetime format: "YYYY:MM:DD HH:MM:SS"
        date_part = raw.split(" ")[0]
        year, month, day = (int(p) for p in date_part.split(":"))
        return date(year, month, day)
    except Exception:
        return None
