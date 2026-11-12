'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, Pause, Play, CheckCircle, AlertCircle, Loader2, HardDrive, FileVideo, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/utils';

interface ChunkUploaderProps {
  assignmentId: string;
  taskTitle: string;
  minDurationSeconds: number;
  onUploadSuccess: (submission: any) => void;
  onCancel: () => void;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export function ChunkUploader({
  assignmentId,
  taskTitle,
  minDurationSeconds,
  onUploadSuccess,
  onCancel,
}: ChunkUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'preparing' | 'uploading' | 'paused' | 'processing_qc' | 'qc_done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [currentPart, setCurrentPart] = useState(0);
  const [totalParts, setTotalParts] = useState(0);
  const [completedSubmission, setCompletedSubmission] = useState<any>(null);

  const isPausedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setTotalBytes(selected.size);
      setUploadStatus('idle');
      setErrorMessage(null);
    }
  };

  const startUpload = async () => {
    if (!file) return;

    try {
      setUploadStatus('preparing');
      setErrorMessage(null);
      isPausedRef.current = false;

      // 1. Create real Submission record in FastAPI backend
      const submission = await api.createSubmission(assignmentId, file.name, file.size);
      const submissionId = submission.id;

      // 2. Initialize real Multipart Upload Session
      const calculatedParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      setTotalParts(calculatedParts);

      const session = await api.createUploadSession(submissionId, CHUNK_SIZE, calculatedParts);
      const presignedUrls = session.presigned_urls || [];

      setUploadStatus('uploading');

      const completedParts: { part_number: number; etag: string }[] = [];
      let bytesAccumulator = 0;

      // 3. Sequential Chunk Streaming
      for (let i = 0; i < calculatedParts; i++) {
        if (isPausedRef.current) {
          setUploadStatus('paused');
          return;
        }

        const partNumber = i + 1;
        setCurrentPart(partNumber);

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        // Find presigned URL for this part
        const urlItem = presignedUrls.find((u: any) => u.part_number === partNumber) || presignedUrls[i];
        if (!urlItem || !urlItem.upload_url) {
          throw new Error(`Missing upload URL for part ${partNumber}`);
        }

        // Upload part bytes directly
        const etag = await api.uploadPart(urlItem.upload_url, chunkBlob);
        completedParts.push({ part_number: partNumber, etag });

        bytesAccumulator += (end - start);
        setUploadedBytes(bytesAccumulator);
      }

      // 4. Complete Multipart Upload on Backend & Trigger FFmpeg QC
      setUploadStatus('processing_qc');
      const finalResult = await api.completeUpload(submissionId, completedParts, file.size);

      setCompletedSubmission(finalResult);
      setUploadStatus('qc_done');
      onUploadSuccess(finalResult);

    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message || 'Upload failed. Check backend connection.');
      setUploadStatus('error');
    }
  };

  const togglePause = () => {
    if (uploadStatus === 'uploading') {
      isPausedRef.current = true;
      setUploadStatus('paused');
    } else if (uploadStatus === 'paused') {
      isPausedRef.current = false;
      startUpload();
    }
  };

  const progressPercent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Video Upload Console</h2>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">Task: {taskTitle} (Min {minDurationSeconds}s)</p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
        >
          Cancel
        </button>
      </div>

      {/* File Dropzone / Selector */}
      {!file && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-zinc-950/40"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-200">Select or drop video file</p>
          <p className="text-xs text-zinc-500 mt-1">Accepts MP4 / MOV (5-minute target: sample_5min.mp4)</p>
        </div>
      )}

      {/* Selected File Details */}
      {file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-3">
              <FileVideo className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-zinc-200 truncate max-w-xs">{file.name}</p>
                <p className="text-[11px] font-mono text-zinc-500">{formatBytes(file.size)}</p>
              </div>
            </div>

            {uploadStatus === 'idle' && (
              <button
                onClick={() => setFile(null)}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Change
              </button>
            )}
          </div>

          {/* Progress Section */}
          {(uploadStatus === 'uploading' || uploadStatus === 'paused' || uploadStatus === 'preparing') && (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">
                  {uploadStatus === 'preparing' ? 'Initializing S3 session...' : `Streaming Chunk ${currentPart}/${totalParts}`}
                </span>
                <span className="text-zinc-200 font-semibold">{progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1">
                <span>{formatBytes(uploadedBytes)} of {formatBytes(totalBytes)}</span>
                <button
                  onClick={togglePause}
                  className="flex items-center gap-1 text-zinc-300 hover:text-white px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700"
                >
                  {uploadStatus === 'paused' ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
                  {uploadStatus === 'paused' ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          )}

          {/* Processing QC Stage */}
          {uploadStatus === 'processing_qc' && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-center space-y-2">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-zinc-200">Server Automated QC Inspection Running...</p>
              <p className="text-[11px] font-mono text-zinc-500">FastAPI backend is probing streams via FFmpeg (duration, resolution, audio)</p>
            </div>
          )}

          {/* Completed QC Stage */}
          {uploadStatus === 'qc_done' && completedSubmission && (
            <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Upload & QC Complete</h3>
                  <p className="text-[11px] text-zinc-400">Submission enqueued for human reviewer approval</p>
                </div>
              </div>

              {/* Live QC Results from Backend */}
              {completedSubmission.qc_run && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-900/40 text-[11px] font-mono">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-500 block">Duration</span>
                    <span className="text-emerald-400 font-semibold">{completedSubmission.duration_seconds || completedSubmission.qc_run?.extracted_metadata?.duration || 0}s</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-500 block">Codec</span>
                    <span className="text-emerald-400 font-semibold">{completedSubmission.qc_run?.extracted_metadata?.video_codec || 'h264'}</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-500 block">Resolution</span>
                    <span className="text-emerald-400 font-semibold">{completedSubmission.qc_run?.extracted_metadata?.width}x{completedSubmission.qc_run?.extracted_metadata?.height}</span>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-500 block">Audio Stream</span>
                    <span className="text-emerald-400 font-semibold">{completedSubmission.qc_run?.extracted_metadata?.audio_codec ? 'DETECTED' : 'PRESENT'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {uploadStatus === 'error' && (
            <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          {uploadStatus === 'idle' && (
            <button
              onClick={startUpload}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              Start Multipart Chunk Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}
