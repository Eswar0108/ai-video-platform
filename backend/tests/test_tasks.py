import pytest
import httpx

@pytest.mark.asyncio
async def test_task_creation_and_listing(client: httpx.AsyncClient, test_users: dict):
    admin_headers = {"Authorization": f"Bearer {test_users['admin_token']}"}
    worker_headers = {"Authorization": f"Bearer {test_users['worker1_token']}"}

    # Worker cannot create task
    worker_create = await client.post(
        "/api/v1/tasks",
        headers=worker_headers,
        json={"title": "Unauthorized Task", "total_slots": 5}
    )
    assert worker_create.status_code == 403

    # Admin creates task
    task_payload = {
        "title": "Autonomous Driving Dashboard View",
        "description": "5-minute continuous driving capture in sunny weather",
        "category": "driving",
        "min_duration_seconds": 300,
        "max_duration_seconds": 600,
        "required_codec": "h264",
        "min_resolution": "1920x1080",
        "total_slots": 3
    }
    resp = await client.post("/api/v1/tasks", headers=admin_headers, json=task_payload)
    assert resp.status_code == 201
    task_data = resp.json()
    assert task_data["title"] == "Autonomous Driving Dashboard View"
    assert task_data["total_slots"] == 3
    assert task_data["claimed_slots"] == 0
    assert task_data["status"] == "published"
    task_id = task_data["id"]

    # Public / Worker listing
    list_resp = await client.get("/api/v1/tasks?status=published")
    assert list_resp.status_code == 200
    tasks = list_resp.json()
    assert any(t["id"] == task_id for t in tasks)

@pytest.mark.asyncio
async def test_task_claim_concurrency_and_slot_limits(client: httpx.AsyncClient, test_users: dict):
    admin_headers = {"Authorization": f"Bearer {test_users['admin_token']}"}
    worker1_headers = {"Authorization": f"Bearer {test_users['worker1_token']}"}
    worker2_headers = {"Authorization": f"Bearer {test_users['worker2_token']}"}

    # Create task with only 1 slot
    task_payload = {
        "title": "Drone High Altitude Inspection",
        "description": "Single slot exclusive task",
        "category": "aerial",
        "total_slots": 1
    }
    t_resp = await client.post("/api/v1/tasks", headers=admin_headers, json=task_payload)
    assert t_resp.status_code == 201
    task_id = t_resp.json()["id"]

    # Worker 1 claims slot 1
    claim1_resp = await client.post(f"/api/v1/tasks/{task_id}/claim", headers=worker1_headers)
    assert claim1_resp.status_code == 200
    claim1 = claim1_resp.json()
    assert claim1["task_id"] == task_id
    assert claim1["status"] == "assigned"
    assert claim1["task"]["claimed_slots"] == 1

    # Worker 1 cannot double-claim
    dup_claim = await client.post(f"/api/v1/tasks/{task_id}/claim", headers=worker1_headers)
    assert dup_claim.status_code == 400
    assert "already have an active claim" in dup_claim.json()["detail"]

    # Worker 2 attempts to claim saturated task -> 409 Conflict
    sat_claim = await client.post(f"/api/v1/tasks/{task_id}/claim", headers=worker2_headers)
    assert sat_claim.status_code == 409
    assert "already been claimed" in sat_claim.json()["detail"]
