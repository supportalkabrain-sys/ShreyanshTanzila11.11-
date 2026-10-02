'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RoomWhiteboardRoute() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.roomId) {
      router.replace(`/?roomId=${params.roomId}&view=whiteboard`);
    } else {
      router.replace('/');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}
