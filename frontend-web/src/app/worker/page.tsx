'use client';

import React, { useState, useEffect } from 'react';
import {
  Film,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  DollarSign,
  Layers,
  Search,
  Filter,
  Info,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { ChunkUploader } from '@/components/ChunkUploader';
import { formatBytes } from '@/lib/utils';
import { useToast } from '@/components/Toast';

export default function WorkerPortalPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);

  // Filters & Guidelines Modal
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewingGuidelinesTask, setViewingGuidelinesTask] = useState<any | null>(null);

  // Active Lease Timer (24 hours simulated countdown)
  const [leaseSecondsRemaining, setLeaseSecondsRemaining] = useState<number>(86395);

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

  // Lease countdown tick
  useEffect(() => {
    if (!activeAssignment) return;
    const interval = setInterval(() => {
      setLeaseSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeAssignment]);

  const formatLeaseTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClaim = async (task: any) => {
    try {
      setClaimingId(task.id);
      const res = await api.claimTask(task.id);
      setActiveAssignment({
        assignmentId: res.assignment_id,
        taskId: task.id,
        taskTitle: task.title,
        minDuration: task.min_duration_seconds,
        category: task.category,
      });
      setLeaseSecondsRemaining(86400); // 24-hr lease
      toast.success('Campaign Claimed', '24-hour lease reserved. Complete video upload to earn reward.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Claim error:', err);
      toast.error('Claim Failed', err.message);
    } finally {
      setClaimingId(null);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Spatial AI & Robotics', 'Manipulation', 'Egocentric Vision'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header & High-Level Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Worker Collection Station</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300">
              LEASES ACTIVE
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Claim structured video tasks, record continuous 1080p footage, and submit for automated FFprobe QC verification.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3.5 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-[10px] block">CAMPAIGNS</span>
            <span className="text-zinc-100 font-semibold">{tasks.length} Available</span>
          </div>
          <div className="px-3.5 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg">
            <span className="text-zinc-500 text-[10px] block">VERIFIED SUBMISSIONS</span>
            <span className="text-emerald-400 font-semibold">{submissions.length} Processed</span>
          </div>
        </div>
      </div>

      {/* Active Assignment Banner & Ingestion Console */}
      {activeAssignment && (
        <div className="space-y-3 p-4 bg-zinc-900/60 border border-zinc-700/80 rounded-2xl animate-in-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300 font-semibold">ACTIVE LEASE: {activeAssignment.assignmentId}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">{activeAssignment.taskTitle}</span>
            </div>

            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>LEASE RESERVED:</span>
              <span className="text-amber-400 font-semibold">{formatLeaseTime(leaseSecondsRemaining)}</span>
            </div>
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

      {/* Campaign Discovery Filters & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap btn-press ${
                  selectedCategory === cat
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none"
            />
          </div>
        </div>

        {/* Task Grid */}
        {loading && (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
            Loading collection campaigns...
          </div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
            No matching collection campaigns found for query.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const slotsLeft = task.total_slots - (task.claimed_slots || 0);
            const isFull = slotsLeft <= 0;

            return (
              <div
                key={task.id}
                className="bg-[#121215] border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-5 transition-all flex flex-col justify-between space-y-4 group shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                      {task.category || 'General'}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-zinc-100 font-bold">
                        ${task.reward_usd ? task.reward_usd.toFixed(2) : '15.00'}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className={`text-[11px] ${isFull ? 'text-rose-400' : 'text-zinc-400'}`}>
                        {task.claimed_slots}/{task.total_slots} Slots
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                    {task.title}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                </div>

                {/* Specs, Guidelines Trigger & Claim Button */}
                <div className="pt-3.5 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {task.min_duration_seconds}s
                    </span>
                    <span>•</span>
                    <span>1080p</span>
                    <span>•</span>
                    <button
                      onClick={() => setViewingGuidelinesTask(task)}
                      className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 flex items-center gap-0.5 ml-1"
                    >
                      Guidelines
                    </button>
                  </div>

                  <button
                    onClick={() => handleClaim(task)}
                    disabled={claimingId === task.id || isFull}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 btn-press ${
                      isFull
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-sm'
                    }`}
                  >
                    {claimingId === task.id ? (
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-900" />
                    ) : (
                      <ArrowRight className="w-3 h-3" />
                    )}
                    {isFull ? 'Slots Filled' : 'Claim Lease'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission History Section */}
      {submissions.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              My Submissions & Ingestion History ({submissions.length})
            </h2>
            <button
              onClick={loadData}
              className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
            >
              Sync Status
            </button>
          </div>

          <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/80">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-200">{sub.file_name}</div>
                    <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
                      {formatBytes(sub.file_size_bytes || 27839158)} • {sub.duration_seconds || 300}s duration • Version {sub.submission_version || 1}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded font-mono text-[10px] ${
                      sub.status === 'approved'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        : sub.status === 'qc_passed'
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                    }`}
                  >
                    {sub.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Guidelines Modal */}
      {viewingGuidelinesTask && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 animate-in-card shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Acceptance Criteria
                </span>
                <h3 className="text-base font-semibold text-zinc-100 mt-0.5">
                  {viewingGuidelinesTask.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingGuidelinesTask(null)}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-zinc-300">
              <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg">
                <p className="leading-relaxed text-zinc-300">{viewingGuidelinesTask.description}</p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Technical Checklist
                </span>
                <ul className="space-y-1.5 text-[11px] text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Minimum continuous duration: <strong>{viewingGuidelinesTask.min_duration_seconds} seconds</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Resolution: <strong>1080p (1920x1080)</strong> or higher</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Continuous unedited footage — no jump cuts, timelapses, or filters</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Clear ambient sound with minimal heavy wind or clipping</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg flex items-start gap-2.5 text-[11px] text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Videos failing FFprobe automated duration or resolution gates will be rejected immediately before human review.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setViewingGuidelinesTask(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  const task = viewingGuidelinesTask;
                  setViewingGuidelinesTask(null);
                  handleClaim(task);
                }}
                className="px-4 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg btn-press shadow-sm"
              >
                Claim This Task Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
