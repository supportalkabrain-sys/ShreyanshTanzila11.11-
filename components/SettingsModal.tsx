'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  X,
  Settings,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Shield,
  Sliders,
  Check,
  Globe,
  Lock,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, toggleTheme } = useAuth();

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(profile?.theme || 'dark');
  const [soundEnabled, setSoundEnabled] = useState(profile?.soundEnabled ?? true);
  const [animationsEnabled, setAnimationsEnabled] = useState(profile?.animationsEnabled ?? true);
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>(profile?.profileVisibility || 'PUBLIC');
  const [defaultDifficulty, setDefaultDifficulty] = useState(profile?.defaultDifficulty || 'Medium');
  const [defaultQuestionCount, setDefaultQuestionCount] = useState(profile?.defaultQuestionCount || 5);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();

    sound.setEnabled(soundEnabled);
    toggleTheme(theme);

    await updateProfile({
      theme,
      soundEnabled,
      animationsEnabled,
      profileVisibility: privacy,
      defaultDifficulty,
      defaultQuestionCount,
    });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 text-white animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Settings & Preferences</h3>
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

        <form onSubmit={handleSave} className="space-y-4 pt-4 text-xs">
          {/* Theme */}
          <div>
            <label className="block text-slate-300 font-bold mb-2">Display Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`py-2 px-3 rounded-xl border font-semibold capitalize flex items-center justify-center gap-1.5 transition-all ${
                    theme === t
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {t === 'dark' ? <Moon className="w-3.5 h-3.5" /> : t === 'light' ? <Sun className="w-3.5 h-3.5" /> : null}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Animation Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2.5">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <p className="font-bold text-slate-200">Audio Sound Effects</p>
                  <p className="text-[10px] text-slate-400">Timer ticks, correct answer chimes</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="font-bold text-slate-200">Dynamic Animations</p>
                  <p className="text-[10px] text-slate-400">Confetti celebration & transitions</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={animationsEnabled}
                onChange={(e) => setAnimationsEnabled(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Default Quiz Preferences */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <p className="font-bold text-slate-300">Default Quiz Preferences</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Difficulty</label>
                <select
                  value={defaultDifficulty}
                  onChange={(e) => setDefaultDifficulty(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Olympiad">Olympiad</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Question Count</label>
                <select
                  value={defaultQuestionCount}
                  onChange={(e) => setDefaultQuestionCount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions</option>
                </select>
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="block text-slate-300 font-bold mb-1.5">Profile Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrivacy('PUBLIC')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-left ${
                  privacy === 'PUBLIC'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Public Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy('PRIVATE')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-left ${
                  privacy === 'PRIVATE'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Private Profile</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Preferences Saved!</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
