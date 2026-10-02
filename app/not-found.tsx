import Link from 'next/link';
import { ArrowLeft, Home, Sparkles } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white text-center">
      <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-indigo-500/30 shadow-2xl space-y-4">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
          QuizNova Page Not Found
        </h1>
        <p className="text-xs text-slate-400">
          The requested page or quiz room was moved or does not exist. Click below to return to your dashboard.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
        >
          <Home className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
