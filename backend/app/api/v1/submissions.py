import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.models.task import Task, TaskAssignment
from app.models.submission import VideoSubmission, UploadSession, QCRun
from app.models.user import User
from app.schemas.submission import (
    SubmissionCreate,
    UploadSessionCreate,
    UploadSessionResponse,
    PartPresignedUrl,
    CompleteUploadRequest,
    SubmissionResponse,
    QCRunResponse,
    ReviewDecisionResponse
)
from app.services.storage_service import storage_service
from app.services.qc_service import qc_service
from app.api.deps import get_current_user

router = APIRouter(tags=["submissions"])

@router.post("/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    sub_in: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify assignment exists
    stmt = (
        select(TaskAssignment)
        .options(selectinload(TaskAssignment.task))
        .where(TaskAssignment.id == sub_in.assignment_id)
    )
    result = await db.execute(stmt)
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Worker can only submit to their own assignment (unless admin)
    if assignment.worker_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this assignment")

    # Generate unique storage key
    filename_clean = os.path.basename(sub_in.file_name)
    storage_key = f"tasks/{assignment.task_id}/submissions/{assignment.id}/{uuid.uuid4().hex[:8]}_{filename_clean}"

    # Check version count
    version_stmt = select(VideoSubmission).where(VideoSubmission.assignment_id == assignment.id)
    v_res = await db.execute(version_stmt)
    existing_submissions = v_res.scalars().all()
    version = len(existing_submissions) + 1

    submission = VideoSubmission(
        assignment_id=assignment.id,
        worker_id=current_user.id,
        submission_version=version,
        storage_key=storage_key,
        file_name=filename_clean,
        file_size_bytes=sub_in.file_size_bytes,
        status="uploading"
    )
    assignment.status = "in_progress"

    db.add(submission)
    await db.commit()
    await db.refresh(submission)
    return submission

@router.post("/submissions/{submission_id}/upload-session", response_model=UploadSessionResponse)
async def create_upload_session(
    submission_id: str,
    session_in: UploadSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(VideoSubmission).where(VideoSubmission.id == submission_id)
    result = await db.execute(stmt)
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if submission.worker_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Initialize multipart upload session with storage service
    provider_upload_id = storage_service.create_multipart_session(submission.storage_key)
    total_parts = session_in.total_parts or 1
    part_size = session_in.part_size_bytes or 10485760

    # Generate presigned part URLs
    presigned_urls: List[PartPresignedUrl] = []
    for part_num in range(1, total_parts + 1):
        url = storage_service.generate_part_presigned_url(
            object_key=submission.storage_key,
            upload_id=provider_upload_id,
            part_number=part_num
        )
        presigned_urls.append(PartPresignedUrl(part_number=part_num, upload_url=url))

    # Persist or update upload session
    upload_session = UploadSession(
        submission_id=submission.id,
        provider_upload_id=provider_upload_id,
        part_size_bytes=part_size,
        total_parts=total_parts,
        status="in_progress"
    )
    db.add(upload_session)
    await db.commit()
    await db.refresh(upload_session)

    resp = UploadSessionResponse.model_validate(upload_session)
    resp.presigned_urls = presigned_urls
    return resp

@router.post("/submissions/{submission_id}/complete-upload", response_model=SubmissionResponse)
async def complete_upload(
    submission_id: str,
    complete_in: CompleteUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.upload_session),
            selectinload(VideoSubmission.assignment).selectinload(TaskAssignment.task)
        )
        .where(VideoSubmission.id == submission_id)
    )
    result = await db.execute(stmt)
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if submission.worker_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if not submission.upload_session:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active upload session found")

    # Complete multipart session in storage
    parts_data = [{"part_number": p.part_number, "etag": p.etag} for p in complete_in.parts]
    try:
        complete_result = storage_service.complete_multipart(
            object_key=submission.storage_key,
            upload_id=submission.upload_session.provider_upload_id,
            parts=parts_data
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage completion failed: {e}"
        )

    submission.upload_session.status = "completed"
    if complete_in.file_size_bytes:
        submission.file_size_bytes = complete_in.file_size_bytes
    elif "size_bytes" in complete_result:
        submission.file_size_bytes = complete_result["size_bytes"]

    # Trigger QC Inspection
    submission.status = "qc_processing"
    await db.commit()

    task = submission.assignment.task
    task_policy = {
        "min_duration_seconds": task.min_duration_seconds,
        "max_duration_seconds": task.max_duration_seconds,
        "required_codec": task.required_codec,
        "min_resolution": task.min_resolution,
        "require_audio": True
    }

    probe_target = storage_service.get_probe_target(submission.storage_key)
    qc_result = qc_service.run_qc(probe_target, task_policy)

    # Persist QC Run
    qc_run = QCRun(
        submission_id=submission.id,
        status=qc_result["status"],
        extracted_metadata=qc_result["extracted_metadata"],
        rule_results=qc_result["rule_results"],
        error_message=qc_result["error_message"],
        completed_at=datetime.now(timezone.utc)
    )
    submission.qc_run = qc_run
    db.add(qc_run)

    if qc_result["status"] == "passed":
        submission.status = "qc_passed"
        submission.assignment.status = "submitted"
        if qc_result["extracted_metadata"]:
            meta = qc_result["extracted_metadata"]
            submission.duration_seconds = int(meta.get("duration", 0))
            if not submission.file_size_bytes and meta.get("size_bytes"):
                submission.file_size_bytes = meta.get("size_bytes")
    else:
        submission.status = "qc_failed"
        if qc_result["extracted_metadata"]:
            meta = qc_result["extracted_metadata"]
            submission.duration_seconds = int(meta.get("duration", 0))

    await db.commit()

    # Re-query submission with eager loaded relationships
    refetch_stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.upload_session),
            selectinload(VideoSubmission.qc_run),
            selectinload(VideoSubmission.review_decision)
        )
        .where(VideoSubmission.id == submission_id)
    )
    fresh_sub = (await db.execute(refetch_stmt)).scalar_one()
    return fresh_sub

@router.get("/submissions", response_model=List[SubmissionResponse])
async def list_submissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.upload_session),
            selectinload(VideoSubmission.qc_run),
            selectinload(VideoSubmission.review_decision)
        )
        .order_by(VideoSubmission.created_at.desc())
    )
    if current_user.role == "worker":
        stmt = stmt.where(VideoSubmission.worker_id == current_user.id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.upload_session),
            selectinload(VideoSubmission.qc_run),
            selectinload(VideoSubmission.review_decision)
        )
        .where(VideoSubmission.id == submission_id)
    )
    result = await db.execute(stmt)
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Workers can only view their own submissions; reviewers & admins can view all
    if current_user.role == "worker" and submission.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return submission

# Direct part upload endpoint for local storage mode / integration tests
@router.put("/storage/upload-part")
async def upload_part_direct(
    request: Request,
    response: Response,
    upload_id: str,
    part_number: int,
    object_key: str
):
    body = await request.body()
    etag = storage_service.save_local_part(upload_id=upload_id, part_number=part_number, content=body)
    response.headers["ETag"] = f'"{etag}"'
    return {"status": "ok", "part_number": part_number, "etag": f'"{etag}"'}

# Local file serving endpoint for probes and sync downloads
@router.get("/storage/download/{file_path:path}")
async def download_file_direct(file_path: str):
    full_path = os.path.join(settings.LOCAL_STORAGE_DIR, file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(full_path)
