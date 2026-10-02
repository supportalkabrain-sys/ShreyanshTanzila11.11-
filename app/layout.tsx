import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'QuizNova - AI Multiplayer Study & Quiz Platform',
  description: 'Realtime multiplayer AI quiz and collaborative study platform with Google Auth, Firestore, live arena, whiteboard, and educational study materials.',
  openGraph: {
    title: 'QuizNova - AI Multiplayer Study & Quiz Platform',
    description: 'Realtime multiplayer AI quiz and collaborative study platform with Google Auth, Firestore, live arena, whiteboard, and educational study materials.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuizNova - AI Multiplayer Study & Quiz Platform',
    description: 'Realtime multiplayer AI quiz and collaborative study platform with Google Auth, Firestore, live arena, whiteboard, and educational study materials.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body suppressHydrationWarning className="bg-slate-950 text-slate-100 min-h-screen selection:bg-indigo-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
