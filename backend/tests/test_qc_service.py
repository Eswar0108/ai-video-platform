import subprocess
import pytest
from pathlib import Path
from app.services.qc_service import qc_service

@pytest.fixture(scope="module")
def sample_video(tmp_path_factory):
    """
    Generates a valid 3-second 1920x1080 H.264 video with an AAC audio track using ffmpeg.
    """
    tmp_dir = tmp_path_factory.mktemp("qc_video")
    video_path = tmp_dir / "valid_test_video.mp4"

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
    assert res.returncode == 0, f"ffmpeg failed: {res.stderr.decode()}"
    return str(video_path)

def test_ffprobe_probing(sample_video: str):
    probe_data = qc_service.probe_stream(sample_video)
    assert "streams" in probe_data
    assert "format" in probe_data

    metadata = qc_service.extract_metadata(probe_data)
    assert metadata["duration"] >= 2.9
    assert metadata["video"]["codec"] in ["h264", "avc1"]
    assert metadata["video"]["width"] == 1920
    assert metadata["video"]["height"] == 1080
    assert metadata["audio"]["present"] is True
    assert metadata["audio"]["codec"] == "aac"

def test_qc_policy_passing(sample_video: str):
    task_policy = {
        "min_duration_seconds": 2,
        "max_duration_seconds": 10,
        "required_codec": "h264",
        "min_resolution": "1920x1080",
        "require_audio": True
    }
    result = qc_service.run_qc(sample_video, task_policy)
    assert result["status"] == "passed"
    assert result["error_message"] is None
    assert result["rule_results"]["duration_pass"] is True
    assert result["rule_results"]["codec_pass"] is True
    assert result["rule_results"]["resolution_pass"] is True
    assert result["rule_results"]["audio_pass"] is True

def test_qc_policy_failing_rules(sample_video: str):
    # 1. Failing duration
    policy_duration_fail = {
        "min_duration_seconds": 300,  # 5 min required, sample is only 3s
        "max_duration_seconds": 3600,
        "required_codec": "h264",
        "min_resolution": "1920x1080"
    }
    res_dur = qc_service.run_qc(sample_video, policy_duration_fail)
    assert res_dur["status"] == "failed"
    assert res_dur["rule_results"]["duration_pass"] is False
    assert "Duration" in res_dur["error_message"]

    # 2. Failing resolution (4K required, sample is 1080p)
    policy_res_fail = {
        "min_duration_seconds": 1,
        "required_codec": "h264",
        "min_resolution": "3840x2160"
    }
    res_res = qc_service.run_qc(sample_video, policy_res_fail)
    assert res_res["status"] == "failed"
    assert res_res["rule_results"]["resolution_pass"] is False
    assert "Resolution" in res_res["error_message"]

    # 3. Failing codec
    policy_codec_fail = {
        "min_duration_seconds": 1,
        "required_codec": "hevc",
        "min_resolution": "1920x1080"
    }
    res_codec = qc_service.run_qc(sample_video, policy_codec_fail)
    assert res_codec["status"] == "failed"
    assert res_codec["rule_results"]["codec_pass"] is False
    assert "codec" in res_codec["error_message"]
