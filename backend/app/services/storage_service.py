import os
import hashlib
import uuid
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError, EndpointConnectionError
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.mode = settings.STORAGE_MODE
        self.local_dir = Path(settings.LOCAL_STORAGE_DIR)
        self.local_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir = self.local_dir / ".sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

        self._s3_client = None
        if self.mode == "s3":
            try:
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                    region_name=settings.S3_REGION,
                    config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
                )
            except Exception as e:
                logger.warning(f"Failed to initialize S3 client: {e}. Falling back to local storage mode.")
                self.mode = "local"

    def _ensure_bucket_exists(self):
        if self._s3_client and self.mode == "s3":
            try:
                self._s3_client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code in ("404", "NoSuchBucket"):
                    self._s3_client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
            except Exception as e:
                logger.warning(f"Could not verify S3 bucket: {e}")

    def create_multipart_session(self, object_key: str) -> str:
        """
        Creates a multipart upload session. Returns upload_id.
        """
        if self.mode == "s3" and self._s3_client:
            try:
                self._ensure_bucket_exists()
                response = self._s3_client.create_multipart_upload(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=object_key
                )
                return response["UploadId"]
            except Exception as e:
                logger.warning(f"S3 multipart session failed ({e}), using local fallback.")
                self.mode = "local"

        # Local storage fallback
        upload_id = str(uuid.uuid4())
        session_path = self.sessions_dir / upload_id
        session_path.mkdir(parents=True, exist_ok=True)
        # Store object_key in session dir
        with open(session_path / "metadata.txt", "w") as f:
            f.write(object_key)
        return upload_id

    def generate_part_presigned_url(self, object_key: str, upload_id: str, part_number: int, expires_in: int = 3600) -> str:
        """
        Generates a presigned PUT URL for uploading a specific part.
        """
        if self.mode == "s3" and self._s3_client:
            try:
                url = self._s3_client.generate_presigned_url(
                    ClientMethod="upload_part",
                    Params={
                        "Bucket": settings.S3_BUCKET_NAME,
                        "Key": object_key,
                        "UploadId": upload_id,
                        "PartNumber": part_number,
                    },
                    ExpiresIn=expires_in,
                )
                return url
            except Exception as e:
                logger.warning(f"S3 presigned url generation failed ({e}), using local fallback.")
                self.mode = "local"

        # Local fallback URL
        return f"{settings.API_V1_STR}/storage/upload-part?upload_id={upload_id}&part_number={part_number}&object_key={object_key}"

    def save_local_part(self, upload_id: str, part_number: int, content: bytes) -> str:
        """
        Saves a part in local storage mode and returns the ETag.
        """
        session_path = self.sessions_dir / upload_id
        session_path.mkdir(parents=True, exist_ok=True)
        part_path = session_path / f"part_{part_number}.bin"
        with open(part_path, "wb") as f:
            f.write(content)
        etag = hashlib.md5(content).hexdigest()
        return etag

    def complete_multipart(self, object_key: str, upload_id: str, parts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Completes the multipart upload session.
        parts: [{'part_number': int, 'etag': str}, ...] or [{'PartNumber': int, 'ETag': str}, ...]
        """
        formatted_parts = []
        for p in parts:
            p_num = p.get("PartNumber") or p.get("part_number")
            p_etag = p.get("ETag") or p.get("etag")
            # Strip extra quotes if present
            clean_etag = p_etag.strip('"') if isinstance(p_etag, str) else str(p_etag)
            formatted_parts.append({
                "PartNumber": int(p_num),
                "ETag": f'"{clean_etag}"' if not clean_etag.startswith('"') else clean_etag
            })
        formatted_parts.sort(key=lambda x: x["PartNumber"])

        if self.mode == "s3" and self._s3_client:
            try:
                response = self._s3_client.complete_multipart_upload(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=object_key,
                    UploadId=upload_id,
                    MultipartUpload={"Parts": formatted_parts}
                )
                return response
            except Exception as e:
                logger.warning(f"S3 complete multipart failed ({e}), checking local fallback.")
                self.mode = "local"

        # Local fallback completion: concatenate parts
        session_path = self.sessions_dir / upload_id
        target_path = self.local_dir / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)

        total_bytes = 0
        overall_md5 = hashlib.md5()
        with open(target_path, "wb") as out_f:
            for p in formatted_parts:
                part_file = session_path / f"part_{p['PartNumber']}.bin"
                if part_file.exists():
                    with open(part_file, "rb") as in_f:
                        chunk = in_f.read()
                        total_bytes += len(chunk)
                        overall_md5.update(chunk)
                        out_f.write(chunk)

        final_etag = overall_md5.hexdigest()
        return {
            "Location": str(target_path),
            "Bucket": "local",
            "Key": object_key,
            "ETag": f'"{final_etag}"',
            "size_bytes": total_bytes
        }

    def save_direct(self, object_key: str, data: bytes) -> str:
        """
        Directly saves file bytes for testing or direct ingestion.
        """
        if self.mode == "s3" and self._s3_client:
            try:
                self._ensure_bucket_exists()
                self._s3_client.put_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=object_key,
                    Body=data
                )
                return f"{settings.S3_PUBLIC_URL}/{settings.S3_BUCKET_NAME}/{object_key}"
            except Exception as e:
                logger.warning(f"Direct S3 upload failed: {e}. Falling back to local.")
                self.mode = "local"

        target_path = self.local_dir / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(data)
        return str(target_path)

    def generate_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        """
        Generates a download URL. If S3, returns presigned GET URL. If local, returns file URL or path.
        """
        if self.mode == "s3" and self._s3_client:
            try:
                return self._s3_client.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={"Bucket": settings.S3_BUCKET_NAME, "Key": object_key},
                    ExpiresIn=expires_in
                )
            except Exception:
                pass

        target_path = self.local_dir / object_key
        return f"{settings.API_V1_STR}/storage/download/{object_key}"

    def get_probe_target(self, object_key: str) -> str:
        """
        Returns a local path or HTTP URL that ffprobe can inspect.
        """
        local_path = self.local_dir / object_key
        if local_path.exists():
            return str(local_path)
        return self.generate_download_url(object_key)

storage_service = StorageService()
