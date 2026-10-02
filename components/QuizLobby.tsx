'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, QuizRoom, Participant, handleFirestoreError, OperationType, deleteRoomCompletely } from '@/lib/firebase';
import { doc, collection, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Users,
  Copy,
  Check,
  Crown,
  Play,
  Share2,
  Clock,
  Layers,
  Sparkles,
  BookOpen,
  ArrowLeft,
  X,
  MessageSquare,
  PenTool,
} from 'lucide-react';
import { RoomChat } from './RoomChat';
import { sound } from '@/lib/sound';

interface QuizLobbyProps {
  roomId: string;
  onStartQuiz: () => void;
  onLeaveRoom: () => void;
}

export const QuizLobby: React.FC<QuizLobbyProps> = ({
  roomId,
  onStartQuiz,
  onLeaveRoom,
}) => {
  const { user, profile } = useAuth();
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showChatMobile, setShowChatMobile] = useState(false);

  // 1. Subscribe to room document
  useEffect(() => {
    if (!roomId) return;

    const roomRef = doc(db, 'quizRooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as QuizRoom;
          setRoom(data);
          // If room becomes LIVE, start the quiz for all clients!
          if (data.status === 'LIVE' || data.status === 'STARTING') {
            onStartQuiz();
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `quizRooms/${roomId}`)
    );

    return () => unsubscribe();
  }, [roomId, onStartQuiz]);

  // 2. Subscribe to participants
  useEffect(() => {
    if (!roomId) return;

    const participantsRef = collection(db, 'quizRooms', roomId, 'participants');
    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        const list: Participant[] = [];
        snapshot.forEach((d) => list.push(d.data() as Participant));
        setParticipants(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `quizRooms/${roomId}/participants`)
    );

    return () => unsubscribe();
  }, [roomId]);

  const isHost = room?.hostId === user?.uid;
  const myParticipant = participants.find((p) => p.uid === user?.uid);

  const toggleReady = async () => {
    if (!user || !myParticipant) return;
    sound.playClick();
    const newReadyState = !myParticipant.isReady;

    try {
      await updateDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid), {
        isReady: newReadyState,
        status: newReadyState ? 'ready' : 'online',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quizRooms/${roomId}/participants/${user.uid}`);
    }
  };

  const handleStartGame = async () => {
    if (!isHost || !room) return;
    sound.playClick();

    try {
      const now = Date.now();
      await updateDoc(doc(db, 'quizRooms', roomId), {
        status: 'LIVE',
        currentQuestionIndex: 0,
        questionStartedAt: now,
        startedAt: new Date().toISOString(),
      });
      sound.playVictory();
      onStartQuiz();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quizRooms/${roomId}`);
    }
  };

  const handleKickParticipant = async (targetUid: string) => {
    if (!isHost || targetUid === user?.uid) return;
    if (confirm('Remove this player from the lobby?')) {
      try {
        await deleteDoc(doc(db, 'quizRooms', roomId, 'participants', targetUid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `quizRooms/${roomId}/participants/${targetUid}`);
      }
    }
  };

  const copyRoomCode = () => {
    if (!room) return;
    sound.playClick();
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    if (!room) return;
    sound.playClick();
    const url = `${window.location.origin}/join/${room.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={async () => {
            sound.playClick();
            if (isHost) {
              if (confirm('Leave lobby? As host, this will close and delete the room.')) {
                await deleteRoomCompletely(roomId);
                onLeaveRoom();
              }
            } else {
              if (user) {
                await deleteDoc(doc(db, 'quizRooms', roomId, 'participants', user.uid)).catch(() => {});
              }
              onLeaveRoom();
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChatMobile(!showChatMobile)}
            className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </button>

          <button
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-300 transition-colors shadow-sm"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Lobby Left (Info & Players) | Chat Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 shadow-xl">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                    {room?.classLevel || 'Class 10'} • {room?.board || 'CBSE'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300">
                    {room?.subject || 'Science'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                    {room?.difficulty || 'Medium'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {room?.title || 'Multiplayer Quiz Lobby'}
                </h1>
                <p className="text-xs text-slate-300 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Chapter: {room?.chapter}</span>
                </p>
              </div>

              {/* Room Code Box */}
              <div className="flex flex-col items-center sm:items-end gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Room Invite Code
                </span>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/80 border border-indigo-500/50 hover:border-indigo-400 text-indigo-300 font-mono text-xl font-black tracking-widest transition-all group shadow-inner"
                  title="Click to copy room code"
                >
                  <span>{room?.roomCode || '------'}</span>
                  {copiedCode ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                  )}
                </button>
                <span className="text-[10px] text-slate-500">
                  {copiedCode ? 'Copied to clipboard!' : 'Click code to copy'}
                </span>
              </div>
            </div>

            {/* Room Stats Strip */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">Questions</span>
                <p className="font-bold text-slate-200">{room?.questionCount || 5} Questions</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">Timer</span>
                <p className="font-bold text-slate-200">{room?.timerSeconds || 30}s / question</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">Host</span>
                <p className="font-bold text-indigo-300 flex items-center justify-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span className="truncate max-w-[100px]">{room?.hostName || 'Host'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Participants Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Waiting Lobby Players ({participants.length}/{room?.maxPlayers || 12})</span>
              </h3>
              <span className="text-xs text-slate-400">
                {participants.filter((p) => p.isReady).length} Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participants.map((p) => {
                const isThisHost = p.uid === room?.hostId;
                const isMe = p.uid === user?.uid;

                return (
                  <div
                    key={p.uid}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isMe
                        ? 'bg-indigo-950/30 border-indigo-500/50'
                        : 'bg-slate-950/50 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <img
                          src={p.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.uid}`}
                          alt={p.displayName}
                          className="w-10 h-10 rounded-full bg-slate-800 object-cover border border-slate-700"
                        />
                        {isThisHost && (
                          <div className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-amber-400 text-slate-950 shadow-sm" title="Room Host">
                            <Crown className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">
                            {p.displayName}
                          </p>
                          {isMe && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{p.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          p.isReady
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {p.isReady ? 'READY' : 'WAITING'}
                      </span>

                      {isHost && !isMe && (
                        <button
                          onClick={() => handleKickParticipant(p.uid)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Kick player"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleReady}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                  myParticipant?.isReady
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {myParticipant?.isReady ? 'Cancel Ready' : "I'm Ready to Play!"}
              </button>

              {isHost && (
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="w-full sm:w-auto px-8 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-indigo-600/40 transition-all flex items-center justify-center gap-2 active:scale-95 animate-pulse"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Live Quiz Arena</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat & @AI */}
        <div className={`lg:block ${showChatMobile ? 'block' : 'hidden'} h-[500px] lg:h-[620px]`}>
          <RoomChat
            roomId={roomId}
            subject={room?.subject}
            classLevel={room?.classLevel}
            chapter={room?.chapter}
          />
        </div>
      </div>
    </div>
  );
};
