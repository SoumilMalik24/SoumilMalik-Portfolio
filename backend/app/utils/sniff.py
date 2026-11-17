"""File type detection by magic bytes and image dimension parsing (no Pillow)."""
import struct
from typing import Optional, Tuple

PNG_SIG = b"\x89PNG\r\n\x1a\n"
EXT_BY_MIME = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf"}

# JPEG start-of-frame markers that carry dimensions (excludes DHT C4, JPG C8, DAC CC).
_SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def detect_mime(data: bytes) -> Optional[str]:
    """Return the MIME type implied by the file's leading bytes, or None if unsupported."""
    if data.startswith(PNG_SIG):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def _png_size(data: bytes) -> Optional[Tuple[int, int]]:
    if len(data) >= 24 and data[12:16] == b"IHDR":
        return struct.unpack(">II", data[16:24])
    return None


def _jpeg_size(data: bytes) -> Optional[Tuple[int, int]]:
    i, n = 2, len(data)
    while i + 3 < n:
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker == 0xFF:  # fill byte
            i += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # markers without a length
            i += 2
            continue
        if marker == 0xD9:  # end of image
            return None
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in _SOF_MARKERS:
            if i + 9 > n:
                return None
            height, width = struct.unpack(">HH", data[i + 5:i + 9])
            return width, height
        if seg_len < 2:
            return None
        i += 2 + seg_len
    return None


def _webp_size(data: bytes) -> Optional[Tuple[int, int]]:
    chunk = data[12:16]
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        w, h = struct.unpack("<HH", data[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        b0, b1, b2, b3 = data[21:25]
        width = 1 + (((b1 & 0x3F) << 8) | b0)
        height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
        return width, height
    if chunk == b"VP8X" and len(data) >= 30:
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height
    return None


def image_size(data: bytes, mime: str) -> Optional[Tuple[int, int]]:
    """Best-effort (width, height) from image headers; None when it cannot be parsed."""
    try:
        if mime == "image/png":
            return _png_size(data)
        if mime == "image/jpeg":
            return _jpeg_size(data)
        if mime == "image/webp":
            return _webp_size(data)
    except (struct.error, IndexError, ValueError):
        return None
    return None
