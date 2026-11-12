from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    category: Optional[str] = "general"
    min_duration_seconds: Optional[int] = Field(default=300, ge=1)
    max_duration_seconds: Optional[int] = Field(default=3600, ge=1)
    required_codec: Optional[str] = "h264"
    min_resolution: Optional[str] = "1920x1080"
    total_slots: Optional[int] = Field(default=10, ge=1)

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    min_duration_seconds: Optional[int] = None
    max_duration_seconds: Optional[int] = None
    required_codec: Optional[str] = None
    min_resolution: Optional[str] = None
    total_slots: Optional[int] = None
    status: Optional[str] = None

class TaskResponse(TaskBase):
    id: str
    claimed_slots: int
    status: str
    created_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TaskClaimResponse(BaseModel):
    assignment_id: str
    task_id: str
    worker_id: str
    status: str
    claim_expires_at: datetime
    assigned_at: datetime
    task: Optional[TaskResponse] = None

    model_config = ConfigDict(from_attributes=True)
