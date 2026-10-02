'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?view=profile');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}
