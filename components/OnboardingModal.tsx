'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CURRICULUM_DATA } from '@/lib/studyData';
import { Sparkles, UserCheck, Shield, BookOpen, GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';
import { sound } from '@/lib/sound';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Alpha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Orion',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Spark',
];

export const OnboardingModal: React.FC = () => {
  const { user, needsOnboarding, completeOnboarding } = useAuth();
  const [username, setUsername] = useState(
    user?.displayName ? user.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) : 'student'
  );
  const [classLevel, setClassLevel] = useState('Class 10');
  const [board, setBoard] = useState('CBSE');
  const [bio, setBio] = useState('Studying hard & mastering quizzes on QuizNova!');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!needsOnboarding || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    sound.playClick();

    try {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters.');
      }
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        throw new Error('Username can only contain letters, numbers, and underscores.');
      }

      const success = await completeOnboarding({
        username: cleanUsername,
        classLevel,
        board,
        bio,
        photoURL: selectedAvatar,
      });

      if (success) {
        sound.playVictory();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile onboarding.');
      sound.playIncorrect();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 text-white animate-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 mb-3">
            <GraduationCap className="w-8 h-8 animate-bounce" />
          </div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
            Welcome to QuizNova!
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Let&apos;s personalize your student study profile before you start competing.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Choose Your Student Avatar
            </label>
            <div className="flex items-center justify-center gap-3">
              {AVATAR_OPTIONS.map((avatar, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    sound.playClick();
                    setSelectedAvatar(avatar);
                  }}
                  className={`p-1 rounded-full border-2 transition-all ${
                    selectedAvatar === avatar
                      ? 'border-indigo-400 scale-110 shadow-lg shadow-indigo-500/40'
                      : 'border-slate-800 hover:border-slate-600 opacity-70'
                  }`}
                >
                  <img src={avatar} alt="Avatar" className="w-9 h-9 rounded-full bg-slate-800" />
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Unique Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs font-bold">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={25}
                required
                placeholder="e.g. quantum_stud"
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Letters, numbers, underscores (3-25 chars). Must be unique.
            </p>
          </div>

          {/* Class & Board selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Class / Grade
              </label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                {CURRICULUM_DATA.map((c) => (
                  <option key={c.classLevel} value={c.classLevel}>
                    {c.classLevel}
                  </option>
                ))}
                <option value="Class 8">Class 8</option>
                <option value="Foundation & Olympiad">Foundation & Olympiad</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Curriculum / Board
              </label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="CBSE">CBSE (Central Board)</option>
                <option value="NCERT">NCERT Standard</option>
                <option value="ICSE">ICSE / ISC</option>
                <option value="State Board">State Board</option>
              </select>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Bio (Optional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              placeholder="What are you studying or preparing for?"
              className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Launch QuizNova Dashboard</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
