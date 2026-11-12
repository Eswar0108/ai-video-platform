import asyncio
from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import hash_password
from app.models.user import User
from app.models.task import Task
from sqlalchemy import select

async def seed_data():
    print("🌱 Initializing and seeding database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if admin exists
        stmt = select(User).where(User.email == "admin@example.com")
        existing_admin = (await session.execute(stmt)).scalar_one_or_none()

        if not existing_admin:
            admin_user = User(
                email="admin@example.com",
                password_hash=hash_password("admin123"),
                role="admin",
                account_status="active",
                full_name="Platform Administrator"
            )
            session.add(admin_user)
            print("   ✅ Created Admin: admin@example.com / admin123")

        # Check if worker exists
        stmt = select(User).where(User.email == "worker@example.com")
        existing_worker = (await session.execute(stmt)).scalar_one_or_none()

        if not existing_worker:
            worker_user = User(
                email="worker@example.com",
                password_hash=hash_password("worker123"),
                role="worker",
                account_status="active",
                full_name="Alex Worker"
            )
            session.add(worker_user)
            print("   ✅ Created Worker: worker@example.com / worker123")

        # Check if sample 5-min task exists
        stmt = select(Task).limit(1)
        existing_task = (await session.execute(stmt)).scalar_one_or_none()

        if not existing_task:
            sample_task = Task(
                title="5-Minute Workspace Tour & Action Benchmark",
                description="Record a 5-minute continuous 1080p video of your workspace desk, computer setup, and daily work motions with clear ambient audio.",
                category="Spatial AI & Robotics",
                min_duration_seconds=300,  # 5 minutes
                max_duration_seconds=1800,
                required_codec="h264",
                min_resolution="1920x1080",
                total_slots=10,
                claimed_slots=0,
                status="published"
            )
            session.add(sample_task)

            sample_task_2 = Task(
                title="Object Manipulation & Hand Interaction Dataset",
                description="Record 5 minutes of continuous hand-object manipulation (unboxing, assembling, or handling desktop items).",
                category="Manipulation",
                min_duration_seconds=300,
                max_duration_seconds=1800,
                required_codec="h264",
                min_resolution="1920x1080",
                total_slots=15,
                claimed_slots=0,
                status="published"
            )
            session.add(sample_task_2)
            print("   ✅ Seeded sample 5-minute video tasks.")

        await session.commit()
    print("✨ Database ready!")

if __name__ == "__main__":
    asyncio.run(seed_data())

