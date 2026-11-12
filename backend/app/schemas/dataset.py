from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class ApprovedVideoItem(BaseModel):
    submission_id: str
    task_id: str
    task_title: str
    worker_id: str
    file_name: str
    storage_key: str
    download_url: str
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[int] = None
    video_codec: Optional[str] = None
    resolution: Optional[str] = None
    qc_metadata: Optional[Dict[str, Any]] = None
    approved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DatasetManifestResponse(BaseModel):
    id: Optional[str] = None
    title: str = "Approved Training Video Dataset"
    version: str = "v1.0.0"
    total_videos: int
    total_size_bytes: int
    created_at: datetime
    videos: List[ApprovedVideoItem]

    model_config = ConfigDict(from_attributes=True)
