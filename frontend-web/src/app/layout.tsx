import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'OmniVideo AI - Training Video Collection Platform',
  description: 'Enterprise data collection, chunked resumable video uploads, and automated QC verification for physical AI training.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Backend API: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">http://localhost:8000/api/v1</code></span>
            </div>
            <p>© {new Date().getFullYear()} OmniVideo AI Training Platform. MinIO S3 Multipart & Automated QC Engine.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
