from fastapi import APIRouter
from app.api.v1 import auth, tasks, submissions, review, datasets

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(tasks.router)
api_router.include_router(submissions.router)
api_router.include_router(review.router)
api_router.include_router(datasets.router)

__all__ = ["api_router"]
