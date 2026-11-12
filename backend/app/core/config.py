import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "AI Training Video Collection Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev_secret_jwt_key_change_in_production_1234567890!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./ai_video_platform.db"  # Defaults to local async sqlite if Postgres not ready

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Object Storage (MinIO S3 Compatible / Cloudflare R2 / AWS S3)
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_PUBLIC_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "video-submissions"
    S3_REGION: str = "us-east-1"

    # Storage mode: 's3' or 'local' (allows running tests and development even without MinIO container)
    STORAGE_MODE: str = "s3"
    LOCAL_STORAGE_DIR: str = "./storage_uploads"

    # QC Constraints for 5-minute MVP
    DEFAULT_MIN_DURATION_SECONDS: int = 300  # 5 minutes
    DEFAULT_MAX_DURATION_SECONDS: int = 3600
    DEFAULT_REQUIRED_CODEC: str = "h264"
    DEFAULT_MIN_RESOLUTION: str = "1920x1080"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), "../../../.env"),
        extra="ignore"
    )

settings = Settings()

