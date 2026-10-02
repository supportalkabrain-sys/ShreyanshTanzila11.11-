'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  db,
  QuizRoom,
  Participant,
  QuizQuestion,
  AnswerSubmission,
  handleFirestoreError,
  OperationType,
  deleteRoomCompletely,
} from '@/lib/firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  Clock,
  Trophy,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  PenTool,
  BookOpen,
  MessageSquare,
  Crown,
  Flame,
} from 'lucide-react';
import { Whiteboard } from './Whiteboard';
import { StudyWorkspace } from './StudyWorkspace';
import { RoomChat } from './RoomChat';
import { sound } from '@/lib/sound';

interface QuestionCardProps {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  durationSeconds: number;
  roomId: string;
  isHost: boolean;
  onNext: () => void;
  myScore: number;
  myCorrectCount: number;
  myAnsweredCount: number;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionIndex,
  totalQuestions,
  durationSeconds,
  roomId,
  isHost,
  onNext,
  myScore,
  myCorrectCount,
  myAnsweredCount,
}) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRevealed(true);
          return 0;
        }
        if (prev <= 6) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSelectOption = async (optionIdx: number) => {
    if (hasSubmitted || timeLeft <= 0 || !user) return;

    sound.playClick();
    setSelectedOption(optionIdx);
    setHasSubmitted(true);
    setIsRevealed(true);

    const elapsed = Math.max(500, (durationSeconds - timeLeft) * 1000);
    const isCorrect = optionIdx === question.correctAnswer;

    let points = 0;
    if (isCorrect) {
      sound.playCorrect();
      const basePoints = question.points || 100;
      const speedBonus = Math.max(0, Math.floor((timeLeft / durationSeconds) * 50));
      points = basePoints + speedBonus;
    } else {
      sound.playIncorrect();
    }

    try {
      const submissionId = `${user.uid}_${question.id}`;
      const answerDoc: AnswerSubmission = {
        uid: user.uid,
        questionId: question.id,
        selectedAnswer: optionIdx,
        isCorrect,
        pointsEarned: points,
        responseTimeMs: elapsed,
        submittedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'quizRooms', roomId, 'answers', submissionId), answerDoc);

      await updateDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid), {
        score: myScore + points,
        correctAnswers: isCorrect ? myCorrectCount + 1 : myCorrectCount,
        answeredQuestions: myAnsweredCount + 1,
        status: 'answered',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `quizRooms/${roomId}/answers`);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-indigo-500/30 p-6 sm:p-8 space-y-6 shadow-2xl relative">
      {/* Timer Bar */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden absolute top-0 left-0 right-0">
        <div
          className={`h-full transition-all duration-1000 ${
            timeLeft <= 5
              ? 'bg-rose-500'
              : timeLeft <= 10
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
          }`}
          style={{ width: `${(timeLeft / durationSeconds) * 100}%` }}
        />
      </div>

      {/* Question Info Header */}
      <div className="flex items-center justify-between pt-1">
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
          Question {questionIndex + 1} of {totalQuestions}
        </span>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono font-bold text-xs ${
              timeLeft <= 5
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                : timeLeft <= 10
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{timeLeft}s</span>
          </div>

          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> +{question.points || 100} pts
          </span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            {question.difficulty || 'Medium'}
          </span>
        </div>
      </div>

      {/* Question Text */}
      <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
        {question.question}
      </h3>

      {/* Options List */}
      <div className="grid grid-cols-1 gap-3 pt-2">
        {question.options?.map((optionText, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrectAnswer = idx === question.correctAnswer;

          let optionStyle =
            'bg-slate-950/70 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-950 text-slate-200';

          if (isRevealed) {
            if (isCorrectAnswer) {
              optionStyle =
                'bg-emerald-950/40 border-emerald-500 text-emerald-100 shadow-md shadow-emerald-500/20';
            } else if (isSelected && !isCorrectAnswer) {
              optionStyle =
                'bg-rose-950/40 border-rose-500 text-rose-100 shadow-md shadow-rose-500/20';
            } else {
              optionStyle = 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60';
            }
          } else if (isSelected) {
            optionStyle =
              'bg-indigo-600/30 border-indigo-400 text-indigo-100 shadow-lg shadow-indigo-600/30 scale-[1.01]';
          }

          return (
            <button
              type="button"
              key={idx}
              disabled={hasSubmitted || timeLeft <= 0}
              onClick={() => handleSelectOption(idx)}
              className={`w-full p-4 rounded-xl border text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold transition-all active:scale-[0.99] disabled:cursor-not-allowed ${optionStyle}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 ${
                    isRevealed && isCorrectAnswer
                      ? 'bg-emerald-500 text-slate-950'
                      : isRevealed && isSelected && !isCorrectAnswer
                      ? 'bg-rose-500 text-white'
                      : isSelected
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="leading-snug">{optionText}</span>
              </div>

              {isRevealed && isCorrectAnswer && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              {isRevealed && isSelected && !isCorrectAnswer && (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation Reveal */}
      {isRevealed && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Concept Explanation & Reasoning:
            </span>
            <span className="text-[10px] text-slate-400">
              {question.difficulty} Curriculum Fact
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{question.explanation}</p>
        </div>
      )}

      {/* Next Question Button */}
      {isRevealed && (
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95 transition-all"
          >
            <span>
              {questionIndex + 1 < totalQuestions ? 'Next Question' : 'View Final Results'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

interface QuizArenaProps {
  roomId: string;
  onFinishQuiz: () => void;
  onExit: () => void;
}

export const QuizArena: React.FC<QuizArenaProps> = ({ roomId, onFinishQuiz, onExit }) => {
  const { user } = useAuth();

  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Active Workspace Tab: 'quiz' | 'whiteboard' | 'study' | 'chat'
  const [activeTab, setActiveTab] = useState<'quiz' | 'whiteboard' | 'study' | 'chat'>('quiz');

  // 1. Subscribe to Room
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'quizRooms', roomId);

    const unsubscribe = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as QuizRoom;
          setRoom(data);
          setCurrentQuestionIndex(data.currentQuestionIndex || 0);

          if (data.status === 'COMPLETED') {
            onFinishQuiz();
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `quizRooms/${roomId}`)
    );

    return () => unsubscribe();
  }, [roomId, onFinishQuiz]);

  // 2. Fetch Questions
  useEffect(() => {
    if (!roomId) return;
    const questionsQuery = query(collection(db, 'quizRooms', roomId, 'questions'), orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(
      questionsQuery,
      (snap) => {
        const qList: QuizQuestion[] = [];
        snap.forEach((d) => qList.push(d.data() as QuizQuestion));
        setQuestions(qList);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `quizRooms/${roomId}/questions`)
    );

    return () => unsubscribe();
  }, [roomId]);

  // 3. Subscribe to Participants
  useEffect(() => {
    if (!roomId) return;
    const partRef = collection(db, 'quizRooms', roomId, 'participants');

    const unsubscribe = onSnapshot(
      partRef,
      (snap) => {
        const pList: Participant[] = [];
        snap.forEach((d) => pList.push(d.data() as Participant));
        pList.sort((a, b) => b.score - a.score);
        setParticipants(pList);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `quizRooms/${roomId}/participants`)
    );

    return () => unsubscribe();
  }, [roomId]);

  const currentQ = questions[currentQuestionIndex];
  const isHost = room?.hostId === user?.uid;
  const currentDuration = room?.timerSeconds || 30;

  const myPart = participants.find((p) => p.uid === user?.uid);

  // Next Question / Finish Quiz
  const handleNextQuestion = async () => {
    sound.playClick();

    if (currentQuestionIndex + 1 < questions.length) {
      const nextIndex = currentQuestionIndex + 1;
      try {
        if (isHost) {
          await updateDoc(doc(db, 'quizRooms', roomId), {
            currentQuestionIndex: nextIndex,
            questionStartedAt: Date.now(),
          });
        } else {
          setCurrentQuestionIndex(nextIndex);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `quizRooms/${roomId}`);
      }
    } else {
      try {
        if (isHost) {
          await updateDoc(doc(db, 'quizRooms', roomId), {
            status: 'COMPLETED',
            endedAt: new Date().toISOString(),
          });
        }
        onFinishQuiz();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `quizRooms/${roomId}`);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Top Header: Room details and Workspace Tabs */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <span>{room?.title || 'Live Quiz Arena'}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                Q {currentQuestionIndex + 1}/{questions.length || 5}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {room?.subject} • {room?.chapter}
            </p>
          </div>
        </div>

        {/* Center: Workspace Multi-Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('quiz');
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'quiz'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Quiz<span className="hidden sm:inline"> Arena</span></span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('whiteboard');
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'whiteboard'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">White</span>board</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('study');
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'study'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>NCERT<span className="hidden sm:inline"> Notes</span></span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('chat');
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>@AI Chat</span>
          </button>
        </div>

        {/* Right: Exit */}
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (confirm('Leave live quiz arena?')) {
                if (isHost) {
                  await deleteRoomCompletely(roomId);
                }
                onExit();
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            Exit Arena
          </button>
        </div>
      </div>

      {/* MAIN VIEW AREA BASED ON ACTIVE TAB */}
      {activeTab === 'quiz' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Question Card Keyed by question ID (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            {currentQ ? (
              <QuestionCard
                key={currentQ.id}
                question={currentQ}
                questionIndex={currentQuestionIndex}
                totalQuestions={questions.length}
                durationSeconds={currentDuration}
                roomId={roomId}
                isHost={isHost}
                onNext={handleNextQuestion}
                myScore={myPart?.score || 0}
                myCorrectCount={myPart?.correctAnswers || 0}
                myAnsweredCount={myPart?.answeredQuestions || 0}
              />
            ) : (
              <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
                Loading questions...
              </div>
            )}
          </div>

          {/* Right Column: Mini Live Leaderboard & Quick AI Assist */}
          <div className="space-y-4">
            {/* Live Leaderboard */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Live Room Standings
                </span>
                <span className="text-[10px] text-indigo-400 font-semibold">
                  {participants.length} Players
                </span>
              </div>

              <div className="space-y-2">
                {participants.map((p, idx) => {
                  const isMe = p.uid === user?.uid;
                  return (
                    <div
                      key={p.uid}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isMe
                          ? 'bg-indigo-600/20 border-indigo-500/50 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <img
                          src={p.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.uid}`}
                          alt={p.displayName}
                          className="w-6 h-6 rounded-full bg-slate-800 object-cover"
                        />

                        <span className="font-bold text-slate-200 truncate max-w-[90px]">
                          {p.displayName} {isMe && '(You)'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-indigo-300 font-mono">
                          {p.score} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Mini-Chat Preview */}
            <div className="h-[280px]">
              <RoomChat
                roomId={roomId}
                currentQuestion={currentQ}
                subject={room?.subject}
                classLevel={room?.classLevel}
                chapter={room?.chapter}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Collaborative Whiteboard */}
      {activeTab === 'whiteboard' && (
        <div className="h-[650px] animate-in fade-in duration-150">
          <Whiteboard roomId={roomId} />
        </div>
      )}

      {/* TAB 3: Educational Study Workspace */}
      {activeTab === 'study' && (
        <div className="h-[650px] animate-in fade-in duration-150">
          <StudyWorkspace
            initialSubject={room?.subject}
            initialClass={room?.classLevel}
            onBackToQuiz={() => setActiveTab('quiz')}
          />
        </div>
      )}

      {/* TAB 4: Live Chat & @AI Tutor */}
      {activeTab === 'chat' && (
        <div className="h-[650px] animate-in fade-in duration-150">
          <RoomChat
            roomId={roomId}
            currentQuestion={currentQ}
            subject={room?.subject}
            classLevel={room?.classLevel}
            chapter={room?.chapter}
          />
        </div>
      )}
    </div>
  );
};
