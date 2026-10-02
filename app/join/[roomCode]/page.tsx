'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JoinRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.roomCode) {
      const code = String(params.roomCode).toUpperCase();
      // Redirect to home with roomCode query param
      router.push(`/?joinCode=${code}`);
    } else {
      router.push('/');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Connecting to QuizNova room...</p>
      </div>
    </div>
  );
}
