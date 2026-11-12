from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field

class SubmissionCreate(BaseModel):
    assignment_id: str
    file_name: str
    file_size_bytes: Optional[int] = None

class UploadSessionCreate(BaseModel):
    part_size_bytes: Optional[int] = Field(default=10485760, ge=1024)  # default 10MB, min 1KB for flexible testing
    total_parts: Optional[int] = Field(default=1, ge=1)

class PartPresignedUrl(BaseModel):
    part_number: int
    upload_url: str

class UploadSessionResponse(BaseModel):
    id: str
    submission_id: str
    provider_upload_id: str
    part_size_bytes: int
    total_parts: Optional[int] = None
    status: str
    expires_at: Optional[datetime] = None
    presigned_urls: List[PartPresignedUrl] = []

    model_config = ConfigDict(from_attributes=True)

class CompleteUploadPart(BaseModel):
    part_number: int
    etag: str

class CompleteUploadRequest(BaseModel):
    parts: List[CompleteUploadPart]
    file_size_bytes: Optional[int] = None

class QCRunResponse(BaseModel):
    id: str
    submission_id: str
    status: str  # 'pending', 'passed', 'failed'
    extracted_metadata: Optional[Dict[str, Any]] = None
    rule_results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ReviewDecisionResponse(BaseModel):
    id: str
    submission_id: str
    reviewer_id: str
    decision: str  # 'approved', 'rejected', 'resubmission_requested'
    reason_code: Optional[str] = None
    feedback_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    worker_id: str
    submission_version: int
    storage_key: str
    file_name: str
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime
    upload_session: Optional[UploadSessionResponse] = None
    qc_run: Optional[QCRunResponse] = None
    review_decision: Optional[ReviewDecisionResponse] = None

    model_config = ConfigDict(from_attributes=True)
