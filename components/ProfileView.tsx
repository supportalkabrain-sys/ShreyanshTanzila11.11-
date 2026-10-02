'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, QuizResult, UserAchievement, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  User,
  Shield,
  Trophy,
  History,
  Award,
  CheckCircle2,
  Calendar,
  Sparkles,
  Edit2,
  Lock,
  Globe,
  Star,
  Zap,
  BookOpen,
} from 'lucide-react';
import { CURRICULUM_DATA } from '@/lib/studyData';
import { sound } from '@/lib/sound';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Alpha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Orion',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Spark',
];

interface ProfileViewProps {
  onBack: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onBack }) => {
  const { user, profile, updateProfile, claimUsername } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'achievements'>('profile');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [classLevel, setClassLevel] = useState(profile?.classLevel || 'Class 10');
  const [board, setBoard] = useState(profile?.board || 'CBSE');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>(profile?.profileVisibility || 'PUBLIC');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || AVATAR_OPTIONS[0]);

  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch Quiz History & Achievements
  useEffect(() => {
    if (!user) return;

    const fetchHistoryAndAchievements = async () => {
      try {
        // Results
        const qRes = query(collection(db, 'quizResults'), where('uid', '==', user.uid));
        const resSnap = await getDocs(qRes);
        const rList: QuizResult[] = [];
        resSnap.forEach((d) => rList.push(d.data() as QuizResult));
        rList.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
        setQuizHistory(rList);

        // Achievements
        const qAch = query(collection(db, 'userAchievements'), where('uid', '==', user.uid));
        const achSnap = await getDocs(qAch);
        const aList: UserAchievement[] = [];
        achSnap.forEach((d) => aList.push(d.data() as UserAchievement));
        setAchievements(aList);
      } catch (err) {
        console.error('History fetch error:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistoryAndAchievements();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    sound.playClick();

    try {
      const cleanUser = username.trim().toLowerCase();
      if (cleanUser !== profile?.username) {
        // Attempt username claim
        await claimUsername(cleanUser);
      }

      await updateProfile({
        displayName: displayName.trim(),
        username: cleanUser,
        bio: bio.trim(),
        classLevel,
        board,
        profileVisibility: privacy,
        photoURL,
      });

      setStatusMsg({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
      sound.playVictory();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
      sound.playIncorrect();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-white animate-in fade-in">
      {/* Top Banner & User Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-purple-950/50 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative">
              <img
                src={
                  profile?.photoURL ||
                  user?.photoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`
                }
                alt="Profile"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-indigo-500/50 object-cover bg-slate-800 shadow-xl"
              />
              <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md">
                LVL {Math.floor((profile?.totalScore || 0) / 500) + 1}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {profile?.displayName || user?.displayName || 'Student'}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${
                    profile?.profileVisibility === 'PRIVATE'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  {profile?.profileVisibility === 'PRIVATE' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                  {profile?.profileVisibility || 'PUBLIC'}
                </span>
              </div>

              <p className="text-xs text-indigo-400 font-mono">@{profile?.username || 'student'}</p>
              <p className="text-xs text-slate-300 max-w-md">{profile?.bio}</p>

              <div className="flex items-center gap-3 pt-2 text-xs text-slate-400 justify-center sm:justify-start">
                <span>{profile?.classLevel || 'Class 10'}</span>
                <span>•</span>
                <span>{profile?.board || 'CBSE'}</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">{profile?.totalScore || 0} Total XP</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => {
                  sound.playClick();
                  setIsEditing(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/50 text-indigo-300 hover:text-white transition-all flex items-center gap-1.5 shadow-md"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}

            <button
              onClick={() => {
                sound.playClick();
                onBack();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Back
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 mt-8 pt-4 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('profile');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('history');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Quiz History ({quizHistory.length})</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('achievements');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'achievements'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Achievements ({achievements.length})</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* TAB 1: Edit Profile / Details */}
      {activeTab === 'profile' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl">
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Edit Student Profile
              </h3>

              {/* Avatar picker */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Select Avatar</label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {AVATAR_OPTIONS.map((av, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setPhotoURL(av)}
                      className={`p-1 rounded-full border-2 transition-all ${
                        photoURL === av ? 'border-indigo-400 scale-110 shadow-md' : 'border-slate-800 opacity-60'
                      }`}
                    >
                      <img src={av} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-800" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    maxLength={25}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Class / Grade
                  </label>
                  <select
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CURRICULUM_DATA.map((c) => (
                      <option key={c.classLevel} value={c.classLevel}>
                        {c.classLevel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Board
                  </label>
                  <select
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="NCERT">NCERT</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={250}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Profile Privacy
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      checked={privacy === 'PUBLIC'}
                      onChange={() => setPrivacy('PUBLIC')}
                      className="accent-indigo-500"
                    />
                    <span>Public (Stats & achievements visible on leaderboards)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      checked={privacy === 'PRIVATE'}
                      onChange={() => setPrivacy('PRIVATE')}
                      className="accent-indigo-500"
                    />
                    <span>Private (Minimal visibility)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
                >
                  Save Profile Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Academic & Profile Overview
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium">Username:</span>
                  <p className="font-bold text-indigo-300">@{profile?.username}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium">Curriculum:</span>
                  <p className="font-bold text-white">
                    {profile?.classLevel} • {profile?.board}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium">Privacy Status:</span>
                  <p className="font-bold text-emerald-400">
                    {profile?.profileVisibility === 'PRIVATE' ? 'Private Account' : 'Public Profile'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Email address is protected and never shown publicly.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-slate-500 font-medium">Member Since:</span>
                  <p className="font-bold text-slate-300">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Today'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Quiz History */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>Recent Quiz Arena History</span>
            <span className="text-xs text-slate-400">{quizHistory.length} completed</span>
          </h3>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Loading your quiz history...
            </div>
          ) : quizHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto opacity-30 text-indigo-400" />
              <p className="text-xs">No quizzes recorded yet. Create or join a quiz to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quizHistory.map((res) => (
                <div
                  key={res.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-white text-sm">{res.quizTitle}</p>
                    <p className="text-slate-400">
                      {res.subject} • {res.classLevel}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(res.completedAt).toLocaleDateString()} at{' '}
                      {new Date(res.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-indigo-400 font-mono font-bold text-sm">
                        {res.score} pts
                      </span>
                      <p className="text-[10px] text-emerald-400">{res.accuracy}% accuracy</p>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-bold text-xs text-amber-400 border border-slate-700">
                      Rank #{res.rank}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Achievements Hub */}
      {activeTab === 'achievements' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>Student Achievements & Badges</span>
            <span className="text-xs text-indigo-400 font-semibold">{achievements.length} Unlocked</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                key: 'first_quiz',
                title: 'Nova Initiate',
                description: 'Completed your first live quiz session.',
                icon: 'Sparkles',
              },
              {
                key: 'perfect_score',
                title: 'Bullseye Master',
                description: 'Attained 100% accuracy in a quiz.',
                icon: 'Trophy',
              },
              {
                key: 'podium_1',
                title: 'Arena Champion',
                description: 'Finished 1st place on the live podium.',
                icon: 'Crown',
              },
              {
                key: 'speed_thinker',
                title: 'Speed Thinker',
                description: 'Answered within the first 5 seconds.',
                icon: 'Zap',
              },
              {
                key: 'ncert_scholar',
                title: 'NCERT Scholar',
                description: 'Reviewed curriculum chapter notes.',
                icon: 'BookOpen',
              },
              {
                key: 'team_player',
                title: 'Room Host',
                description: 'Created and hosted a multiplayer room.',
                icon: 'Star',
              },
            ].map((ach) => {
              const isUnlocked = achievements.some((a) => a.achievementKey === ach.key);

              return (
                <div
                  key={ach.key}
                  className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                    isUnlocked
                      ? 'bg-indigo-950/30 border-indigo-500/40 shadow-md'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-50'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      isUnlocked ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    <Trophy className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">{ach.title}</p>
                    <p className="text-[11px] text-slate-400 leading-snug">{ach.description}</p>
                    <span
                      className={`inline-block text-[9px] font-bold uppercase tracking-wider ${
                        isUnlocked ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    >
                      {isUnlocked ? 'Unlocked' : 'In Progress'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
