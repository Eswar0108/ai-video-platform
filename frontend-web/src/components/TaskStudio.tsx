'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Layers,
  Pause,
  Play,
  Clock,
  DollarSign,
  Users
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from './Toast';

export function TaskStudio({ onTaskCreated }: { onTaskCreated: () => void }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Spatial AI & Robotics');
  const [duration, setDuration] = useState(300); // 5 min default
  const [slots, setSlots] = useState(10);
  const [reward, setReward] = useState(15.0);
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = async () => {
    try {
      setLoadingTasks(true);
      const list = await api.getTasks();
      setTasks(list);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const applyTemplate = (preset: {
    title: string;
    description: string;
    category: string;
    duration: number;
    slots: number;
    reward: number;
  }) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setCategory(preset.category);
    setDuration(preset.duration);
    setSlots(preset.slots);
    setReward(preset.reward);
    toast.info('Template Applied', preset.title);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      setSubmitting(true);
      await api.createTask({
        title,
        description,
        category,
        min_duration_seconds: duration,
        max_duration_seconds: duration * 6,
        required_codec: 'h264',
        min_resolution: '1920x1080',
        total_slots: slots,
        reward_usd: reward,
      });

      toast.success('Campaign Published', 'Now visible on all worker collection stations');
      setTitle('');
      setDescription('');
      setShowCreateModal(false);
      loadTasks();
      onTaskCreated();
    } catch (err: any) {
      toast.error('Publish Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick stats
  const totalSlots = tasks.reduce((acc, t) => acc + (t.total_slots || 10), 0);
  const claimedSlots = tasks.reduce((acc, t) => acc + (t.claimed_slots || 0), 0);
  const totalBudget = tasks.reduce(
    (acc, t) => acc + (t.reward_usd || 15.0) * (t.total_slots || 10),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Operations KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">ACTIVE CAMPAIGNS</span>
          <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">{tasks.length} Live</span>
        </div>
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">COLLECTION PROGRESS</span>
          <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">
            {claimedSlots} / {totalSlots} Slots
          </span>
        </div>
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">ALLOCATED REWARDS</span>
          <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">
            ${totalBudget.toFixed(2)}
          </span>
        </div>
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">TARGET CALIBRATION</span>
          <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">1080p H.264</span>
        </div>
      </div>

      {/* Campaigns Management Table */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-800/80">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Live Video Collection Campaigns</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Structured collection tasks distributed to human contributors.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 btn-press shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        </div>

        {loadingTasks ? (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
            Loading campaigns...
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {tasks.map((task) => {
              const progress = Math.round(((task.claimed_slots || 0) / task.total_slots) * 100);
              return (
                <div key={task.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1.5 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                        {task.category || 'Spatial AI'}
                      </span>
                      <span className="text-zinc-500 text-[11px] font-mono">ID: {task.id}</span>
                    </div>
                    <h3 className="font-semibold text-zinc-100 text-sm">{task.title}</h3>
                    <p className="text-zinc-400 line-clamp-1 text-xs">{task.description}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Progress Bar */}
                    <div className="min-w-[140px] space-y-1 font-mono">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>SLOTS FILLED</span>
                        <span>{task.claimed_slots}/{task.total_slots} ({progress}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-200 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Reward & Specs */}
                    <div className="text-right font-mono text-xs">
                      <div className="font-semibold text-zinc-100">${(task.reward_usd || 15).toFixed(2)}/vid</div>
                      <div className="text-[10px] text-zinc-500">{task.min_duration_seconds}s • 1080p</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Campaign Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 animate-in-card shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Campaign Studio
                </span>
                <h3 className="text-base font-semibold text-zinc-100 mt-0.5">
                  Publish Video Collection Campaign
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-zinc-400 block uppercase">
                1-Click Domain Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate({
                      title: '5-Minute Continuous Workspace Tour & Object Inspection',
                      description: 'Record continuous unedited footage walking around desktop workspaces and manipulating physical tools.',
                      category: 'Spatial AI & Robotics',
                      duration: 300,
                      slots: 10,
                      reward: 15.0,
                    })
                  }
                  className="p-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-left transition-colors text-xs space-y-1"
                >
                  <div className="font-semibold text-zinc-200">Spatial Room 3D</div>
                  <div className="text-[10px] font-mono text-zinc-500">5m • 1080p • $15.00</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyTemplate({
                      title: 'Bimanual Hand Dexterity & Small Component Assembly',
                      description: 'Record two-handed manipulation of desktop objects, tools, or electronics. Maintain hands in frame.',
                      category: 'Manipulation',
                      duration: 300,
                      slots: 15,
                      reward: 18.5,
                    })
                  }
                  className="p-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-left transition-colors text-xs space-y-1"
                >
                  <div className="font-semibold text-zinc-200">Hand Dexterity</div>
                  <div className="text-[10px] font-mono text-zinc-500">5m • 1080p • $18.50</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyTemplate({
                      title: 'First-Person Point-of-View Tool Trajectory Benchmark',
                      description: 'Capture first-person point-of-view actions using hand tools or household implements without motion blur.',
                      category: 'Egocentric Vision',
                      duration: 300,
                      slots: 8,
                      reward: 22.0,
                    })
                  }
                  className="p-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-left transition-colors text-xs space-y-1"
                >
                  <div className="font-semibold text-zinc-200">Egocentric POV</div>
                  <div className="text-[10px] font-mono text-zinc-500">5m • 1080p • $22.00</div>
                </button>
              </div>
            </div>

            {/* Campaign Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-mono mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5-Minute Kitchen Object Interaction"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-lg p-2.5 text-zinc-200 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-mono mb-1">Contributor Instructions & Acceptance Criteria</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe camera angles, continuous motions, lighting standards, and prohibited actions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-lg p-2.5 text-zinc-200 outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono mb-1">Domain</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono mb-1">Min Duration (s)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono mb-1">Slots</label>
                  <input
                    type="number"
                    value={slots}
                    onChange={(e) => setSlots(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono mb-1">Reward ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={reward}
                    onChange={(e) => setReward(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg btn-press flex items-center gap-1.5 shadow-sm"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-900" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Publish to Workers</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
