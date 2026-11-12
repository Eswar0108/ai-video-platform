import json
import logging
import shutil
import subprocess
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class QCService:
    def __init__(self, ffprobe_path: Optional[str] = None):
        self.ffprobe_path = ffprobe_path or shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"

    def probe_stream(self, target_path_or_url: str, timeout: int = 60) -> Dict[str, Any]:
        """
        Executes ffprobe to inspect video streams byte-by-byte over HTTP or local path.
        Returns parsed JSON dict of container format and streams.
        """
        if not self.ffprobe_path or not shutil.which(self.ffprobe_path):
            raise RuntimeError(f"ffprobe executable not found at '{self.ffprobe_path}'")

        cmd = [
            self.ffprobe_path,
            "-v", "error",
            "-show_format",
            "-show_streams",
            "-of", "json",
            target_path_or_url
        ]

        logger.info(f"Running ffprobe command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout
        )

        if result.returncode != 0:
            err_msg = result.stderr.strip() or f"ffprobe exited with code {result.returncode}"
            logger.error(f"ffprobe probe failed: {err_msg}")
            raise RuntimeError(err_msg)

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Failed to parse ffprobe JSON output: {e}")

    def extract_metadata(self, probe_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts container format, video codec, resolution, duration, and audio presence.
        """
        fmt = probe_data.get("format", {})
        streams = probe_data.get("streams", [])

        # Duration & container
        try:
            duration = float(fmt.get("duration", 0.0))
        except (ValueError, TypeError):
            duration = 0.0

        try:
            size_bytes = int(fmt.get("size", 0))
        except (ValueError, TypeError):
            size_bytes = 0

        container_format = fmt.get("format_name", "")

        # Streams
        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        video_meta = {
            "codec": video_stream.get("codec_name", "") if video_stream else None,
            "width": int(video_stream.get("width", 0)) if video_stream else 0,
            "height": int(video_stream.get("height", 0)) if video_stream else 0,
            "resolution": f"{video_stream.get('width', 0)}x{video_stream.get('height', 0)}" if video_stream else "0x0",
            "fps": video_stream.get("r_frame_rate", "") if video_stream else "",
            "pix_fmt": video_stream.get("pix_fmt", "") if video_stream else "",
        }

        audio_meta = {
            "present": audio_stream is not None,
            "codec": audio_stream.get("codec_name", "") if audio_stream else None,
            "channels": int(audio_stream.get("channels", 0)) if audio_stream else 0,
            "sample_rate": audio_stream.get("sample_rate", "") if audio_stream else "",
        }

        return {
            "duration": duration,
            "size_bytes": size_bytes,
            "format": container_format,
            "video": video_meta,
            "audio": audio_meta,
        }

    def evaluate_policy(self, metadata: Dict[str, Any], task_policy: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates extracted metadata against task QC policy.
        task_policy keys:
            - min_duration_seconds (int)
            - max_duration_seconds (int)
            - required_codec (str, e.g. 'h264')
            - min_resolution (str, e.g. '1920x1080')
            - require_audio (bool, default True)
        """
        duration = metadata.get("duration", 0.0)
        video = metadata.get("video", {})
        audio = metadata.get("audio", {})

        min_duration = task_policy.get("min_duration_seconds", 300)
        max_duration = task_policy.get("max_duration_seconds", 3600)
        required_codec = (task_policy.get("required_codec") or "h264").lower()
        min_res_str = task_policy.get("min_resolution") or "1920x1080"
        require_audio = task_policy.get("require_audio", True)

        # Parse min resolution
        try:
            min_w, min_h = map(int, min_res_str.lower().split("x"))
        except Exception:
            min_w, min_h = 1920, 1080

        # Duration check
        duration_pass = duration >= min_duration and (max_duration is None or duration <= max_duration)

        # Video codec check: support h264 / avc1
        detected_codec = (video.get("codec") or "").lower()
        codec_pass = bool(detected_codec and (
            detected_codec == required_codec or
            (required_codec in ("h264", "avc1") and detected_codec in ("h264", "avc1"))
        ))

        # Resolution check
        width = video.get("width", 0)
        height = video.get("height", 0)
        resolution_pass = (width >= min_w and height >= min_h)

        # Audio check
        audio_pass = bool(audio.get("present")) if require_audio else True

        all_passed = duration_pass and codec_pass and resolution_pass and audio_pass

        failures = []
        if not duration_pass:
            failures.append(f"Duration {duration:.1f}s not in required range [{min_duration}s - {max_duration}s]")
        if not codec_pass:
            failures.append(f"Video codec '{detected_codec}' does not match required '{required_codec}'")
        if not resolution_pass:
            failures.append(f"Resolution {width}x{height} does not meet minimum {min_w}x{min_h}")
        if not audio_pass:
            failures.append("Audio stream is missing or not detected")

        error_message = "; ".join(failures) if failures else None

        return {
            "status": "passed" if all_passed else "failed",
            "rule_results": {
                "duration_pass": duration_pass,
                "codec_pass": codec_pass,
                "resolution_pass": resolution_pass,
                "audio_pass": audio_pass,
            },
            "error_message": error_message,
        }

    def run_qc(self, target_path_or_url: str, task_policy: Dict[str, Any]) -> Dict[str, Any]:
        """
        High-level QC entrypoint: probes video, extracts metadata, evaluates policy.
        """
        try:
            probe_data = self.probe_stream(target_path_or_url)
            metadata = self.extract_metadata(probe_data)
            evaluation = self.evaluate_policy(metadata, task_policy)

            return {
                "status": evaluation["status"],
                "extracted_metadata": metadata,
                "rule_results": evaluation["rule_results"],
                "error_message": evaluation["error_message"],
            }
        except Exception as e:
            logger.error(f"QC run encountered error: {e}")
            return {
                "status": "failed",
                "extracted_metadata": None,
                "rule_results": {
                    "duration_pass": False,
                    "codec_pass": False,
                    "resolution_pass": False,
                    "audio_pass": False,
                },
                "error_message": str(e),
            }

qc_service = QCService()
