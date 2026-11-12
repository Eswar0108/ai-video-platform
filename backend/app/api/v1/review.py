from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.submission import VideoSubmission, ReviewDecision, QCRun
from app.models.task import TaskAssignment, Task
from app.models.user import User
from app.schemas.review import ReviewActionRequest, ReviewResponse, ReviewQueueItemResponse
from app.services.storage_service import storage_service
from app.api.deps import require_reviewer

router = APIRouter(tags=["review"])

@router.get("/review/queue", response_model=List[ReviewQueueItemResponse])
async def get_review_queue(
    current_user: User = Depends(require_reviewer),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the queue of video submissions that passed automated QC and await human review.
    """
    stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.assignment).selectinload(TaskAssignment.task),
            selectinload(VideoSubmission.qc_run)
        )
        .where(VideoSubmission.status == "qc_passed")
        .order_by(VideoSubmission.created_at.asc())
    )
    result = await db.execute(stmt)
    submissions = result.scalars().all()

    queue_items = []
    for sub in submissions:
        # Fetch worker info
        worker_stmt = select(User).where(User.id == sub.worker_id)
        worker_res = await db.execute(worker_stmt)
        worker = worker_res.scalar_one_or_none()

        task = sub.assignment.task if sub.assignment else None
        preview_url = storage_service.generate_download_url(sub.storage_key)

        queue_items.append(
            ReviewQueueItemResponse(
                submission_id=sub.id,
                assignment_id=sub.assignment_id,
                task_id=task.id if task else "",
                task_title=task.title if task else "",
                worker_id=sub.worker_id,
                worker_email=worker.email if worker else None,
                file_name=sub.file_name,
                storage_key=sub.storage_key,
                file_size_bytes=sub.file_size_bytes,
                duration_seconds=sub.duration_seconds,
                status=sub.status,
                qc_status=sub.qc_run.status if sub.qc_run else None,
                qc_metrics=sub.qc_run.extracted_metadata if sub.qc_run else None,
                created_at=sub.created_at,
                preview_url=preview_url
            )
        )

    return queue_items

@router.post("/submissions/{submission_id}/review", response_model=ReviewResponse)
async def submit_review(
    submission_id: str,
    action: ReviewActionRequest,
    current_user: User = Depends(require_reviewer),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.assignment),
            selectinload(VideoSubmission.review_decision)
        )
        .where(VideoSubmission.id == submission_id)
    )
    result = await db.execute(stmt)
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if submission.status not in ["qc_passed", "review_pending", "resubmission_requested"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review submission with current status '{submission.status}'"
        )

    # Record or update review decision
    if submission.review_decision:
        decision_rec = submission.review_decision
        decision_rec.reviewer_id = current_user.id
        decision_rec.decision = action.decision
        decision_rec.reason_code = action.reason_code
        decision_rec.feedback_notes = action.feedback_notes
        decision_rec.created_at = datetime.now(timezone.utc)
    else:
        decision_rec = ReviewDecision(
            submission_id=submission.id,
            reviewer_id=current_user.id,
            decision=action.decision,
            reason_code=action.reason_code,
            feedback_notes=action.feedback_notes,
            created_at=datetime.now(timezone.utc)
        )
        db.add(decision_rec)

    # Update submission and assignment status
    submission.status = action.decision

    if action.decision == "approved":
        if submission.assignment:
            submission.assignment.status = "completed"
            submission.assignment.completed_at = datetime.now(timezone.utc)
    elif action.decision == "resubmission_requested":
        if submission.assignment:
            submission.assignment.status = "in_progress"
    elif action.decision == "rejected":
        if submission.assignment:
            submission.assignment.status = "rejected"

    await db.commit()
    await db.refresh(decision_rec)
    return decision_rec
