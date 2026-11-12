import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, DateTime, JSON
from app.core.database import Base

class DatasetManifest(Base):
    __tablename__ = "dataset_manifests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    version = Column(String(32), nullable=False)  # e.g., 'v1.0.0'
    approved_submission_ids = Column(JSON, nullable=False, default=list)
    total_videos = Column(Integer, nullable=False, default=0)
    total_size_bytes = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

