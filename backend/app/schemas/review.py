from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field

class ReviewActionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected|resubmission_requested)$")
    reason_code: Optional[str] = None
    feedback_notes: Optional[str] = None

class ReviewResponse(BaseModel):
    id: str
    submission_id: str
    reviewer_id: str
    decision: str
    reason_code: Optional[str] = None
    feedback_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReviewQueueItemResponse(BaseModel):
    submission_id: str
    assignment_id: str
    task_id: str
    task_title: str
    worker_id: str
    worker_email: Optional[str] = None
    file_name: str
    storage_key: str
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[int] = None
    status: str
    qc_status: Optional[str] = None
    qc_metrics: Optional[Dict[str, Any]] = None
    created_at: datetime
    preview_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
