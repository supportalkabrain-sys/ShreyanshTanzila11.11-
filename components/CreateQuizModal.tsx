'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CURRICULUM_DATA } from '@/lib/studyData';
import { db, QuizRoom, Participant, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  X,
  Sparkles,
  Lock,
  Globe,
  Clock,
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  BookOpen,
  Sliders,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  Dices,
} from 'lucide-react';
import { sound } from '@/lib/sound';

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
}

export const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
}) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1: Curriculum & Subject
  const [classLevel, setClassLevel] = useState(profile?.classLevel || 'Class 10');
  const [board, setBoard] = useState(profile?.board || 'CBSE');
  const [subject, setSubject] = useState('Science');
  const [chapter, setChapter] = useState('Chemical Reactions and Equations');
  const [customChapter, setCustomChapter] = useState('');

  // Step 2: Quiz Config
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Olympiad'>('Medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [questionType, setQuestionType] = useState('Multiple Choice');

  // Step 3: Privacy, Code & Security
  const [roomCode, setRoomCode] = useState(() => generateRandomCode());
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [password, setPassword] = useState('');
  const [roomTitle, setRoomTitle] = useState('');

  // Loading & Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Derive chapters for selected class & subject
  const currentCurriculum = CURRICULUM_DATA.find((c) => c.classLevel === classLevel) || CURRICULUM_DATA[0];
  const currentSubjectObj = currentCurriculum.subjects.find((s) => s.name === subject) || currentCurriculum.subjects[0];
  const availableChapters = currentSubjectObj ? currentSubjectObj.chapters : [];

  const sha256 = async (str: string) => {
    const buffer = new TextEncoder().encode(str.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleNextStep = () => {
    sound.playClick();
    if (step < 3) setStep(step + 1);
  };

  const handlePrevStep = () => {
    sound.playClick();
    if (step > 1) setStep(step - 1);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setIsGenerating(true);
    sound.playClick();

    try {
      const activeChapter = customChapter.trim() || chapter;
      const title = roomTitle.trim() || `${subject}: ${activeChapter}`;
      const finalRoomCode = (roomCode || generateRandomCode()).trim().toUpperCase();
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. Password hashing if private
      let passwordHash: string | undefined = undefined;
      if (privacy === 'PRIVATE') {
        if (!password.trim() || password.length < 4) {
          throw new Error('Private rooms require a password of at least 4 characters.');
        }
        passwordHash = await sha256(password);
      }

      // 2. Server-side Gemini AI question generation
      setGenerationStatus('Generating curriculum-aligned questions via Gemini AI...');
      const genRes = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classLevel,
          board,
          subject,
          chapter: activeChapter,
          difficulty,
          questionCount,
          questionType,
        }),
      });

      const genData = await genRes.json();
      if (!genData.success || !genData.questions || genData.questions.length === 0) {
        throw new Error(genData.error || 'Failed to generate quiz questions.');
      }

      setGenerationStatus('Creating multiplayer room on Firestore...');

      // 3. Create room document cleanly (CRITICAL: omit undefined fields)
      const newRoom: Record<string, any> = {
        roomId,
        roomCode: finalRoomCode,
        hostId: user.uid,
        hostName: profile?.displayName || user.displayName || 'Host Student',
        title,
        classLevel,
        board,
        subject,
        chapter: activeChapter,
        difficulty,
        questionCount: genData.questions.length,
        timerSeconds,
        questionType,
        privacy,
        status: 'WAITING',
        currentQuestionIndex: 0,
        createdAt: new Date().toISOString(),
        maxPlayers: 12,
      };

      if (privacy === 'PRIVATE' && passwordHash) {
        newRoom.passwordHash = passwordHash;
      }

      await setDoc(doc(db, 'quizRooms', roomId), newRoom);

      // 4. Add host as participant
      const hostParticipant: Participant = {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Host',
        username: profile?.username || 'host',
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

      await setDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid), hostParticipant);

      // 5. Store questions
      setGenerationStatus('Finalizing quiz setup...');
      for (const q of genData.questions) {
        await setDoc(doc(db, 'quizRooms', roomId, 'questions', q.id), q);
      }

      sound.playVictory();
      onRoomCreated(roomId);
      onClose();
    } catch (err: any) {
      console.error('Create room error:', err);
      setError(err.message || 'Failed to create quiz room.');
      sound.playIncorrect();
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                Create AI Quiz Room
              </h3>
              <p className="text-[11px] text-slate-400">Step {step} of 3 • Multiplayer Arena</p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 border-b border-slate-800 text-xs font-semibold text-center">
          <div
            className={`py-2 border-b-2 transition-colors ${
              step >= 1 ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-600'
            }`}
          >
            1. Topic & Curriculum
          </div>
          <div
            className={`py-2 border-b-2 transition-colors ${
              step >= 2 ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-600'
            }`}
          >
            2. Difficulty & Rules
          </div>
          <div
            className={`py-2 border-b-2 transition-colors ${
              step >= 3 ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-600'
            }`}
          >
            3. Privacy & Access
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Generating Quiz Room</h4>
                <p className="text-xs text-indigo-300 mt-1 max-w-xs">{generationStatus}</p>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Class / Level
                      </label>
                      <select
                        value={classLevel}
                        onChange={(e) => {
                          setClassLevel(e.target.value);
                          const newCurr = CURRICULUM_DATA.find((c) => c.classLevel === e.target.value);
                          if (newCurr && newCurr.subjects[0]) {
                            setSubject(newCurr.subjects[0].name);
                            setChapter(newCurr.subjects[0].chapters[0] || '');
                          }
                        }}
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
                        <option value="ICSE">ICSE / ISC</option>
                        <option value="State Board">State Board</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Subject
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        const sObj = currentCurriculum.subjects.find((s) => s.name === e.target.value);
                        if (sObj && sObj.chapters[0]) {
                          setChapter(sObj.chapters[0]);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    >
                      {currentCurriculum.subjects.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Chapter / Topic
                    </label>
                    <select
                      value={chapter}
                      onChange={(e) => {
                        setChapter(e.target.value);
                        setCustomChapter('');
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 mb-2"
                    >
                      {availableChapters.map((chap) => (
                        <option key={chap} value={chap}>
                          {chap}
                        </option>
                      ))}
                    </select>

                    <div className="relative">
                      <input
                        type="text"
                        value={customChapter}
                        onChange={(e) => setCustomChapter(e.target.value)}
                        placeholder="Or enter specific custom topic..."
                        className="w-full px-3 py-1.5 text-xs bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Difficulty */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['Easy', 'Medium', 'Hard', 'Olympiad'] as const).map((diff) => (
                        <button
                          type="button"
                          key={diff}
                          onClick={() => {
                            sound.playClick();
                            setDifficulty(diff);
                          }}
                          className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all ${
                            difficulty === diff
                              ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300 shadow-md shadow-indigo-600/20'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Count & Timer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Question Count
                      </label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value={5}>5 Questions (Rapid)</option>
                        <option value={10}>10 Questions (Standard)</option>
                        <option value={15}>15 Questions (Championship)</option>
                        <option value={20}>20 Questions (Full Marathon)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Timer per Question
                      </label>
                      <select
                        value={timerSeconds}
                        onChange={(e) => setTimerSeconds(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value={15}>15 Seconds (Blitz)</option>
                        <option value={30}>30 Seconds (Balanced)</option>
                        <option value={45}>45 Seconds (Thoughtful)</option>
                        <option value={60}>60 Seconds (Complex Numerical)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Question Format
                    </label>
                    <select
                      value={questionType}
                      onChange={(e) => setQuestionType(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Multiple Choice">Multiple Choice (Standard 4 Options)</option>
                      <option value="Assertion & Reason">Assertion & Reason (Board Exam Special)</option>
                      <option value="Case Study Application">Case Study & Application Based</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Room Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder={`e.g. ${subject} Champions League`}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Room Code Display & Randomize Button */}
                  <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Dices className="w-4 h-4 text-purple-400" />
                        Room Code (Auto-generated)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setRoomCode(generateRandomCode());
                        }}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Regenerate Random Code</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border border-indigo-500/40 rounded-xl">
                      <span className="font-mono text-lg font-black tracking-widest text-indigo-200 select-all">
                        {roomCode}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Friends can join with this code or link
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Room Access & Privacy
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setPrivacy('PUBLIC');
                        }}
                        className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                          privacy === 'PUBLIC'
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-white">Public Room</p>
                          <p className="text-[10px] text-slate-400">
                            Listed on the dashboard. Anyone can join with link or code.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setPrivacy('PRIVATE');
                        }}
                        className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                          privacy === 'PRIVATE'
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-white">Private Room</p>
                          <p className="text-[10px] text-slate-400">
                            Password protected. Only invited friends with password can enter.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {privacy === 'PRIVATE' && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <label className="block text-xs font-bold text-amber-300">
                        Set Room Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter at least 4 characters"
                        required
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-amber-500/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <p className="text-[10px] text-amber-300/80">
                        Encrypted and verified securely server-side. Plain text is never stored.
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 text-xs space-y-1">
                    <p className="font-bold text-white">Summary:</p>
                    <p>• {classLevel} • {subject} • {customChapter || chapter}</p>
                    <p>• {questionCount} {difficulty} questions • {timerSeconds}s per question</p>
                    <p>• Multi-feature Arena: Live Quiz, @AI Chat Tutor, Whiteboard, NCERT notes</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isGenerating && (
          <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateRoom}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate & Create Room</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
