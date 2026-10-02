'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, QuizRoom, Participant, QuizQuestion, AnswerSubmission, QuizResult, UserAchievement, handleFirestoreError, OperationType, deleteRoomCompletely } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy } from 'firebase/firestore';
import {
  Trophy,
  Medal,
  Award,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  BookOpen,
  RotateCcw,
  Share2,
  Check,
  Crown,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '@/lib/sound';

interface QuizResultsProps {
  roomId: string;
  onGoHome: () => void;
  onReviewStudy: () => void;
}

export const QuizResults: React.FC<QuizResultsProps> = ({
  roomId,
  onGoHome,
  onReviewStudy,
}) => {
  const { user, profile } = useAuth();
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, AnswerSubmission>>({});
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Fetch Room, Participants, Questions and Answers
  useEffect(() => {
    if (!roomId) return;

    const loadData = async () => {
      try {
        // Room
        const roomSnap = await getDoc(doc(db, 'quizRooms', roomId));
        if (roomSnap.exists()) {
          setRoom(roomSnap.data() as QuizRoom);
        }

        // Participants
        const partSnap = await getDocs(collection(db, 'quizRooms', roomId, 'participants'));
        const pList: Participant[] = [];
        partSnap.forEach((d) => pList.push(d.data() as Participant));
        pList.sort((a, b) => b.score - a.score);
        setParticipants(pList);

        // Questions
        const qSnap = await getDocs(query(collection(db, 'quizRooms', roomId, 'questions'), orderBy('order', 'asc')));
        const qList: QuizQuestion[] = [];
        qSnap.forEach((d) => qList.push(d.data() as QuizQuestion));
        setQuestions(qList);

        // Answers for current user
        if (user) {
          const ansSnap = await getDocs(collection(db, 'quizRooms', roomId, 'answers'));
          const ansMap: Record<string, AnswerSubmission> = {};
          ansSnap.forEach((d) => {
            const data = d.data() as AnswerSubmission;
            if (data.uid === user.uid) {
              ansMap[data.questionId] = data;
            }
          });
          setUserAnswers(ansMap);
        }

        // Clean up and delete the completed quiz room from Firestore so it never lingers
        setTimeout(() => {
          deleteRoomCompletely(roomId);
        }, 2000);
      } catch (err) {
        console.error('Error loading quiz results:', err);
      }
    };

    loadData();
  }, [roomId, user]);

  const evaluateAchievements = async (uid: string, accuracy: number, score: number, rank: number) => {
    try {
      // Achievement 1: First Quiz
      const ach1: UserAchievement = {
        id: `${uid}_first_quiz`,
        uid,
        achievementKey: 'first_quiz',
        title: 'Nova Initiate',
        description: 'Completed your first live multiplayer quiz on QuizNova!',
        icon: 'Sparkles',
        unlockedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'userAchievements', ach1.id), ach1, { merge: true });

      // Achievement 2: Perfect Score
      if (accuracy === 100) {
        const ach2: UserAchievement = {
          id: `${uid}_perfect_score`,
          uid,
          achievementKey: 'perfect_score',
          title: 'Bullseye Master',
          description: 'Attained a 100% perfect accuracy score in a live quiz!',
          icon: 'Trophy',
          unlockedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'userAchievements', ach2.id), ach2, { merge: true });
      }

      // Achievement 3: Podium Champion
      if (rank === 1) {
        const ach3: UserAchievement = {
          id: `${uid}_podium_1`,
          uid,
          achievementKey: 'podium_1',
          title: 'Arena Champion',
          description: 'Finished 1st place in a live multiplayer competition!',
          icon: 'Crown',
          unlockedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'userAchievements', ach3.id), ach3, { merge: true });
      }
    } catch (e) {
      console.error('Achievement evaluation error:', e);
    }
  };

  // 2. Confetti and AI Insight Generation
  useEffect(() => {
    if (participants.length === 0 || questions.length === 0 || !user) return;

    // Trigger celebration
    sound.playVictory();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}

    const myParticipant = participants.find((p) => p.uid === user.uid);
    const myRank = participants.findIndex((p) => p.uid === user.uid) + 1;
    const score = myParticipant?.score || 0;
    const correctCount = myParticipant?.correctAnswers || 0;
    const totalQ = questions.length || 1;
    const accuracy = Math.round((correctCount / totalQ) * 100);

    // Call server AI insights
    fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score,
        totalQuestions: totalQ,
        correctAnswers: correctCount,
        accuracy,
        subject: room?.subject || 'Science',
        classLevel: room?.classLevel || 'Class 10',
        chapter: room?.chapter || 'General',
        rank: myRank || 1,
        totalPlayers: participants.length || 1,
      }),
    })
      .then((res) => res.json())
      .then(async (data) => {
        const insightText = data.insight || 'Excellent work in the live arena!';
        setAiInsight(insightText);

        // 3. Persist QuizResult to Firestore
        const resultId = `res_${Date.now()}_${user.uid.slice(0, 5)}`;
        const quizResultDoc: QuizResult = {
          id: resultId,
          uid: user.uid,
          roomId,
          quizTitle: room?.title || 'Quiz Session',
          subject: room?.subject || 'Science',
          classLevel: room?.classLevel || 'Class 10',
          score,
          accuracy,
          correctAnswers: correctCount,
          totalQuestions: totalQ,
          rank: myRank || 1,
          aiInsight: insightText,
          completedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'quizResults', resultId), quizResultDoc);

        // 4. Evaluate and unlock achievements
        await evaluateAchievements(user.uid, accuracy, score, myRank);
      })
      .catch((err) => console.error('AI insight error:', err))
      .finally(() => setIsAiLoading(false));
  }, [participants, questions, user, room, roomId]);

  const myParticipant = participants.find((p) => p.uid === user?.uid);
  const myRank = participants.findIndex((p) => p.uid === user?.uid) + 1;
  const correctCount = myParticipant?.correctAnswers || 0;
  const totalQ = questions.length || 1;
  const accuracy = Math.round((correctCount / totalQ) * 100);

  const shareScore = () => {
    sound.playClick();
    const text = `I just scored ${myParticipant?.score || 0} pts (${accuracy}% accuracy) in ${room?.subject} on QuizNova! Can you beat my score?`;
    if (navigator.share) {
      navigator.share({ title: 'My QuizNova Score', text, url: window.location.origin }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Celebration Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/20 mb-2">
          <Trophy className="w-8 h-8 animate-bounce" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white via-amber-200 to-indigo-300 bg-clip-text text-transparent">
          Quiz Completed!
        </h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {room?.title} • {room?.subject} ({room?.chapter})
        </p>
      </div>

      {/* Podium Top 3 */}
      {participants.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-4 max-w-lg mx-auto items-end pt-4">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            {participants[1] ? (
              <div className="w-full flex flex-col items-center p-2 sm:p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <Medal className="w-5 sm:w-6 h-5 sm:h-6 text-slate-300 mb-1" />
                <img
                  src={participants[1].photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${participants[1].uid}`}
                  alt=""
                  className="w-8 sm:w-10 h-8 sm:h-10 rounded-full border border-slate-700 bg-slate-800 object-cover"
                />
                <p className="text-[11px] sm:text-xs font-bold text-white mt-1.5 truncate max-w-[70px] sm:max-w-[80px]">
                  {participants[1].displayName}
                </p>
                <span className="text-[10px] sm:text-[11px] font-mono text-indigo-400 font-extrabold">
                  {participants[1].score} pts
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500">2nd Place</span>
              </div>
            ) : (
              <div className="h-28" />
            )}
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            {participants[0] && (
              <div className="w-full flex flex-col items-center p-2.5 sm:p-4 rounded-2xl bg-gradient-to-b from-amber-950/60 to-slate-900 border border-amber-500/50 text-center shadow-xl shadow-amber-500/20 scale-105">
                <Crown className="w-6 sm:w-7 h-6 sm:h-7 text-amber-400 mb-1 animate-pulse" />
                <img
                  src={participants[0].photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${participants[0].uid}`}
                  alt=""
                  className="w-10 sm:w-12 h-10 sm:h-12 rounded-full border-2 border-amber-400 bg-slate-800 object-cover"
                />
                <p className="text-[11px] sm:text-xs font-black text-white mt-2 truncate max-w-[85px] sm:max-w-[100px]">
                  {participants[0].displayName}
                </p>
                <span className="text-[11px] sm:text-xs font-mono text-amber-400 font-black">
                  {participants[0].score} pts
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-amber-300/80">🏆 Champion</span>
              </div>
            )}
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            {participants[2] ? (
              <div className="w-full flex flex-col items-center p-2 sm:p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <Medal className="w-5 sm:w-6 h-5 sm:h-6 text-amber-700 mb-1" />
                <img
                  src={participants[2].photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${participants[2].uid}`}
                  alt=""
                  className="w-8 sm:w-10 h-8 sm:h-10 rounded-full border border-slate-700 bg-slate-800 object-cover"
                />
                <p className="text-[11px] sm:text-xs font-bold text-white mt-1.5 truncate max-w-[70px] sm:max-w-[80px]">
                  {participants[2].displayName}
                </p>
                <span className="text-[10px] sm:text-[11px] font-mono text-indigo-400 font-extrabold">
                  {participants[2].score} pts
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500">3rd Place</span>
              </div>
            ) : (
              <div className="h-28" />
            )}
          </div>
        </div>
      )}

      {/* Personal Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-slate-400 text-xs font-medium">Your Score</span>
          <p className="text-2xl font-black text-indigo-400 font-mono">
            {myParticipant?.score || 0}
          </p>
          <span className="text-[10px] text-slate-500">Points earned</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-slate-400 text-xs font-medium">Accuracy</span>
          <p className="text-2xl font-black text-emerald-400 font-mono">{accuracy}%</p>
          <span className="text-[10px] text-slate-500">
            {correctCount} / {totalQ} correct
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-slate-400 text-xs font-medium">Rank</span>
          <p className="text-2xl font-black text-amber-400 font-mono">
            #{myRank || 1}
          </p>
          <span className="text-[10px] text-slate-500">of {participants.length} players</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-slate-400 text-xs font-medium">Speed</span>
          <p className="text-2xl font-black text-purple-400 font-mono">Fast</p>
          <span className="text-[10px] text-slate-500">Speed bonus active</span>
        </div>
      </div>

      {/* AI Performance Insight Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 shadow-xl space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
          <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
          <span>Gemini AI Learning Coach Analysis</span>
        </div>

        {isAiLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse py-2">
            <span>Analyzing student conceptual recall and performance strengths...</span>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{aiInsight}</p>
        )}
      </div>

      {/* Interactive Question Review */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Question Review & Explanations ({questions.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            {correctCount} Correct • {totalQ - correctCount} Incorrect
          </span>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const answerRecord = userAnswers[q.id];
            const chosen = answerRecord?.selectedAnswer;
            const isCorrect = chosen === q.correctAnswer;

            return (
              <div
                key={q.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 text-xs font-bold text-indigo-300">
                      Q{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white">{q.question}</span>
                  </div>

                  {answerRecord ? (
                    isCorrect ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Correct
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 shrink-0">
                        <XCircle className="w-3 h-3" /> Incorrect
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 shrink-0">
                      Unanswered
                    </span>
                  )}
                </div>

                {/* 4 Options breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt, optIdx) => {
                    const isTheCorrect = optIdx === q.correctAnswer;
                    const isTheChosen = optIdx === chosen;

                    let optClass = 'bg-slate-950/60 border-slate-800/80 text-slate-400';
                    if (isTheCorrect) {
                      optClass = 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200 font-semibold';
                    } else if (isTheChosen && !isTheCorrect) {
                      optClass = 'bg-rose-950/30 border-rose-500/60 text-rose-300 line-through';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 ${optClass}`}
                      >
                        <span className="font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                        <span>{opt}</span>
                        {isTheCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/60 text-xs text-slate-300 space-y-1">
                  <span className="font-bold text-indigo-400 text-[11px]">Explanation:</span>
                  <p className="leading-relaxed">{q.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={shareScore}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm"
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          <span>{copiedLink ? 'Score Copied!' : 'Share Score'}</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onReviewStudy();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-bold text-purple-300 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Review NCERT Chapter</span>
          </button>

          <button
            onClick={async () => {
              sound.playClick();
              await deleteRoomCompletely(roomId);
              onGoHome();
            }}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
