import os
import shutil
import tempfile
import pytest
import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.services.storage_service import storage_service
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session", autouse=True)
def setup_storage_tmp():
    temp_dir = tempfile.mkdtemp(prefix="ai_video_test_storage_")
    storage_service.mode = "local"
    storage_service.local_dir = storage_service.local_dir.__class__(temp_dir)
    storage_service.sessions_dir = storage_service.local_dir / ".sessions"
    storage_service.local_dir.mkdir(parents=True, exist_ok=True)
    storage_service.sessions_dir.mkdir(parents=True, exist_ok=True)
    yield
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest_asyncio.fixture(scope="function")
async def db_session():
    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        future=True
    )
    async_session = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture(scope="function")
async def test_users(db_session: AsyncSession):
    # Admin
    admin = User(
        email="admin@example.com",
        password_hash=hash_password("adminpass123"),
        role="admin",
        full_name="Admin User",
        account_status="active"
    )
    # Reviewer
    reviewer = User(
        email="reviewer@example.com",
        password_hash=hash_password("reviewerpass123"),
        role="reviewer",
        full_name="Reviewer User",
        account_status="active"
    )
    # Worker 1
    worker1 = User(
        email="worker1@example.com",
        password_hash=hash_password("workerpass123"),
        role="worker",
        full_name="Worker One",
        account_status="active"
    )
    # Worker 2
    worker2 = User(
        email="worker2@example.com",
        password_hash=hash_password("workerpass123"),
        role="worker",
        full_name="Worker Two",
        account_status="active"
    )

    db_session.add_all([admin, reviewer, worker1, worker2])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(reviewer)
    await db_session.refresh(worker1)
    await db_session.refresh(worker2)

    return {
        "admin": admin,
        "reviewer": reviewer,
        "worker1": worker1,
        "worker2": worker2,
        "admin_token": create_access_token(admin.id, role="admin"),
        "reviewer_token": create_access_token(reviewer.id, role="reviewer"),
        "worker1_token": create_access_token(worker1.id, role="worker"),
        "worker2_token": create_access_token(worker2.id, role="worker"),
    }
