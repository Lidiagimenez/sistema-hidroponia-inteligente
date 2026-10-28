from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_SIZE = 5 * 1024 * 1024
MIN_IMAGE_DIMENSIONS = (100, 100)
MAX_IMAGE_DIMENSIONS = (4000, 4000)
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_uploaded_image(uploaded_file):
    if not uploaded_file:
        return uploaded_file

    if uploaded_file.size > MAX_IMAGE_SIZE:
        raise ValidationError("La imagen no puede superar 5 MB.")

    extension = Path(uploaded_file.name or "").suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError("Formato de imagen no permitido.")

    position = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    
    try:
        # Abrimos la imagen solo para leer formato y dimensiones
        with Image.open(uploaded_file) as image:
            image_format = image.format
            width, height = image.size
    except (UnidentifiedImageError, OSError):
        raise ValidationError("El archivo subido no es una imagen válida.")
    finally:
        # Dejar el cursor al inicio para que Django pueda guardar el archivo.
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(position or 0)

    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("Formato real de imagen no permitido.")

    min_width, min_height = MIN_IMAGE_DIMENSIONS
    max_width, max_height = MAX_IMAGE_DIMENSIONS
    if width < min_width or height < min_height:
        raise ValidationError(f"La imagen debe medir al menos {min_width}x{min_height} px.")
    if width > max_width or height > max_height:
        raise ValidationError(f"La imagen no puede superar {max_width}x{max_height} px.")

    return uploaded_file