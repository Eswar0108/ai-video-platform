#!/usr/bin/env python3
"""
Local AI Dataset Synchronization Script
Queries /api/v1/datasets/approved and downloads approved videos into a local directory with tqdm progress bars.
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import requests
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai_dataset_sync")

def download_file(url: str, destination: Path, expected_size: Optional[int] = None) -> bool:
    """
    Downloads a single file from url to destination with streaming and a tqdm progress bar.
    """
    temp_dest = destination.with_suffix(destination.suffix + ".tmp")
    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", expected_size or 0))
        block_size = 1024 * 1024  # 1MB buffer

        destination.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_dest, "wb") as f, tqdm(
            desc=destination.name[:30].ljust(30),
            total=total_size,
            unit="iB",
            unit_scale=True,
            unit_divisor=1024,
            leave=False
        ) as bar:
            for chunk in response.iter_content(chunk_size=block_size):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))

        # Atomic rename after successful download
        temp_dest.rename(destination)
        return True
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")
        if temp_dest.exists():
            temp_dest.unlink()
        return False

def sync_dataset(
    api_url: str,
    output_dir: str,
    token: Optional[str] = None,
    category: Optional[str] = None,
    force_redownload: bool = False
):
    api_url = api_url.rstrip("/")
    endpoint = f"{api_url}/datasets/approved"
    params = {}
    if category:
        params["category"] = category

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    logger.info(f"Fetching approved dataset manifest from {endpoint}...")
    try:
        resp = requests.get(endpoint, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        manifest_data: Dict[str, Any] = resp.json()
    except Exception as e:
        logger.error(f"Failed to retrieve dataset manifest: {e}")
        sys.exit(1)

    videos: List[Dict[str, Any]] = manifest_data.get("videos", [])
    total_videos = manifest_data.get("total_videos", len(videos))
    total_size = manifest_data.get("total_size_bytes", 0)

    logger.info(f"Retrieved manifest: {total_videos} videos ({total_size / (1024*1024):.2f} MB)")

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    success_count = 0
    skipped_count = 0

    print("\n" + "=" * 60)
    print(f" Syncing Approved Training Videos to: {out_path.resolve()}")
    print("=" * 60)

    for idx, video in enumerate(videos, start=1):
        filename = video.get("file_name") or f"video_{video.get('submission_id')}.mp4"
        file_dest = out_path / filename
        download_url = video.get("download_url")
        expected_size = video.get("file_size_bytes")

        # Resolve relative URLs
        if download_url and download_url.startswith("/"):
            # Strip '/api/v1' if present on base api_url to avoid double prefix
            base_server = api_url.split("/api/v1")[0]
            download_url = f"{base_server}{download_url}"

        if not download_url:
            logger.warning(f"[{idx}/{total_videos}] No download URL for submission {video.get('submission_id')}")
            continue

        # Check existing file
        if file_dest.exists() and not force_redownload:
            if expected_size and file_dest.stat().st_size == expected_size:
                logger.info(f"[{idx}/{total_videos}] Already up to date: {filename}")
                skipped_count += 1
                continue

        logger.info(f"[{idx}/{total_videos}] Downloading: {filename}")
        if download_file(download_url, file_dest, expected_size):
            success_count += 1

    # Save local manifest metadata for ML ingestion pipeline
    manifest_file = out_path / "dataset_manifest.json"
    with open(manifest_file, "w") as f:
        json.dump(manifest_data, f, indent=2)

    print("=" * 60)
    print(f" Sync Complete! Downloaded: {success_count}, Skipped (cached): {skipped_count}, Total: {total_videos}")
    print(f" Manifest saved to: {manifest_file.resolve()}")
    print("=" * 60 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Synchronize approved training videos for GPU pipelines")
    parser.add_argument("--api-url", default="http://localhost:8000/api/v1", help="Base URL for the platform API")
    parser.add_argument("--output-dir", default="./dataset_downloads", help="Directory where videos will be saved")
    parser.add_argument("--token", default=None, help="Optional JWT authorization bearer token")
    parser.add_argument("--category", default=None, help="Filter videos by task category")
    parser.add_argument("--force", action="store_true", help="Force redownload existing files")

    args = parser.parse_args()
    sync_dataset(
        api_url=args.api_url,
        output_dir=args.output_dir,
        token=args.token,
        category=args.category,
        force_redownload=args.force
    )

if __name__ == "__main__":
    main()
