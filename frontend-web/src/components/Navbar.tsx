'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Film, CheckSquare, Database, ArrowRightLeft, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isWorker = pathname.includes('/worker') || pathname === '/';
  const isReviewer = pathname.startsWith('/admin/review');
  const isStudio = pathname === '/admin';

  return (
    <header className="sticky top-0 z-50 bg-[#090d16]/90 backdrop-blur border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand & Connection Status */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100 font-mono text-xs font-bold">
                <Film className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-zinc-100">
                  DataEngine <span className="text-zinc-500 font-mono text-xs">// AI Video Collection</span>
                </span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API: localhost:8000
            </div>
          </div>

          {/* Navigation Segments */}
          <nav className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <Link
              href="/worker"
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
                isWorker && !isReviewer && !isStudio
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Film className="w-3.5 h-3.5 text-blue-400" />
              Worker Station
            </Link>

            <Link
              href="/admin/review"
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
                isReviewer
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              Reviewer Station
            </Link>

            <Link
              href="/admin"
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
                isStudio
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Database className="w-3.5 h-3.5 text-purple-400" />
              Task Studio
            </Link>
          </nav>

          {/* Role Indicator & Demo Switcher */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-zinc-200">
                {isWorker && !isReviewer && !isStudio ? 'Alex Worker' : 'Admin QC Lead'}
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                {isWorker && !isReviewer && !isStudio ? 'worker@example.com' : 'admin@example.com'}
              </div>
            </div>

            <button
              onClick={() => router.push(isWorker && !isReviewer && !isStudio ? '/admin/review' : '/worker')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
              title="Toggle between Worker and Admin roles"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Switch View
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
