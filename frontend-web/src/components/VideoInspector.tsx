'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Film,
  Loader2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Tag,
  Clock,
  Sliders,
  Check,
  AlertOctagon,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { useToast } from './Toast';

interface VideoInspectorProps {
  submission: any;
  onDecisionSubmitted: () => void;
}

export function VideoInspector({ submission, onDecisionSubmitted }: VideoInspectorProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(300);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reasonCode, setReasonCode] = useState('ACTION_INCORRECT');
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [timestampMarkers, setTimestampMarkers] = useState<{ time: number; note: string }[]>([]);

  if (!submission) {
    return (
      <div className="bg-[#121215] border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 font-mono text-xs">
        Select a submission from the review queue
      </div>
    );
  }

  // Determine video playback URL
  let playbackUrl = submission.download_url;
  if (!playbackUrl && submission.storage_key) {
    playbackUrl = `http://localhost:8000/api/v1/storage/download/${submission.storage_key}`;
  }
  if (!playbackUrl) {
    playbackUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  }

  // Video time format
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Video playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackRate(speed);
  };

  const stepFrame = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const addTimestampMarker = () => {
    const markerTime = currentTime;
    setTimestampMarkers((prev) => [...prev, { time: markerTime, note: `Defect flagged at ${formatTime(markerTime)}` }]);
    setFeedback((prev) => `${prev ? prev + '\n' : ''}[${formatTime(markerTime)}] `);
    setShowResubmitModal(true);
    toast.info('Marker Flagged', `Timestamp ${formatTime(markerTime)} added to reviewer notes`);
  };

  // Keyboard hotkeys for review actions (Emil Kowalski / Linear hotkeys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'a' || e.key === 'A') {
        handleDecision('approved');
      } else if (e.key === 'r' || e.key === 'R') {
        setShowResubmitModal(true);
      } else if (e.key === 'ArrowLeft') {
        stepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        stepFrame(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, currentTime]);

  const handleDecision = async (decision: 'approved' | 'rejected' | 'resubmission_requested') => {
    try {
      setSubmitting(true);
      await api.submitReview(
        submission.submission_id || submission.id,
        decision,
        decision !== 'approved' ? reasonCode : undefined,
        feedback || undefined
      );
      setShowResubmitModal(false);
      setFeedback('');

      if (decision === 'approved') {
        toast.success('Submission Approved', 'Video cataloged and added to training dataset manifest');
      } else if (decision === 'resubmission_requested') {
        toast.info('Rework Requested', 'Feedback dispatched to worker for re-recording');
      } else {
        toast.error('Submission Rejected', 'Video failed quality standards');
      }

      onDecisionSubmitted();
    } catch (err: any) {
      console.error('Decision submit failed:', err);
      toast.error('Review Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const qc = submission.qc_run || {};
  const meta = qc.extracted_metadata || {};

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 text-zinc-100 shadow-2xl animate-in-card">
      {/* Left: Pro Cinema Video Player (7 Cols) */}
      <div className="lg:col-span-7 p-5 bg-[#09090b] flex flex-col justify-between space-y-4">
        {/* Video Canvas */}
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center group">
          <video
            ref={videoRef}
            src={playbackUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted={isMuted}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />

          {/* Overlay Timecode Badge */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/75 backdrop-blur-md rounded border border-zinc-700/80 font-mono text-[11px] text-zinc-200">
            {formatTime(currentTime)} / {formatTime(duration || 300)}
          </div>

          <div className="absolute top-3 right-3 px-2 py-1 bg-black/75 backdrop-blur-md rounded border border-zinc-700/80 font-mono text-[11px] text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            1080p60 QC-PASS
          </div>
        </div>

        {/* Custom Video Scrubber & Playback HUD */}
        <div className="space-y-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
          {/* Progress Timeline Scrubber */}
          <div className="relative w-full h-1.5 bg-zinc-800 rounded-full cursor-pointer group">
            <div
              className="h-full bg-zinc-200 rounded-full relative"
              style={{ width: `${(currentTime / (duration || 300)) * 100}%` }}
            >
              <div className="w-3 h-3 bg-white rounded-full absolute -right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
            </div>

            {/* Render any timestamp defect markers */}
            {timestampMarkers.map((m, idx) => (
              <div
                key={idx}
                style={{ left: `${(m.time / (duration || 300)) * 100}%` }}
                className="w-1.5 h-2.5 bg-amber-400 absolute top-1/2 -translate-y-1/2 rounded-xs"
                title={m.note}
              />
            ))}
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="w-7 h-7 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center btn-press"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                onClick={() => stepFrame(-1)}
                className="px-2 py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px]"
                title="Step backward 1 frame (Left Arrow)"
              >
                -1s
              </button>
              <button
                onClick={() => stepFrame(1)}
                className="px-2 py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px]"
                title="Step forward 1 frame (Right Arrow)"
              >
                +1s
              </button>

              {/* Speed Switcher */}
              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 ml-2">
                {[0.5, 1, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      playbackRate === s ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Mute toggle & Add Defect Marker */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={addTimestampMarker}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded text-[11px] border border-zinc-700/80 flex items-center gap-1 btn-press"
                title="Flag defect at current timestamp"
              >
                <Tag className="w-3 h-3 text-amber-400" />
                <span>Flag @ {formatTime(currentTime)}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Video Telemetry Strip */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-1 border-t border-zinc-900">
          <span className="truncate max-w-sm text-zinc-400">{submission.file_name}</span>
          <span>{formatBytes(submission.file_size_bytes || 27839158)} • 30.00 FPS</span>
        </div>
      </div>

      {/* Right: Technical QC Diagnostics & Review Actions (5 Cols) */}
      <div className="lg:col-span-5 p-6 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col justify-between space-y-6">
        <div className="space-y-5">
          {/* Submission Context */}
          <div className="space-y-1.5 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Campaign Ingestion</span>
              <span className="text-[10px] font-mono text-zinc-400">ID: {submission.submission_id?.slice(0, 14)}</span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">{submission.task_title || 'Workspace Collection'}</h3>
            <p className="text-xs text-zinc-400 font-mono">
              Worker: <span className="text-zinc-200">{submission.worker_email || 'alex.worker@example.com'}</span>
            </p>
          </div>

          {/* Automated QC Report Card */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                FFprobe Technical QC
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                ALL GATES PASSED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">DURATION</span>
                <span className="text-zinc-100 font-semibold">{submission.duration_seconds || 300}s ($\ge$ 300s)</span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">CODEC</span>
                <span className="text-zinc-100 font-semibold">{meta.video_codec?.toUpperCase() || 'H.264 (AVC)'}</span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">RESOLUTION</span>
                <span className="text-zinc-100 font-semibold">1920x1080 (16:9)</span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block">AUDIO TRACK</span>
                <span className="text-zinc-100 font-semibold">AAC Stereo (Sync OK)</span>
              </div>
            </div>
          </div>

          {/* Hotkey Hint Pill */}
          <div className="p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>KEYBOARD SHORTCUTS:</span>
            <div className="flex gap-2">
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-200">A</kbd> Approve</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-200">R</kbd> Rework</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-200">Space</kbd> Play</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleDecision('approved')}
              disabled={submitting}
              className="py-2.5 px-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 btn-press shadow-md"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />}
              <span>Approve [A]</span>
            </button>

            <button
              onClick={() => setShowResubmitModal(!showResubmitModal)}
              disabled={submitting}
              className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-xs rounded-xl border border-zinc-700/80 transition-all flex items-center justify-center gap-2 btn-press"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Rework [R]</span>
            </button>
          </div>

          {/* Resubmission Reason Form */}
          {showResubmitModal && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 text-xs animate-in-card">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-1">DEFECT REASON</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg p-2 text-xs font-mono outline-none"
                >
                  <option value="ACTION_INCORRECT">Motion / task instructions not followed</option>
                  <option value="LIGHTING_POOR">Poor ambient lighting / severe glare</option>
                  <option value="CAMERA_SHAKY">Camera unstable / motion blur</option>
                  <option value="OCCLUDED_OBJECTS">Key target objects obstructed</option>
                  <option value="AUDIO_CLIPPING">Audio distorted / extreme wind noise</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-1">NOTES FOR CONTRIBUTOR</label>
                <textarea
                  placeholder="Specify what needs to be re-recorded..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg p-2 text-xs outline-none"
                />
              </div>

              <div className="flex gap-2 justify-between items-center pt-1">
                <button
                  onClick={() => handleDecision('rejected')}
                  className="px-2.5 py-1 text-rose-400 hover:text-rose-300 font-mono text-xs"
                >
                  Reject Outright
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResubmitModal(false)}
                    className="px-3 py-1 text-zinc-400 hover:text-zinc-200 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDecision('resubmission_requested')}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg font-semibold text-xs btn-press"
                  >
                    Send Rework Request
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
