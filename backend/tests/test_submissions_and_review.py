import subprocess
import pytest
import httpx
from pathlib import Path

@pytest.fixture(scope="module")
def valid_video_file(tmp_path_factory):
    tmp_dir = tmp_path_factory.mktemp("video_assets")
    video_path = tmp_dir / "valid_submission.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100",
        "-t", "3",
        "-c:v", "libx264",
        "-c:a", "aac",
        str(video_path)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert res.returncode == 0
    return video_path

@pytest.mark.asyncio
async def test_full_submission_qc_review_dataset_flow(
    client: httpx.AsyncClient,
    test_users: dict,
    valid_video_file: Path
):
    admin_headers = {"Authorization": f"Bearer {test_users['admin_token']}"}
    worker_headers = {"Authorization": f"Bearer {test_users['worker1_token']}"}
    reviewer_headers = {"Authorization": f"Bearer {test_users['reviewer_token']}"}

    # 1. Admin creates task
    task_res = await client.post(
        "/api/v1/tasks",
        headers=admin_headers,
        json={
            "title": "Pedestrian Street Crossing Benchmark",
            "description": "Footage of street crossing pedestrians",
            "category": "robotics",
            "min_duration_seconds": 2,
            "max_duration_seconds": 10,
            "required_codec": "h264",
            "min_resolution": "1920x1080",
            "total_slots": 5
        }
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # 2. Worker claims task
    claim_res = await client.post(f"/api/v1/tasks/{task_id}/claim", headers=worker_headers)
    assert claim_res.status_code == 200
    assignment_id = claim_res.json()["assignment_id"]

    # 3. Worker creates submission
    video_bytes = valid_video_file.read_bytes()
    video_size = len(video_bytes)

    sub_res = await client.post(
        "/api/v1/submissions",
        headers=worker_headers,
        json={
            "assignment_id": assignment_id,
            "file_name": "street_crossing_01.mp4",
            "file_size_bytes": video_size
        }
    )
    assert sub_res.status_code == 201
    submission_data = sub_res.json()
    submission_id = submission_data["id"]
    assert submission_data["status"] == "uploading"

    # 4. Worker initiates upload session (2 parts)
    chunk_size = video_size // 2
    part1_data = video_bytes[:chunk_size]
    part2_data = video_bytes[chunk_size:]

    session_res = await client.post(
        f"/api/v1/submissions/{submission_id}/upload-session",
        headers=worker_headers,
        json={
            "part_size_bytes": chunk_size,
            "total_parts": 2
        }
    )
    assert session_res.status_code == 200
    session_data = session_res.json()
    presigned_urls = session_data["presigned_urls"]
    assert len(presigned_urls) == 2

    # 5. Worker uploads parts
    # Part 1
    p1_url = presigned_urls[0]["upload_url"]
    p1_resp = await client.put(p1_url, content=part1_data)
    assert p1_resp.status_code == 200
    etag1 = p1_resp.headers["etag"]

    # Part 2
    p2_url = presigned_urls[1]["upload_url"]
    p2_resp = await client.put(p2_url, content=part2_data)
    assert p2_resp.status_code == 200
    etag2 = p2_resp.headers["etag"]

    # 6. Worker completes upload -> triggers automatic QC
    complete_res = await client.post(
        f"/api/v1/submissions/{submission_id}/complete-upload",
        headers=worker_headers,
        json={
            "parts": [
                {"part_number": 1, "etag": etag1},
                {"part_number": 2, "etag": etag2}
            ],
            "file_size_bytes": video_size
        }
    )
    assert complete_res.status_code == 200
    completed_sub = complete_res.json()
    assert completed_sub["status"] == "qc_passed"
    assert completed_sub["qc_run"]["status"] == "passed"
    assert completed_sub["duration_seconds"] >= 2

    # 7. Reviewer checks queue
    queue_res = await client.get("/api/v1/review/queue", headers=reviewer_headers)
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert any(item["submission_id"] == submission_id for item in queue)

    # 8. Reviewer approves submission
    review_res = await client.post(
        f"/api/v1/submissions/{submission_id}/review",
        headers=reviewer_headers,
        json={
            "decision": "approved",
            "feedback_notes": "High quality video, passed all criteria."
        }
    )
    assert review_res.status_code == 200
    assert review_res.json()["decision"] == "approved"

    # Verify submission status is now 'approved'
    sub_detail = await client.get(f"/api/v1/submissions/{submission_id}", headers=worker_headers)
    assert sub_detail.json()["status"] == "approved"

    # 9. Dataset Manifest includes the approved video
    dataset_res = await client.get("/api/v1/datasets/approved")
    assert dataset_res.status_code == 200
    manifest = dataset_res.json()
    assert manifest["total_videos"] >= 1
    approved_sub = next((v for v in manifest["videos"] if v["submission_id"] == submission_id), None)
    assert approved_sub is not None
    assert approved_sub["video_codec"] in ["h264", "avc1"]
    assert approved_sub["resolution"] == "1920x1080"
    assert "download_url" in approved_sub
