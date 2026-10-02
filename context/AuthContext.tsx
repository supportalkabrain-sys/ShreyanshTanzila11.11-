'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  googleProvider,
  db,
  UserProfile,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '@/lib/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: {
    username: string;
    classLevel: string;
    board: string;
    bio?: string;
    photoURL?: string;
  }) => Promise<boolean>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  claimUsername: (username: string) => Promise<boolean>;
  toggleTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  needsOnboarding: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  completeOnboarding: async () => false,
  updateProfile: async () => {},
  claimUsername: async () => false,
  toggleTheme: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserProfile;
            setProfile(data);
            setNeedsOnboarding(!data.username || !data.classLevel);
            applyTheme(data.theme || 'dark');
          } else {
            // First time login - prompt onboarding
            setProfile(null);
            setNeedsOnboarding(true);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign-in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
      setProfile(null);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const claimUsername = async (rawUsername: string): Promise<boolean> => {
    if (!user) return false;
    const cleanUsername = rawUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(cleanUsername)) {
      throw new Error('Username must be 3-25 alphanumeric characters or underscores.');
    }

    try {
      const claimRef = doc(db, 'usernames', cleanUsername);
      let success = false;

      await runTransaction(db, async (transaction) => {
        const claimDoc = await transaction.get(claimRef);
        if (claimDoc.exists()) {
          const currentClaim = claimDoc.data();
          if (currentClaim.uid !== user.uid) {
            throw new Error('Username is already taken by another student.');
          }
        }
        transaction.set(claimRef, {
          uid: user.uid,
          username: cleanUsername,
          createdAt: new Date().toISOString(),
        });
        success = true;
      });

      return success;
    } catch (error) {
      console.error('Error claiming username:', error);
      throw error;
    }
  };

  const completeOnboarding = async (data: {
    username: string;
    classLevel: string;
    board: string;
    bio?: string;
    photoURL?: string;
  }): Promise<boolean> => {
    if (!user) return false;

    // 1. Claim username transaction
    await claimUsername(data.username);

    // 2. Create user profile
    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || data.username,
      username: data.username.toLowerCase(),
      email: user.email || '',
      photoURL: data.photoURL || user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
      classLevel: data.classLevel,
      board: data.board,
      bio: data.bio || 'Ready to ace quizzes on QuizNova!',
      profileVisibility: 'PUBLIC',
      theme: 'dark',
      soundEnabled: true,
      animationsEnabled: true,
      defaultDifficulty: 'Medium',
      defaultQuestionCount: 5,
      totalScore: 0,
      quizzesPlayed: 0,
      correctAnswers: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, newProfile);
      setProfile(newProfile);
      setNeedsOnboarding(false);
      applyTheme('dark');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      return false;
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !profile) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updated = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(userRef, updated);
      setProfile((prev) => (prev ? { ...prev, ...updated } : null));

      if (data.theme) {
        applyTheme(data.theme);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const toggleTheme = (newTheme: 'light' | 'dark' | 'system') => {
    applyTheme(newTheme);
    if (profile) {
      updateProfile({ theme: newTheme });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsOnboarding,
        signInWithGoogle,
        signOut,
        completeOnboarding,
        updateProfile,
        claimUsername,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
