'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, QuizRoom, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
  Zap,
  PlusCircle,
  KeyRound,
  BookOpen,
  Trophy,
  Users,
  Lock,
  Globe,
  Sparkles,
  ArrowRight,
  Flame,
  Award,
  PenTool,
  Clock,
  ChevronRight,
  Play,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface DashboardViewProps {
  onCreateQuiz: () => void;
  onJoinRoom: (roomCode?: string) => void;
  onOpenStudy: () => void;
  onOpenProfile: () => void;
  onJoinSpecificRoom: (roomId: string) => void;
  onQuickSolo: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onCreateQuiz,
  onJoinRoom,
  onOpenStudy,
  onOpenProfile,
  onJoinSpecificRoom,
  onQuickSolo,
}) => {
  const { user, profile, signInWithGoogle } = useAuth();
  const [activeRooms, setActiveRooms] = useState<QuizRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');

  // Realtime subscription to live and waiting quiz rooms
  useEffect(() => {
    const q = query(
      collection(db, 'quizRooms'),
      where('status', 'in', ['WAITING', 'LIVE', 'STARTING']),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rooms: QuizRoom[] = [];
        snapshot.forEach((d) => rooms.push(d.data() as QuizRoom));
        // Sort newest first
        rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActiveRooms(rooms);
        setLoadingRooms(false);
      },
      (error) => {
        console.warn('Rooms query listener error, using resilient client-side filter:', error);
        const fallbackQ = query(collection(db, 'quizRooms'), limit(30));
        onSnapshot(
          fallbackQ,
          (snapshot) => {
            const rooms: QuizRoom[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as QuizRoom;
              if (['WAITING', 'LIVE', 'STARTING'].includes(data.status)) {
                rooms.push(data);
              }
            });
            rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setActiveRooms(rooms);
            setLoadingRooms(false);
          },
          () => setLoadingRooms(false)
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredRooms = activeRooms.filter((r) => {
    if (selectedSubjectFilter === 'All') return true;
    return r.subject.toLowerCase() === selectedSubjectFilter.toLowerCase();
  });

  const level = Math.floor((profile?.totalScore || 0) / 500) + 1;
  const currentLevelProgress = ((profile?.totalScore || 0) % 500) / 5; // 0 to 100%

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 text-white">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/60 border border-indigo-500/30 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-current" /> Level {level}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {profile?.classLevel || 'Class 10'} • {profile?.board || 'CBSE'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Realtime Multiplayer
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Welcome back,{' '}
              <span className="bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                {profile?.displayName || user?.displayName || 'Student'}!
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Compete with friends in real-time quiz rooms, generate AI questions from your exact chapter curriculum, and collaborate live on the whiteboard.
            </p>

            {/* XP progress */}
            <div className="space-y-1.5 pt-2 max-w-sm">
              <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                <span>XP Progress to Level {level + 1}</span>
                <span className="text-indigo-400 font-mono">{(profile?.totalScore || 0) % 500} / 500 XP</span>
              </div>
              <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden border border-slate-700/60">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${currentLevelProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick CTA cluster */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              onClick={() => {
                sound.playClick();
                if (!user) {
                  signInWithGoogle();
                } else {
                  onCreateQuiz();
                }
              }}
              className="px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Host Multiplayer Quiz</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onJoinRoom();
              }}
              className="px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Enter Room Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => {
            sound.playClick();
            if (!user) signInWithGoogle();
            else onCreateQuiz();
          }}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 text-left transition-all group shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">AI Quiz Generator</h3>
              <p className="text-xs text-slate-400 mt-1">
                Generate questions for any chapter in Science, Math, Physics, Chemistry.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-indigo-400 font-bold flex items-center gap-1 mt-4">
            <span>Create Room</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onQuickSolo();
          }}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 text-left transition-all group shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Solo Practice Arena</h3>
              <p className="text-xs text-slate-400 mt-1">
                Instant rapid assessment to warm up and test your chapter recall.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-purple-400 font-bold flex items-center gap-1 mt-4">
            <span>Start Practice</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenStudy();
          }}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">NCERT Study Library</h3>
              <p className="text-xs text-slate-400 mt-1">
                Official textbook chapter summaries, formulas, and key revision points.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-4">
            <span>Open Library</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenProfile();
          }}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 text-left transition-all group shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Achievements & Stats</h3>
              <p className="text-xs text-slate-400 mt-1">
                Track personal accuracy, unlock achievement badges, and climb rankings.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1 mt-4">
            <span>View Profile</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>

      {/* Live & Active Multiplayer Rooms */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-lg font-black text-white">Live Multiplayer Rooms</h2>
            <span className="text-xs text-slate-400">({filteredRooms.length} active)</span>
          </div>

          {/* Subject Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['All', 'Science', 'Physics', 'Chemistry', 'Mathematics'].map((sub) => (
              <button
                key={sub}
                onClick={() => {
                  sound.playClick();
                  setSelectedSubjectFilter(sub);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  selectedSubjectFilter === sub
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {loadingRooms ? (
          <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
            Connecting to Firestore realtime rooms...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80 p-8 space-y-3">
            <Users className="w-10 h-10 text-indigo-400 mx-auto opacity-40 animate-pulse" />
            <h3 className="text-sm font-bold text-white">No active rooms right now</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to host an AI quiz room for your classmates or enter a friend’s room code!
            </p>
            <button
              onClick={() => {
                sound.playClick();
                if (!user) signInWithGoogle();
                else onCreateQuiz();
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Room</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((r) => (
              <div
                key={r.roomId}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-lg flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {r.classLevel} • {r.subject}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                        r.privacy === 'PRIVATE'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {r.privacy === 'PRIVATE' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                      {r.privacy}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{r.title}</h3>
                  <p className="text-[11px] text-slate-400 truncate">{r.chapter}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <p>Host: <span className="text-slate-200 font-semibold">{r.hostName}</span></p>
                    <p>{r.questionCount} Questions • {r.timerSeconds}s</p>
                  </div>

                  <button
                    onClick={() => {
                      sound.playClick();
                      if (r.privacy === 'PRIVATE') {
                        onJoinRoom(r.roomCode);
                      } else {
                        onJoinSpecificRoom(r.roomId);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span>{r.status === 'LIVE' ? 'Join Arena' : 'Join Lobby'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
