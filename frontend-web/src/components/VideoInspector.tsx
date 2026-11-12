'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, AlertTriangle, ShieldCheck, Film, User, Clock, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/utils';

interface VideoInspectorProps {
  submission: any;
  onDecisionSubmitted: () => void;
}

export function VideoInspector({ submission, onDecisionSubmitted }: VideoInspectorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reasonCode, setReasonCode] = useState('ACTION_INCORRECT');
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!submission) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 font-mono text-xs">
        Select a submission from the review queue
      </div>
    );
  }

  // Determine video playback URL
  let playbackUrl = submission.download_url;
  if (!playbackUrl && submission.storage_key) {
    playbackUrl = `http://localhost:8000/api/v1/storage/download/${submission.storage_key}`;
  }

  const handleDecision = async (decision: 'approved' | 'rejected' | 'resubmission_requested') => {
    try {
      setSubmitting(true);
      setError(null);
      await api.submitReview(
        submission.submission_id || submission.id,
        decision,
        decision !== 'approved' ? reasonCode : undefined,
        feedback || undefined
      );
      setShowResubmitModal(false);
      onDecisionSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const qc = submission.qc_run || {};
  const meta = qc.extracted_metadata || {};
  const rules = qc.rule_results || {};

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 text-zinc-100">
      {/* Left: Video Player (7 Cols) */}
      <div className="lg:col-span-7 p-4 bg-zinc-950 flex flex-col justify-between space-y-3">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
          {playbackUrl ? (
            <video
              src={playbackUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-zinc-600 font-mono text-xs">No video stream available</div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span className="truncate max-w-sm">{submission.file_name}</span>
          <span>{formatBytes(submission.file_size_bytes || 0)}</span>
        </div>
      </div>

      {/* Right: Technical QC & Decision Controls (5 Cols) */}
      <div className="lg:col-span-5 p-5 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Submission Context */}
          <div className="space-y-1 pb-3 border-b border-zinc-800">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Campaign</span>
            <h3 className="text-sm font-semibold text-zinc-200">{submission.task_title || 'Workspace Collection'}</h3>
            <p className="text-xs text-zinc-400 font-mono">Worker: {submission.worker_email || submission.worker_id}</p>
          </div>

          {/* Automated QC Report Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Automated Technical QC
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                PASSED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">Duration</span>
                <span className="text-zinc-200 font-semibold">{submission.duration_seconds || meta.duration || 0}s</span>
              </div>
              <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">Codec</span>
                <span className="text-zinc-200 font-semibold">{meta.video_codec || 'h264'}</span>
              </div>
              <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">Resolution</span>
                <span className="text-zinc-200 font-semibold">{meta.width}x{meta.height}</span>
              </div>
              <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">Audio</span>
                <span className="text-zinc-200 font-semibold">{meta.audio_codec ? 'DETECTED' : 'PRESENT'}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded">
              {error}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-2 pt-4 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDecision('approved')}
              disabled={submitting}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve Video
            </button>

            <button
              onClick={() => setShowResubmitModal(!showResubmitModal)}
              disabled={submitting}
              className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs rounded-lg border border-zinc-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              Request Rework
            </button>
          </div>

          {/* Resubmission Reason Form */}
          {showResubmitModal && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2 text-xs">
              <label className="text-[10px] font-mono text-zinc-400 block">Rework Reason</label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-1.5 text-xs font-mono"
              >
                <option value="ACTION_INCORRECT">Action did not match task guidelines</option>
                <option value="LIGHTING_POOR">Poor lighting / severe shadows</option>
                <option value="CAMERA_SHAKY">Camera unstable / excessive motion</option>
                <option value="OCCLUDED_OBJECTS">Target objects occluded from view</option>
              </select>

              <textarea
                placeholder="Optional reviewer feedback notes for worker..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-2 text-xs h-16"
              />

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => handleDecision('rejected')}
                  className="px-2.5 py-1 text-rose-400 hover:text-rose-300 font-mono text-xs"
                >
                  Reject Outright
                </button>
                <button
                  onClick={() => handleDecision('resubmission_requested')}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs"
                >
                  Send Rework Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
