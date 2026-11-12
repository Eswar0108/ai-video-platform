import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    category = Column(String(64), nullable=False, default="general")
    min_duration_seconds = Column(Integer, nullable=False, default=300)  # 5 min MVP
    max_duration_seconds = Column(Integer, nullable=False, default=3600)
    required_codec = Column(String(32), nullable=False, default="h264")
    min_resolution = Column(String(32), nullable=False, default="1920x1080")
    total_slots = Column(Integer, nullable=False, default=10)
    claimed_slots = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="published")  # 'published', 'completed', 'paused'
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan", lazy="selectin")

class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(36), ForeignKey("tasks.id"), nullable=False, index=True)
    worker_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="assigned")  # 'assigned', 'in_progress', 'submitted', 'completed', 'expired'
    claim_expires_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc) + timedelta(hours=24), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    task = relationship("Task", back_populates="assignments", lazy="selectin")
    submissions = relationship("VideoSubmission", back_populates="assignment", cascade="all, delete-orphan", lazy="selectin")

