'use client';

import React, { useState, useEffect } from 'react';
import { Film, CheckCircle2, Clock, Check, HardDrive, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ChunkUploader } from '@/components/ChunkUploader';
import { formatBytes, formatDuration } from '@/lib/utils';

export default function WorkerPortalPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [taskList, subList] = await Promise.all([
        api.getTasks(),
        api.getWorkerSubmissions().catch(() => []),
      ]);
      setTasks(taskList);
      setSubmissions(subList);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError('Could not connect to FastAPI backend. Ensure backend is running at http://localhost:8000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClaim = async (task: any) => {
    try {
      setClaimingId(task.id);
      setError(null);
      const res = await api.claimTask(task.id);
      setActiveAssignment({
        assignmentId: res.assignment_id,
        taskId: task.id,
        taskTitle: task.title,
        minDuration: task.min_duration_seconds,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to claim task.');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Film className="w-5 h-5 text-emerald-400" />
          Worker Task Station
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Claim available video collection tasks, record to specifications, and upload raw media.
        </p>
      </div>

      {/* Error banner if backend down */}
      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Upload Console if Task Claimed */}
      {activeAssignment && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>ACTIVE ASSIGNMENT: {activeAssignment.assignmentId}</span>
            <span className="text-emerald-400">24-Hour Lease Active</span>
          </div>
          <ChunkUploader
            assignmentId={activeAssignment.assignmentId}
            taskTitle={activeAssignment.taskTitle}
            minDurationSeconds={activeAssignment.minDuration}
            onUploadSuccess={() => {
              setActiveAssignment(null);
              loadData();
            }}
            onCancel={() => setActiveAssignment(null)}
          />
        </div>
      )}

      {/* Available Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider font-mono">
            Available Collection Campaigns ({tasks.length})
          </h2>
          <button
            onClick={loadData}
            className="text-xs text-zinc-400 hover:text-zinc-200 font-mono"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
            Loading tasks from PostgreSQL...
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-zinc-800 rounded-lg">
            No published tasks found. Visit the Task Studio to publish one.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {task.category || 'General'}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Slots: {task.claimed_slots}/{task.total_slots}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-zinc-100">{task.title}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2">{task.description}</p>
              </div>

              {/* Requirement Badges */}
              <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {task.min_duration_seconds}s
                  </span>
                  <span>•</span>
                  <span>{task.min_resolution || '1080p'}</span>
                  <span>•</span>
                  <span>{task.required_codec || 'H.264'}</span>
                </div>

                <button
                  onClick={() => handleClaim(task)}
                  disabled={claimingId === task.id || (task.claimed_slots >= task.total_slots)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {claimingId === task.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3 h-3" />
                  )}
                  Claim Task
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Worker Submissions History */}
      {submissions.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider font-mono">
            My Recent Submissions ({submissions.length})
          </h2>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-zinc-200">{sub.file_name}</div>
                  <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
                    {formatBytes(sub.file_size_bytes || 0)} • {sub.duration_seconds || 0}s • Version {sub.submission_version}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                    sub.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    sub.status === 'qc_passed' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                    sub.status === 'qc_failed' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                    'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {sub.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
