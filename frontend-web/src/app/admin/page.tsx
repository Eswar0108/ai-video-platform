'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Database, CheckSquare, Plus, ArrowRight } from 'lucide-react';
import { TaskStudio } from '@/components/TaskStudio';

export default function AdminPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            Task Studio & Campaign Management
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Create, configure, and publish structured video collection campaigns for human contributors.
          </p>
        </div>

        <Link
          href="/admin/review"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-mono border border-zinc-700 transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
          Open Review Station
          <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      </div>

      {/* Task Creation Component */}
      <TaskStudio onTaskCreated={() => setRefreshTrigger((prev) => prev + 1)} />
    </div>
  );
}
