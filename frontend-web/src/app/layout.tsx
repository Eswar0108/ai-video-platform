import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'OmniVideo | AI Training Video Collection & QC Engine',
  description: 'Enterprise video collection pipelines, 5-minute chunked uploads, automated FFmpeg QC inspection, and reviewer stations for physical AI training.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
        <ToastProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-800/80 bg-[#09090b] py-6 mt-16 text-zinc-500 text-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  OmniVideo Engine v1.0
                </span>
                <span>•</span>
                <span className="text-zinc-500">FFprobe Automated QC Active</span>
                <span>•</span>
                <span className="text-zinc-500">MinIO / S3 Resumable Transfer</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">
                Physical AI Video Data Operations • Zero Egress Sync
              </p>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
