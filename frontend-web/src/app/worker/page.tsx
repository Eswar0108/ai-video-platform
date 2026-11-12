'use client';

import React, { useState, useEffect } from 'react';
import { Film, Clock, ArrowRight, Loader2, CheckCircle2, DollarSign, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { ChunkUploader } from '@/components/ChunkUploader';
import { formatBytes } from '@/lib/utils';

export default function WorkerPortalPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [taskList, subList] = await Promise.all([
        api.getTasks(),
        api.getWorkerSubmissions().catch(() => []),
      ]);
      setTasks(taskList);
      setSubmissions(subList);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
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
      const res = await api.claimTask(task.id);
      setActiveAssignment({
        assignmentId: res.assignment_id,
        taskId: task.id,
        taskTitle: task.title,
        minDuration: task.min_duration_seconds,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Claim error:', err);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-7 space-y-7">
      {/* Page Header & Quick Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-400" />
            Worker Collection Cockpit
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Claim assigned video collection campaigns, record continuous footage, and submit for automated QC.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
          <div className="px-3 py-1 bg-[#0f1422] border border-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-[10px] block">CAMPAIGNS</span>
            <span className="text-zinc-200 font-semibold">{tasks.length} Active</span>
          </div>
          <div className="px-3 py-1 bg-[#0f1422] border border-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-[10px] block">MY SUBMISSIONS</span>
            <span className="text-emerald-400 font-semibold">{submissions.length} Total</span>
          </div>
        </div>
      </div>

      {/* Active Upload Console if Task Claimed */}
      {activeAssignment && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>ACTIVE ASSIGNMENT: {activeAssignment.assignmentId}</span>
            <span className="text-emerald-400">24-Hour Assignment Lease Reserved</span>
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
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Available Collection Campaigns ({tasks.length})
          </h2>
          <button
            onClick={loadData}
            className="text-xs text-zinc-400 hover:text-zinc-200 font-mono transition-colors"
          >
            Refresh List
          </button>
        </div>

        {loading && (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
            Loading collection campaigns...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-[#0f1422] border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-4.5 transition-all flex flex-col justify-between space-y-4 shadow-2xs group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                    {task.category || 'General'}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-emerald-400 font-semibold">${task.reward_usd ? task.reward_usd.toFixed(2) : '15.00'}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">{task.claimed_slots}/{task.total_slots} Slots</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  {task.title}
                </h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              </div>

              {/* Requirement Badges & Claim Button */}
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
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 btn-press"
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

      {/* Submissions Section */}
      {submissions.length > 0 && (
        <div className="space-y-3 pt-5 border-t border-zinc-800/80">
          <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Submission History ({submissions.length})
          </h2>

          <div className="bg-[#0f1422] border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/80">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-zinc-200">{sub.file_name}</div>
                  <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
                    {formatBytes(sub.file_size_bytes || 0)} • {sub.duration_seconds || 300}s • Version {sub.submission_version || 1}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                    sub.status === 'approved' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' :
                    sub.status === 'qc_passed' ? 'bg-blue-950/80 text-blue-400 border border-blue-800/60' :
                    'bg-amber-950/80 text-amber-400 border border-amber-800/60'
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
