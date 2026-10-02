'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, ChatMessage, QuizQuestion, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, setDoc, doc } from 'firebase/firestore';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  HelpCircle,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface RoomChatProps {
  roomId: string;
  currentQuestion?: QuizQuestion | null;
  subject?: string;
  classLevel?: string;
  chapter?: string;
}

export const RoomChat: React.FC<RoomChatProps> = ({
  roomId,
  currentQuestion,
  subject = 'Science',
  classLevel = 'Class 10',
  chapter = 'General',
}) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const messagesQuery = query(
      collection(db, 'quizRooms', roomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          msgs.push({ id: doc.id, ...(doc.data() as any) });
        });
        setMessages(msgs);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `quizRooms/${roomId}/messages`);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !user) return;
    const cleanText = textToSend.trim();
    setInputText('');
    sound.playClick();

    const mentionsAI = cleanText.toLowerCase().includes('@ai');
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const userMsg: ChatMessage = {
      id: messageId,
      senderId: user.uid,
      senderName: profile?.displayName || user.displayName || 'Student',
      senderPhotoURL: profile?.photoURL || user.photoURL || undefined,
      text: cleanText,
      type: 'USER',
      mentionsAI,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'quizRooms', roomId, 'messages', messageId), userMsg);

      // If user tagged @AI, invoke the secure server-side tutor
      if (mentionsAI) {
        setIsAiThinking(true);
        fetch('/api/ai/chat-tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            currentQuestion,
            subject,
            classLevel,
            chapter,
            senderName: userMsg.senderName,
            userId: user.uid,
          }),
        })
          .then((res) => res.json())
          .then(async (aiData) => {
            const aiMsgId = `msg_ai_${Date.now()}`;
            const aiMsg: ChatMessage = {
              id: aiMsgId,
              senderId: 'NOVA_AI_TUTOR',
              senderName: 'NovaAI Tutor',
              senderPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=NovaAI',
              text: aiData.reply || 'Review the core definitions from this chapter.',
              type: 'AI',
              mentionsAI: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'quizRooms', roomId, 'messages', aiMsgId), aiMsg);
          })
          .catch((err) => console.error('AI error:', err))
          .finally(() => setIsAiThinking(false));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `quizRooms/${roomId}/messages`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 rounded-2xl border border-indigo-500/20 overflow-hidden shadow-xl">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h4 className="text-xs font-bold text-white">Live Room Chat</h4>
        </div>
        <span className="text-[10px] text-indigo-400 font-medium bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
          Tag @AI for hints
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
        {messages.length === 0 && (
          <div className="py-8 text-center text-slate-500 space-y-1">
            <Bot className="w-6 h-6 mx-auto opacity-30 text-indigo-400" />
            <p className="text-[11px]">Chat with other students or ask @AI for hints!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          const isAI = msg.type === 'AI';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 animate-in fade-in duration-100`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                {isAI ? (
                  <span className="font-bold text-purple-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" /> NovaAI
                  </span>
                ) : (
                  <span>{isMe ? 'You' : msg.senderName}</span>
                )}
                <span className="text-slate-600">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  isAI
                    ? 'bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/40 text-purple-100 shadow-md'
                    : isMe
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/60'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {isAiThinking && (
          <div className="flex items-center gap-2 text-xs text-purple-300 py-1 px-2 bg-purple-950/30 rounded-lg border border-purple-500/20 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>NovaAI is analyzing question context & crafting response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick AI Prompts */}
      <div className="px-3 py-1.5 bg-slate-950/40 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => sendMessage('@AI give me a conceptual hint')}
          className="text-[10px] whitespace-nowrap px-2 py-0.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 transition-colors"
        >
          <Lightbulb className="w-2.5 h-2.5" />
          <span>@AI Hint</span>
        </button>

        <button
          type="button"
          onClick={() => sendMessage('@AI explain this question')}
          className="text-[10px] whitespace-nowrap px-2 py-0.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-colors"
        >
          <HelpCircle className="w-2.5 h-2.5" />
          <span>@AI Explain</span>
        </button>

        <button
          type="button"
          onClick={() => sendMessage('@AI simplify this in plain terms')}
          className="text-[10px] whitespace-nowrap px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-colors"
        >
          <BookOpen className="w-2.5 h-2.5" />
          <span>@AI Simplify</span>
        </button>
      </div>

      {/* Input box */}
      <form onSubmit={handleFormSubmit} className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message room or type @AI..."
          className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
