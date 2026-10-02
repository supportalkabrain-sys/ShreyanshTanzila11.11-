import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      score = 0,
      totalQuestions = 5,
      correctAnswers = 0,
      accuracy = 0,
      subject = 'Science',
      classLevel = 'Class 10',
      chapter = 'General',
      rank = 1,
      totalPlayers = 1,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        insight: `Great effort on ${chapter}! You achieved an accuracy of ${accuracy}% and ranked #${rank} among ${totalPlayers} player(s). Keep revising the key chapter definitions and practicing numericals to reach 100%!`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an educational analytics coach for QuizNova.
A student just completed a live multiplayer quiz session with these stats:
- Class: ${classLevel}
- Subject: ${subject}
- Chapter/Topic: ${chapter}
- Score: ${score}
- Total Questions: ${totalQuestions}
- Correct Answers: ${correctAnswers}
- Accuracy: ${accuracy}%
- Rank: #${rank} out of ${totalPlayers} players

Generate a personalized, deeply insightful and motivational 3-4 sentence performance analysis:
1. Highlight their demonstrated strength based on their performance level.
2. Provide a specific, actionable study tip or concept in "${chapter}" they should reinforce next.
3. End with an energetic encouraging remark.
Keep the tone professional, inspiring, and student-focused.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.5,
      },
    });

    const insight = response.text?.trim() || `Solid execution on ${chapter}! With ${accuracy}% accuracy, your foundational understanding is clear. Target reviewing the trickier edge cases to secure full marks next time!`;

    return NextResponse.json({
      success: true,
      insight,
    });
  } catch (error) {
    console.error('AI insight error:', error);
    return NextResponse.json({
      success: true,
      insight: 'Well played! Regular revision of chapter notes and formula sheets will boost your recall speed and accuracy in upcoming quizzes.',
    });
  }
}
