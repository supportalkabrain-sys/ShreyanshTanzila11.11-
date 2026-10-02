'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, QuizRoom, Participant, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import {
  X,
  KeyRound,
  Lock,
  ArrowRight,
  AlertCircle,
  Users,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (roomId: string) => void;
  initialCode?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoined,
  initialCode = '',
}) => {
  const { user, profile, signInWithGoogle } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [foundRoom, setFoundRoom] = useState<QuizRoom | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setLoading(true);
    sound.playClick();

    try {
      const cleanInput = code.trim();
      const cleanCode = cleanInput.toUpperCase();
      let roomData: QuizRoom | null = null;

      // 1. Query by roomCode (e.g. 6-character room code)
      const q = query(collection(db, 'quizRooms'), where('roomCode', '==', cleanCode));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        roomData = querySnap.docs[0].data() as QuizRoom;
      } else {
        // 2. Also check if the user entered the roomId directly (e.g. room_179...)
        const directDoc = await getDoc(doc(db, 'quizRooms', cleanInput));
        if (directDoc.exists()) {
          roomData = directDoc.data() as QuizRoom;
        }
      }

      if (!roomData) {
        throw new Error('Room not found. Please double-check the 6-character room code.');
      }

      setFoundRoom(roomData);

      if (roomData.status === 'COMPLETED' || roomData.status === 'CANCELLED') {
        throw new Error('This quiz room has already ended or expired.');
      }

      if (roomData.privacy === 'PRIVATE') {
        setRequiresPassword(true);
      } else {
        // Direct public join
        await executeJoin(roomData.roomId);
      }
    } catch (err: any) {
      console.error('Join error:', err);
      setError(err.message || 'Unable to find or join room.');
      sound.playIncorrect();
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundRoom || !password.trim()) return;

    setError(null);
    setLoading(true);
    sound.playClick();

    try {
      // Secure server-side password verification
      const res = await fetch('/api/rooms/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          storedHash: foundRoom.passwordHash,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Incorrect password.');
      }

      await executeJoin(foundRoom.roomId);
    } catch (err: any) {
      setError(err.message || 'Password verification failed.');
      sound.playIncorrect();
    } finally {
      setLoading(false);
    }
  };

  const executeJoin = async (roomId: string) => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    try {
      // Add participant record
      const participant: Participant = {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Student',
        username: profile?.username || 'novastudent',
        photoURL: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
        isHost: foundRoom?.hostId === user.uid,
        isReady: false,
        score: 0,
        correctAnswers: 0,
        answeredQuestions: 0,
        averageResponseTime: 0,
        status: 'online',
        joinedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid), participant);

      sound.playVictory();
      onJoined(roomId);
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `quizRooms/${roomId}/participants/${user.uid}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 text-white animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Join Quiz Room</h3>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!requiresPassword ? (
          <form onSubmit={handleLookup} className="space-y-4 pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                6-Character Room Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. NOVA7X"
                maxLength={8}
                required
                className="w-full text-center text-xl font-mono tracking-widest uppercase py-3 bg-slate-950 border border-slate-700 rounded-xl text-indigo-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-bold"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                Ask your friend or host for their room invite code.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Find & Enter Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-4 animate-in fade-in">
            {foundRoom && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{foundRoom.title}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold flex items-center gap-1 border border-amber-500/40">
                    <Lock className="w-2.5 h-2.5" /> Private
                  </span>
                </div>
                <p className="text-slate-400">
                  {foundRoom.classLevel} • {foundRoom.subject}
                </p>
                <p className="text-[11px] text-indigo-400">Host: {foundRoom.hostName}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1">
                Enter Room Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room password"
                required
                autoFocus
                className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-amber-500/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRequiresPassword(false);
                  setPassword('');
                }}
                className="w-1/3 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="w-2/3 py-2 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Verify & Join Lobby</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
