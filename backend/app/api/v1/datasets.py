from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.submission import VideoSubmission, ReviewDecision, QCRun
from app.models.task import TaskAssignment, Task
from app.models.dataset import DatasetManifest
from app.schemas.dataset import ApprovedVideoItem, DatasetManifestResponse
from app.services.storage_service import storage_service

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.get("/approved", response_model=DatasetManifestResponse)
async def get_approved_dataset(
    category: Optional[str] = None,
    limit: Optional[int] = Query(default=1000, le=5000),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns an index of all fully approved videos with direct download URLs and metadata
    for training ingestion, GPU pipelines, or synchronization scripts.
    """
    stmt = (
        select(VideoSubmission)
        .options(
            selectinload(VideoSubmission.assignment).selectinload(TaskAssignment.task),
            selectinload(VideoSubmission.qc_run),
            selectinload(VideoSubmission.review_decision)
        )
        .where(VideoSubmission.status == "approved")
        .order_by(VideoSubmission.created_at.desc())
    )

    result = await db.execute(stmt)
    submissions = result.scalars().all()

    items: List[ApprovedVideoItem] = []
    total_size = 0

    for sub in submissions:
        task = sub.assignment.task if sub.assignment else None
        if category and task and task.category != category:
            continue

        meta = sub.qc_run.extracted_metadata if sub.qc_run and sub.qc_run.extracted_metadata else {}
        video_meta = meta.get("video", {})

        download_url = storage_service.generate_download_url(sub.storage_key)
        size = sub.file_size_bytes or meta.get("size_bytes") or 0
        total_size += size

        item = ApprovedVideoItem(
            submission_id=sub.id,
            task_id=task.id if task else "",
            task_title=task.title if task else "",
            worker_id=sub.worker_id,
            file_name=sub.file_name,
            storage_key=sub.storage_key,
            download_url=download_url,
            file_size_bytes=size,
            duration_seconds=sub.duration_seconds or int(meta.get("duration", 0)),
            video_codec=video_meta.get("codec"),
            resolution=video_meta.get("resolution"),
            qc_metadata=meta,
            approved_at=sub.review_decision.created_at if sub.review_decision else sub.updated_at
        )
        items.append(item)

        if len(items) >= limit:
            break

    return DatasetManifestResponse(
        id=None,
        title="Approved AI Training Video Dataset",
        version="v1.0.0",
        total_videos=len(items),
        total_size_bytes=total_size,
        created_at=datetime.now(timezone.utc),
        videos=items
    )
