from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.task import Task, TaskAssignment
from app.models.user import User
from app.schemas.task import TaskCreate, TaskResponse, TaskClaimResponse
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(default="published", alias="status"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Task)
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if category:
        stmt = stmt.where(Task.category == category)
    stmt = stmt.order_by(Task.created_at.desc())

    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return tasks

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    new_task = Task(
        title=task_in.title,
        description=task_in.description or "",
        category=task_in.category or "general",
        min_duration_seconds=task_in.min_duration_seconds or 300,
        max_duration_seconds=task_in.max_duration_seconds or 3600,
        required_codec=task_in.required_codec or "h264",
        min_resolution=task_in.min_resolution or "1920x1080",
        total_slots=task_in.total_slots or 10,
        claimed_slots=0,
        status="published",
        created_by=current_user.id
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task

@router.post("/{task_id}/claim", response_model=TaskClaimResponse)
async def claim_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. If worker already has an active claim, return it so they can continue uploading
    existing_stmt = select(TaskAssignment).where(
        TaskAssignment.task_id == task_id,
        TaskAssignment.worker_id == current_user.id,
        TaskAssignment.status.in_(["assigned", "in_progress"])
    )
    existing_res = await db.execute(existing_stmt)
    existing_assignment = existing_res.scalar_one_or_none()
    if existing_assignment:
        return TaskClaimResponse(
            assignment_id=existing_assignment.id,
            task_id=existing_assignment.task_id,
            worker_id=existing_assignment.worker_id,
            status=existing_assignment.status,
            claim_expires_at=existing_assignment.claim_expires_at,
            assigned_at=existing_assignment.assigned_at
        )

    # 2. Concurrency guard: atomic update incrementing claimed_slots only if claimed_slots < total_slots
    claim_update_stmt = (
        update(Task)
        .where(
            Task.id == task_id,
            Task.claimed_slots < Task.total_slots,
            Task.status == "published"
        )
        .values(claimed_slots=Task.claimed_slots + 1)
        .execution_options(synchronize_session=False)
    )
    update_res = await db.execute(claim_update_stmt)

    if update_res.rowcount == 0:
        # Determine why update failed
        task_check = await db.execute(select(Task).where(Task.id == task_id))
        target_task = task_check.scalar_one_or_none()
        if not target_task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        if target_task.status != "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task is currently {target_task.status} and cannot be claimed."
            )
        if target_task.claimed_slots >= target_task.total_slots:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="All slots for this task have already been claimed."
            )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not claim slot.")

    # 3. Create the assignment record
    assignment = TaskAssignment(
        task_id=task_id,
        worker_id=current_user.id,
        status="assigned",
        claim_expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        assigned_at=datetime.now(timezone.utc)
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    # Fetch updated task for response
    task_res = await db.execute(select(Task).where(Task.id == task_id))
    updated_task = task_res.scalar_one()

    return TaskClaimResponse(
        assignment_id=assignment.id,
        task_id=assignment.task_id,
        worker_id=assignment.worker_id,
        status=assignment.status,
        claim_expires_at=assignment.claim_expires_at,
        assigned_at=assignment.assigned_at,
        task=TaskResponse.model_validate(updated_task)
    )
