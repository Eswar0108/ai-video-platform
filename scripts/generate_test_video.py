#!/usr/bin/env python3
"""
Synthetic Video Generator for AI Video Platform Testing.
Generates compliant 1080p H.264 MP4 videos with audio in seconds.
"""
import argparse
import os
import subprocess
import sys
import tempfile

def generate_video(duration_seconds: int, output_path: str, resolution: str = "1920x1080", fps: int = 30):
    print(f"🎬 Generating synthetic test video...")
    print(f"   Target Duration: {duration_seconds} seconds ({duration_seconds // 60}m {duration_seconds % 60}s)")
    print(f"   Target Resolution: {resolution} @ {fps}fps")
    print(f"   Output File: {output_path}")

    # Step 1: Generate a 1-second base seed clip with ultrafast encoding
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_seed:
        seed_path = tmp_seed.name

    try:
        cmd_seed = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc=size={resolution}:rate={fps}",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
            "-t", "2",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            seed_path
        ]
        subprocess.run(cmd_seed, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)

        # Step 2: Stream copy / loop to desired duration in <1 second
        loops = (duration_seconds // 2) + 1
        cmd_loop = [
            "ffmpeg", "-y",
            "-stream_loop", str(loops),
            "-i", seed_path,
            "-t", str(duration_seconds),
            "-c", "copy",
            "-movflags", "+faststart",
            output_path
        ]
        subprocess.run(cmd_loop, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)

        size_bytes = os.path.getsize(output_path)
        size_mb = size_bytes / (1024 * 1024)
        print(f"✅ Video created successfully!")
        print(f"   Size: {size_mb:.2f} MB")
        print(f"   Path: {os.path.abspath(output_path)}")

    finally:
        if os.path.exists(seed_path):
            os.remove(seed_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic test video for AI Video Platform")
    parser.add_argument("--duration", type=int, default=300, help="Duration in seconds (default: 300 for 5 min)")
    parser.add_argument("--output", type=str, default="test_sample_5min.mp4", help="Output path (default: test_sample_5min.mp4)")
    parser.add_argument("--resolution", type=str, default="1920x1080", help="Resolution (default: 1920x1080)")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second (default: 30)")

    args = parser.parse_args()
    generate_video(args.duration, args.output, args.resolution, args.fps)

