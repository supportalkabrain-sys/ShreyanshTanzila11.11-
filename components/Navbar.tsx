'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Sparkles,
  Zap,
  BookOpen,
  PlusCircle,
  LogIn,
  LogOut,
  User,
  Settings,
  Sun,
  Moon,
  KeyRound,
  Trophy,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface NavbarProps {
  onOpenCreate: () => void;
  onOpenJoin: () => void;
  onOpenStudy: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
  currentView?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreate,
  onOpenJoin,
  onOpenStudy,
  onOpenProfile,
  onOpenSettings,
  onGoHome,
  currentView,
}) => {
  const { user, profile, signInWithGoogle, signOut, toggleTheme } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const handleToggleTheme = () => {
    sound.playClick();
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    toggleTheme(next);
  };

  return (
    <nav className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/85 dark:bg-slate-950/90 border-b border-indigo-500/20 text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          onClick={() => {
            sound.playClick();
            onGoHome();
          }}
          className="flex items-center gap-3 group focus:outline-none"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 group-hover:scale-105 transition-all">
            <Zap className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                QuizNova
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 rounded uppercase tracking-wider">
                Multiplayer AI
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Realtime Study & Competition
            </span>
          </div>
        </button>

        {/* Center / Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onOpenStudy();
            }}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              currentView === 'study'
                ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span>NCERT Library</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenJoin();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white transition-all shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>Join Room</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenCreate();
            }}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Create Quiz</span>
            <span className="sm:hidden">Create</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* User Auth Section */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-full bg-slate-900/80 border border-indigo-500/30 hover:border-indigo-500/60 transition-all focus:outline-none"
              >
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-200 max-w-[110px] truncate">
                    {profile?.displayName || user.displayName || 'Student'}
                  </span>
                  <span className="text-[10px] text-indigo-400 font-medium">
                    {profile?.classLevel || 'Class 10'} • {profile?.totalScore || 0} XP
                  </span>
                </div>
                <img
                  src={
                    profile?.photoURL ||
                    user.photoURL ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`
                  }
                  alt="Profile"
                  className="w-8 h-8 rounded-full border border-purple-500/50 object-cover bg-slate-800"
                />
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-indigo-500/30 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-800">
                      <p className="text-xs font-bold text-white truncate">
                        {profile?.displayName || user.displayName}
                      </p>
                      <p className="text-[11px] text-indigo-400 truncate">
                        @{profile?.username || 'novastudent'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        sound.playClick();
                        onOpenProfile();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-indigo-600/20 rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4 text-indigo-400" />
                      <span>Profile & History</span>
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        sound.playClick();
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-indigo-600/20 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                      <span>Settings & Privacy</span>
                    </button>

                    <div className="my-1 border-t border-slate-800" />

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        sound.playClick();
                        signOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                sound.playClick();
                signInWithGoogle();
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-md transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Floating Bottom Bar for Handheld Phones (hidden on md+) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 flex items-center justify-around text-[10px] font-bold text-slate-400 shadow-2xl">
        <button
          onClick={() => {
            sound.playClick();
            onGoHome();
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            currentView === 'dashboard' ? 'text-indigo-400 bg-indigo-500/10' : 'hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenStudy();
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            currentView === 'study' ? 'text-purple-400 bg-purple-500/10' : 'hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>NCERT</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenCreate();
          }}
          className="flex flex-col items-center gap-1 py-1.5 px-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-600/40 active:scale-95 transition-all -mt-4 border-2 border-slate-950"
        >
          <PlusCircle className="w-5 h-5" />
          <span className="font-extrabold text-[9px] uppercase tracking-wider">Create</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenJoin();
          }}
          className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all hover:text-slate-200"
        >
          <KeyRound className="w-4 h-4" />
          <span>Join</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            if (!user) signInWithGoogle();
            else onOpenProfile();
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            currentView === 'profile' ? 'text-indigo-400 bg-indigo-500/10' : 'hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </div>
    </nav>
  );
};
