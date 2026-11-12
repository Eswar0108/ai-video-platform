#!/usr/bin/env python3
"""
Local AI Training Hardware Ingestion Sync CLI.
Downloads approved video dataset items from the platform to the local GPU machine.
"""
import argparse
import hashlib
import json
import os
import sys
import requests
from tqdm import tqdm

def sync_approved_datasets(server_url: str, dest_dir: str, token: str = None):
    print("=" * 60)
    print("🤖 AI Training Hardware Ingestion Sync")
    print(f"   Platform Server: {server_url}")
    print(f"   Destination Directory: {os.path.abspath(dest_dir)}")
    print("=" * 60)

    os.makedirs(dest_dir, exist_ok=True)

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    endpoint = f"{server_url.rstrip('/')}/api/v1/datasets/approved"
    print(f"📡 Querying approved dataset manifest from {endpoint}...")

    try:
        response = requests.get(endpoint, headers=headers, timeout=10)
        response.raise_for_status()
        manifest = response.json()
    except Exception as e:
        print(f"❌ Failed to reach platform server: {e}")
        sys.exit(1)

    items = manifest.get("videos") or manifest.get("items") or []
    total_videos = manifest.get("total_videos", len(items))
    total_bytes = manifest.get("total_size_bytes", 0)
    total_mb = total_bytes / (1024 * 1024)

    print(f"📋 Found {total_videos} approved video(s) for AI training ({total_mb:.2f} MB total).")

    if not items:
        print("ℹ️ No approved videos pending download.")
        return

    downloaded_count = 0
    skipped_count = 0

    for idx, item in enumerate(items, 1):
        submission_id = item.get("submission_id") or item.get("id") or f"video_{idx}"
        file_name = item.get("file_name", f"video_{submission_id}.mp4")
        expected_size = item.get("file_size_bytes")
        download_url = item.get("download_url", "")
        if download_url.startswith("/"):
            download_url = f"{server_url.rstrip('/')}{download_url}"

        target_file = os.path.join(dest_dir, f"{submission_id}_{file_name}")

        # Check if already downloaded and size matches
        if os.path.exists(target_file):
            actual_size = os.path.getsize(target_file)
            if expected_size and actual_size == expected_size:
                print(f"⏩ [{idx}/{len(items)}] Already synced: {file_name} ({actual_size / (1024*1024):.2f} MB)")
                skipped_count += 1
                continue

        print(f"⬇️ [{idx}/{len(items)}] Downloading {file_name}...")
        try:
            with requests.get(download_url, stream=True, timeout=30) as r:
                r.raise_for_status()
                file_size = int(r.headers.get("content-length", expected_size or 0))
                with open(target_file, "wb") as f, tqdm(
                    total=file_size,
                    unit="B",
                    unit_scale=True,
                    unit_divisor=1024,
                    desc=file_name[:25]
                ) as bar:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1MB buffer
                        if chunk:
                            f.write(chunk)
                            bar.update(len(chunk))
            downloaded_count += 1
        except Exception as e:
            print(f"⚠️ Error downloading {file_name}: {e}")

    # Write local manifest index
    manifest_path = os.path.join(dest_dir, "dataset_manifest_latest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ AI Dataset Ingestion Complete!")
    print(f"   Downloaded: {downloaded_count}")
    print(f"   Already Up to Date: {skipped_count}")
    print(f"   Manifest saved to: {manifest_path}")
    print("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download approved video dataset to local AI hardware")
    parser.add_argument("--server", type=str, default="http://localhost:8000", help="Platform API URL")
    parser.add_argument("--dest", type=str, default="./local_training_dataset", help="Target folder for raw video files")
    parser.add_argument("--token", type=str, default=None, help="Optional admin/worker JWT token")

    args = parser.parse_args()
    sync_approved_datasets(args.server, args.dest, args.token)

