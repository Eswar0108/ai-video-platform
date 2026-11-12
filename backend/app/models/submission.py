import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class VideoSubmission(Base):
    __tablename__ = "video_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String(36), ForeignKey("task_assignments.id"), nullable=False, index=True)
    worker_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    submission_version = Column(Integer, nullable=False, default=1)
    storage_key = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    # status: uploading, qc_processing, qc_passed, qc_failed, approved, rejected, resubmission_requested
    status = Column(String(32), nullable=False, default="uploading")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    assignment = relationship("TaskAssignment", back_populates="submissions", lazy="selectin")
    upload_session = relationship("UploadSession", back_populates="submission", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    qc_run = relationship("QCRun", back_populates="submission", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    review_decision = relationship("ReviewDecision", back_populates="submission", uselist=False, cascade="all, delete-orphan", lazy="selectin")

class UploadSession(Base):
    __tablename__ = "upload_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("video_submissions.id"), nullable=False, unique=True)
    provider_upload_id = Column(String(255), nullable=False)
    part_size_bytes = Column(Integer, nullable=False, default=10485760)  # 10 MB chunks
    total_parts = Column(Integer, nullable=True)
    status = Column(String(32), nullable=False, default="in_progress")  # 'in_progress', 'completed', 'aborted'
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    submission = relationship("VideoSubmission", back_populates="upload_session")

class QCRun(Base):
    __tablename__ = "qc_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("video_submissions.id"), nullable=False, unique=True)
    status = Column(String(32), nullable=False, default="pending")  # 'pending', 'passed', 'failed'
    extracted_metadata = Column(JSON, nullable=True)
    rule_results = Column(JSON, nullable=True)  # {"duration_pass": true, "codec_pass": true, ...}
    error_message = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    submission = relationship("VideoSubmission", back_populates="qc_run")

class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("video_submissions.id"), nullable=False, unique=True)
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    decision = Column(String(32), nullable=False)  # 'approved', 'rejected', 'resubmission_requested'
    reason_code = Column(String(64), nullable=True)
    feedback_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    submission = relationship("VideoSubmission", back_populates="review_decision")

