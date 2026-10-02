import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// CRITICAL: Must use firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per Firebase skill directive
export async function testConnection() {
  try {
    if (typeof window !== 'undefined') {
      await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
  }
}

// Data models
export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  photoURL?: string;
  classLevel: string;
  board: string;
  bio?: string;
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  animationsEnabled: boolean;
  defaultDifficulty: string;
  defaultQuestionCount: number;
  totalScore: number;
  quizzesPlayed: number;
  correctAnswers: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizRoom {
  roomId: string;
  roomCode: string;
  hostId: string;
  hostName: string;
  title: string;
  classLevel: string;
  board: string;
  subject: string;
  chapter: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Olympiad';
  questionCount: number;
  timerSeconds: number;
  questionType: string;
  privacy: 'PUBLIC' | 'PRIVATE';
  passwordHash?: string;
  status: 'WAITING' | 'STARTING' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  currentQuestionIndex: number;
  questionStartedAt?: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  maxPlayers: number;
}

export interface Participant {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  correctAnswers: number;
  answeredQuestions: number;
  averageResponseTime: number;
  status: 'online' | 'ready' | 'answered';
  joinedAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  order: number;
  points: number;
}

export interface AnswerSubmission {
  uid: string;
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  pointsEarned: number;
  responseTimeMs: number;
  submittedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  type: 'USER' | 'AI' | 'SYSTEM';
  mentionsAI?: boolean;
  createdAt: string;
}

export interface WhiteboardElement {
  id: string;
  type: 'pen' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'sticky';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  text?: string;
  fill?: string;
}

export interface QuizResult {
  id: string;
  uid: string;
  roomId: string;
  quizTitle: string;
  subject: string;
  classLevel: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  totalQuestions: number;
  rank: number;
  aiInsight?: string;
  completedAt: string;
}

export interface UserAchievement {
  id: string;
  uid: string;
  achievementKey: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface StudyResource {
  id: string;
  title: string;
  book: string;
  subject: string;
  classLevel: string;
  chapter: string;
  source: string;
  description: string;
  summary: string;
  keyPoints: string[];
  keyFormulas?: string[];
  solvedExamples?: { question: string; solution: string }[];
  pdfUrl?: string;
  externalLink?: string;
}

export async function deleteRoomCompletely(roomId: string): Promise<boolean> {
  if (!roomId) return false;
  try {
    // 1. Delete participants
    const parts = await getDocs(collection(db, 'quizRooms', roomId, 'participants'));
    for (const d of parts.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 2. Delete questions
    const questions = await getDocs(collection(db, 'quizRooms', roomId, 'questions'));
    for (const d of questions.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 3. Delete answers
    const answers = await getDocs(collection(db, 'quizRooms', roomId, 'answers'));
    for (const d of answers.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 4. Delete messages
    const messages = await getDocs(collection(db, 'quizRooms', roomId, 'messages'));
    for (const d of messages.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 5. Delete whiteboard state
    await deleteDoc(doc(db, 'quizRooms', roomId, 'whiteboard', 'state')).catch(() => {});

    // 6. Delete parent quiz room doc
    await deleteDoc(doc(db, 'quizRooms', roomId));
    console.log(`Quiz room ${roomId} deleted cleanly from Firestore.`);
    return true;
  } catch (err) {
    console.warn(`Failed to completely delete room ${roomId}:`, err);
    return false;
  }
}

