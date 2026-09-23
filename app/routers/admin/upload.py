"""
POST /api/admin/upload — загрузка изображений для товаров.
Требует JWT токен администратора.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.dependencies import get_current_admin
from app.models import AdminUser

router = APIRouter()

UPLOAD_DIR   = Path("uploads/products")
MAX_SIZE     = 25 * 1024 * 1024   # 25 МБ
ALLOWED      = {
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/x-png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
}
EXT_MAP      = {
    "image/jpeg": ".jpg",
    "image/jpg":  ".jpg",
    "image/pjpeg":".jpg",
    "image/png":  ".png",
    "image/x-png":".png",
    "image/webp": ".webp",
    "image/gif":  ".gif",
    "image/svg+xml": ".svg",
}
EXT_TO_MIME  = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".webp": "image/webp",
    ".gif":  "image/gif",
    ".svg":  "image/svg+xml",
}

# Создаём папку при импорте
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post(
    "/",
    summary="Загрузить изображение товара",
    response_class=JSONResponse,
)
async def upload_image(
    file: UploadFile = File(...),
    _:    AdminUser  = Depends(get_current_admin),
) -> dict:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Проверка типа
    content_type = (file.content_type or "").lower().strip()

    # Fallback по расширению файла, если браузер прислал application/octet-stream или пустоту
    if content_type not in ALLOWED:
        ext_from_name = Path(file.filename or "").suffix.lower()
        if ext_from_name in EXT_TO_MIME:
            content_type = EXT_TO_MIME[ext_from_name]
        else:
            raise HTTPException(
                status_code=400,
                detail="Допустимы только изображения: JPEG, PNG, WebP, GIF, SVG",
            )

    # Читаем и проверяем размер
    content = await file.read()
    if len(content) > MAX_SIZE:
        max_mb = MAX_SIZE // (1024 * 1024)
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой. Максимальный размер — {max_mb} МБ",
        )

    # Сохраняем с уникальным именем
    ext      = EXT_MAP.get(content_type, Path(file.filename or "").suffix.lower() or ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(content)

    return {"url": f"/uploads/products/{filename}"}
