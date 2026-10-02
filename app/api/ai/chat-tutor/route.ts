import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// In-memory rate limiting map: userId -> timestamps array
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      currentQuestion,
      subject = 'Science',
      classLevel = 'Class 10',
      chapter = 'General',
      senderName = 'Student',
      userId = 'anon',
    } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    if (!checkRateLimit(userId)) {
      return NextResponse.json({
        reply: "You've reached the AI query speed limit. Please take a moment to review before asking again!",
        rateLimited: true,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: `Hello ${senderName}! Here is a helpful study tip for ${subject} (${chapter}): Review the fundamental definitions and key formulas in your NCERT notes. Feel free to re-check the options carefully!`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const lower = message.toLowerCase();
    const isHint = lower.includes('hint');
    const isExplain = lower.includes('explain') || lower.includes('why');
    const isSimplify = lower.includes('simplify');
    const isSolve = lower.includes('solve');

    let modeInstruction = 'Provide a concise, encouraging educational explanation suited for this student.';
    if (isHint) {
      modeInstruction = 'CRITICAL: The student is asking for a HINT. DO NOT reveal the correct answer option or answer text directly! Give a guiding conceptual clue that leads them to figure it out themselves.';
    } else if (isSimplify) {
      modeInstruction = 'Explain the concept using very simple everyday analogies and plain language, breaking down complex jargon.';
    } else if (isSolve) {
      modeInstruction = 'Walk through the logical deduction step-by-step so the student understands the method, without just declaring the answer.';
    }

    let questionContext = '';
    if (currentQuestion) {
      questionContext = `
CURRENT QUIZ QUESTION CONTEXT:
Question: ${currentQuestion.question}
Options:
A) ${currentQuestion.options?.[0] || ''}
B) ${currentQuestion.options?.[1] || ''}
C) ${currentQuestion.options?.[2] || ''}
D) ${currentQuestion.options?.[3] || ''}
Authoritative Explanation: ${currentQuestion.explanation || ''}
`;
    }

    const prompt = `You are "NovaAI", a friendly, patient, world-class educational AI tutor in the QuizNova multiplayer study arena.
Student Name: ${senderName}
Class: ${classLevel}
Subject: ${subject}
Chapter: ${chapter}

${questionContext}

STUDENT REQUEST:
"${message}"

INSTRUCTION:
${modeInstruction}

RULES:
- Answer in 2 to 4 concise, crisp sentences suitable for a live chat message.
- If it's a hint, never spoil the answer!
- Be warm, pedagogical, encouraging, and accurate.
- Do NOT use markdown headers (#), keep it like a smart tutor chat message.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.4,
      },
    });

    const reply = response.text?.trim() || `Remember: in ${subject}, verify each option against the fundamental laws before answering!`;

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error: any) {
    console.error('AI chat tutor error:', error);
    return NextResponse.json({
      reply: 'AI is temporarily taking a breather. Focus on the core principles of the chapter and you will crack it!',
      error: true,
    });
  }
}
