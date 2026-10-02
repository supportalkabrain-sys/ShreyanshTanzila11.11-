'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import { DashboardView } from '@/components/DashboardView';
import { QuizLobby } from '@/components/QuizLobby';
import { QuizArena } from '@/components/QuizArena';
import { QuizResults } from '@/components/QuizResults';
import { StudyWorkspace } from '@/components/StudyWorkspace';
import { ProfileView } from '@/components/ProfileView';
import { OnboardingModal } from '@/components/OnboardingModal';
import { CreateQuizModal } from '@/components/CreateQuizModal';
import { JoinRoomModal } from '@/components/JoinRoomModal';
import { SettingsModal } from '@/components/SettingsModal';
import { db, QuizRoom, Participant } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sound } from '@/lib/sound';

function HomeContent() {
  const { user, profile, loading: authLoading, signInWithGoogle } = useAuth();
  const searchParams = useSearchParams();

  // Navigation View: 'dashboard' | 'lobby' | 'arena' | 'results' | 'study' | 'profile'
  const queryView = searchParams.get('view');
  const queryAction = searchParams.get('action');
  const queryRoomId = searchParams.get('roomId');

  const validViews = ['dashboard', 'lobby', 'arena', 'results', 'study', 'profile'];
  
  // Read initial room and view from URL or localStorage
  const getInitialState = () => {
    if (typeof window === 'undefined') return { view: 'dashboard' as const, roomId: null };
    const pRoom = searchParams.get('roomId') || localStorage.getItem('quiznova_active_room');
    const pView = searchParams.get('view') || localStorage.getItem('quiznova_current_view');
    if (pRoom && (pView === 'arena' || pView === 'lobby' || pView === 'results')) {
      return { view: pView as any, roomId: pRoom };
    }
    return {
      view: (queryView && validViews.includes(queryView) ? queryView : 'dashboard') as any,
      roomId: queryRoomId || null,
    };
  };

  const initial = getInitialState();
  const [currentView, setCurrentView] = useState<'dashboard' | 'lobby' | 'arena' | 'results' | 'study' | 'profile'>(initial.view);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initial.roomId);

  // Synchronize state changes to localStorage and URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeRoomId && ['lobby', 'arena', 'results'].includes(currentView)) {
      try {
        localStorage.setItem('quiznova_active_room', activeRoomId);
        localStorage.setItem('quiznova_current_view', currentView);
        const url = new URL(window.location.href);
        url.searchParams.set('roomId', activeRoomId);
        url.searchParams.set('view', currentView);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        console.warn('Failed to save room session:', e);
      }
    } else if (currentView === 'dashboard') {
      try {
        localStorage.removeItem('quiznova_active_room');
        localStorage.removeItem('quiznova_current_view');
        const url = new URL(window.location.href);
        url.searchParams.delete('roomId');
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }
  }, [activeRoomId, currentView]);

  // On page load or refresh, verify if active room exists and sync status
  useEffect(() => {
    if (authLoading) return;

    const savedRoom = typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('roomId') || localStorage.getItem('quiznova_active_room'))
      : null;
    if (!savedRoom) return;

    getDoc(doc(db, 'quizRooms', savedRoom))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setActiveRoomId(savedRoom);
          if (data.status === 'LIVE' || data.status === 'STARTING') {
            setCurrentView('arena');
          } else if (data.status === 'WAITING') {
            setCurrentView('lobby');
          } else if (data.status === 'COMPLETED') {
            setCurrentView('results');
          }
        } else {
          // Room was deleted, clean up
          setActiveRoomId(null);
          setCurrentView('dashboard');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('quiznova_active_room');
            localStorage.removeItem('quiznova_current_view');
            const url = new URL(window.location.href);
            url.searchParams.delete('roomId');
            url.searchParams.delete('view');
            window.history.replaceState({}, '', url.toString());
          }
        }
      })
      .catch((err) => {
        console.warn('Error checking room existence on refresh:', err);
      });
  }, [authLoading]);

  // Modals
  const initialJoin = searchParams.get('joinCode')?.toUpperCase() || '';
  const [createModalOpen, setCreateModalOpen] = useState(queryAction === 'create');
  const [joinModalOpen, setJoinModalOpen] = useState(Boolean(initialJoin));
  const [joinInitialCode, setJoinInitialCode] = useState(initialJoin);
  const [settingsModalOpen, setSettingsModalOpen] = useState(queryAction === 'settings');

  // When room created
  const handleRoomCreated = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentView('lobby');
  };

  // When joined via code
  const handleRoomJoined = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentView('lobby');
  };

  // When clicking on a public room from dashboard
  const handleJoinSpecificRoom = async (roomId: string) => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    try {
      const roomSnap = await getDoc(doc(db, 'quizRooms', roomId));
      if (!roomSnap.exists()) {
        alert('Room no longer exists.');
        return;
      }
      const roomData = roomSnap.data() as QuizRoom;

      // Add participant
      const participant: Participant = {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Student',
        username: profile?.username || 'novastudent',
        photoURL: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
        isHost: roomData.hostId === user.uid,
        isReady: false,
        score: 0,
        correctAnswers: 0,
        answeredQuestions: 0,
        averageResponseTime: 0,
        status: 'online',
        joinedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid), participant);
      setActiveRoomId(roomId);

      if (roomData.status === 'LIVE') {
        setCurrentView('arena');
      } else {
        setCurrentView('lobby');
      }
      sound.playVictory();
    } catch (err) {
      console.error('Join error:', err);
    }
  };

  // Solo Rapid Practice generator
  const handleQuickSolo = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    const roomId = `solo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const classLevel = profile?.classLevel || 'Class 10';
    const board = profile?.board || 'CBSE';
    const subject = 'Science';
    const chapter = 'Chemical Reactions and Equations';

    sound.playClick();

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classLevel,
          board,
          subject,
          chapter,
          difficulty: 'Medium',
          questionCount: 5,
          questionType: 'Multiple Choice',
        }),
      });

      const genData = await res.json();
      if (!genData.success || !genData.questions) {
        throw new Error('Solo quiz generation failed.');
      }

      // Create room document
      const soloRoom: QuizRoom = {
        roomId,
        roomCode: 'SOLO01',
        hostId: user.uid,
        hostName: profile?.displayName || user.displayName || 'Student',
        title: `Solo Rapid: ${subject}`,
        classLevel,
        board,
        subject,
        chapter,
        difficulty: 'Medium',
        questionCount: genData.questions.length,
        timerSeconds: 30,
        questionType: 'Multiple Choice',
        privacy: 'PUBLIC',
        status: 'LIVE',
        currentQuestionIndex: 0,
        questionStartedAt: Date.now(),
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        maxPlayers: 1,
      };

      await setDoc(doc(db, 'quizRooms', roomId), soloRoom);

      // Add participant
      const hostPart: Participant = {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Student',
        username: profile?.username || 'student',
        photoURL: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
        isHost: true,
        isReady: true,
        score: 0,
        correctAnswers: 0,
        answeredQuestions: 0,
        averageResponseTime: 0,
        status: 'ready',
        joinedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid), hostPart);

      // Save questions
      for (const q of genData.questions) {
        await setDoc(doc(db, 'quizRooms', roomId, 'questions', q.id), q);
      }

      setActiveRoomId(roomId);
      setCurrentView('arena');
      sound.playVictory();
    } catch (e) {
      console.error('Solo practice error:', e);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-xs text-indigo-300 font-mono tracking-wider animate-pulse">
          INITIALIZING QUIZNOVA PLATFORM...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        onOpenCreate={() => {
          if (!user) signInWithGoogle();
          else setCreateModalOpen(true);
        }}
        onOpenJoin={() => setJoinModalOpen(true)}
        onOpenStudy={() => setCurrentView('study')}
        onOpenProfile={() => setCurrentView('profile')}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onGoHome={() => {
          setActiveRoomId(null);
          setCurrentView('dashboard');
        }}
        currentView={currentView}
      />

      {/* Main View Router */}
      <main className="flex-1 w-full pb-20 md:pb-6">
        {currentView === 'dashboard' && (
          <DashboardView
            onCreateQuiz={() => setCreateModalOpen(true)}
            onJoinRoom={(code) => {
              if (code) setJoinInitialCode(code);
              setJoinModalOpen(true);
            }}
            onOpenStudy={() => setCurrentView('study')}
            onOpenProfile={() => setCurrentView('profile')}
            onJoinSpecificRoom={handleJoinSpecificRoom}
            onQuickSolo={handleQuickSolo}
          />
        )}

        {currentView === 'lobby' && activeRoomId && (
          <QuizLobby
            roomId={activeRoomId}
            onStartQuiz={() => setCurrentView('arena')}
            onLeaveRoom={() => {
              setActiveRoomId(null);
              setCurrentView('dashboard');
            }}
          />
        )}

        {currentView === 'arena' && activeRoomId && (
          <QuizArena
            roomId={activeRoomId}
            onFinishQuiz={() => setCurrentView('results')}
            onExit={() => {
              setActiveRoomId(null);
              setCurrentView('dashboard');
            }}
          />
        )}

        {currentView === 'results' && activeRoomId && (
          <QuizResults
            roomId={activeRoomId}
            onGoHome={() => {
              setActiveRoomId(null);
              setCurrentView('dashboard');
            }}
            onReviewStudy={() => setCurrentView('study')}
          />
        )}

        {currentView === 'study' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[85vh]">
            <StudyWorkspace onBackToQuiz={activeRoomId ? () => setCurrentView('arena') : undefined} />
          </div>
        )}

        {currentView === 'profile' && (
          <ProfileView
            onBack={() => {
              setCurrentView('dashboard');
            }}
          />
        )}
      </main>

      {/* Modals */}
      <OnboardingModal />

      <CreateQuizModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />

      <JoinRoomModal
        isOpen={joinModalOpen}
        initialCode={joinInitialCode}
        onClose={() => {
          setJoinModalOpen(false);
          setJoinInitialCode('');
        }}
        onJoined={handleRoomJoined}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
