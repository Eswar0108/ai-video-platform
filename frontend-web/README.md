# OmniVideo AI — Frontend Web Application

Modern, responsive Next.js 14 web application for physical AI training video collection, resilient chunked resumable MinIO/S3 uploads, automated quality control (QC) verification, and admin reviewer inspection.

## Features

- **Navigation & Role Switcher** (`src/components/Navbar.tsx`, `src/app/layout.tsx`):
  - Seamless toggle between Worker Mode and Admin/Reviewer Mode.
  - Active route highlighting and mobile responsive navigation drawer.

- **Worker Portal** (`src/app/page.tsx`, `src/app/worker/page.tsx`):
  - **Available Tasks Feed**: Filter tasks by category, view 5-minute video, 1080p, H.264 requirement badges, and slot quotas.
  - **Task Claiming**: Immediate assignment creation via `POST /api/v1/tasks/{id}/claim`.
  - **Chunked Resumable Video Uploader** (`src/components/ChunkUploader.tsx`):
    - Video input configured with camera capture for mobile Safari and Chrome.
    - Slices large video files into 5MB chunks.
    - Requests presigned multipart URLs via `/api/v1/submissions/{id}/upload-session`.
    - Direct chunk `PUT` to MinIO/S3 with `ETag` tracking.
    - Real-time progress bar (percentage, uploaded MB / total MB), live speed (MB/s), and ETA.
    - **Pause and Resume** controls without losing uploaded chunks.
    - Finalizes multipart upload via `/api/v1/submissions/{id}/complete-upload` and triggers automated QC verification.

- **Admin & Reviewer Workspace** (`src/app/admin/page.tsx`, `src/app/admin/review/page.tsx`):
  - **Review Queue**: Filterable by status (`all`, `pending_review`, `qc_passed`, `qc_failed`, `approved`, `rejected`).
  - **Video Reviewer Inspector** (`src/components/VideoInspector.tsx`):
    - HTML5 Video Player with custom scrubbing, 10s seek, and speed selectors (`0.5x`, `1x`, `1.25x`, `1.5x`, `2x`).
    - **QC Report Card**: Automated check indicators for Duration (≥ 300s), Codec (H.264), Resolution (1080p), and Audio track (`PASS` / `FAIL`).
    - **Action Bar**: Green **Approve**, Yellow **Request Resubmission**, and Red **Reject** with reviewer feedback notes.
  - **Task Studio** (`src/components/TaskStudio.tsx`): Admin form to publish new video prompts with customizable duration, resolution, codec, and quota slots.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production (verified TypeScript compilation)
npm run build
```
