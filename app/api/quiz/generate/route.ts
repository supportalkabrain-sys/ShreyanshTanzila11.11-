import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface RawGeneratedQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty?: string;
  points?: number;
}

// Fisher-Yates shuffle to ensure 100% uniform 25% distribution across A (0), B (1), C (2), D (3)
function shuffleQuestionOptions(q: RawGeneratedQuestion, idx: number, difficulty: string) {
  const originalOptions = (Array.isArray(q.options) ? q.options : []).map(opt => String(opt).trim());
  
  // Ensure exactly 4 options
  while (originalOptions.length < 4) {
    originalOptions.push(`Alternative concept option ${originalOptions.length + 1}`);
  }
  const cleanOptions = originalOptions.slice(0, 4);

  const rawCorrect = typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < 4
    ? q.correctAnswer
    : 0;

  // Pair each option with whether it is the correct one
  const indexed = cleanOptions.map((text, i) => ({
    text,
    isCorrect: i === rawCorrect,
  }));

  // Shuffle array
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }

  const finalOptions = indexed.map(item => item.text);
  const finalCorrectIndex = indexed.findIndex(item => item.isCorrect);

  return {
    id: `q_${Date.now()}_${idx + 1}`,
    question: String(q.question).trim(),
    options: finalOptions,
    correctAnswer: finalCorrectIndex >= 0 ? finalCorrectIndex : Math.floor(Math.random() * 4),
    explanation: String(q.explanation || 'Refer to the curriculum chapter notes for complete conceptual derivation.').trim(),
    difficulty: String(q.difficulty || difficulty),
    order: idx,
    points: Number(q.points) >= 50 ? Number(q.points) : (difficulty === 'Hard' ? 150 : difficulty === 'Easy' ? 80 : 100),
  };
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const {
    classLevel = 'Class 10',
    board = 'CBSE',
    subject = 'Science',
    chapter = 'Chemical Reactions and Equations',
    difficulty = 'Medium',
    questionCount = 5,
    questionType = 'Multiple Choice',
  } = body;

  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 20);
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });

    // Multi-model resilience: try primary fast model, then secondary if high demand (503) occurs
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    const prompt = `You are a premier senior teacher crafting an educational assessment for Indian school students.
Generate exactly ${count} curriculum-aligned multiple-choice questions for:
- Standard / Class: ${classLevel}
- Board: ${board}
- Subject: ${subject}
- Chapter / Topic: ${chapter}
- Difficulty: ${difficulty}
- Question Type: ${questionType}

STRICT ASSESSMENT RULES:
1. Every question must have EXACTLY 4 distinct, plausible options (A, B, C, D).
2. CRITICAL DISTRIBUTION: Evenly distribute the correct answer index across 0 (A), 1 (B), 2 (C), and 3 (D). Do NOT put the correct answer only at A or B. Options C and D must be correct just as often as A and B!
3. "correctAnswer" MUST be an integer between 0 and 3.
4. "explanation" MUST be 2-3 sentences explaining step-by-step why the correct option is true and what scientific/mathematical formula or textbook fact proves it.
5. All 4 options must be believable and relevant to ${chapter}.

OUTPUT JSON FORMAT (array of objects):
{
  "questions": [
    {
      "id": "q1",
      "question": "Which of the following processes represents an endothermic decomposition reaction?",
      "options": [
        "Combustion of natural gas",
        "Respiration in human body",
        "Thermal decomposition of calcium carbonate into CaO and CO2",
        "Formation of water from hydrogen and oxygen gas"
      ],
      "correctAnswer": 2,
      "explanation": "Heating limestone (calcium carbonate) absorbs heat energy to produce calcium oxide and carbon dioxide, making it a classic endothermic decomposition reaction.",
      "points": 100
    },
    {
      "id": "q2",
      "question": "What is the SI unit of electric potential difference?",
      "options": [
        "Ampere (A)",
        "Ohm (Ω)",
        "Watt (W)",
        "Volt (V)"
      ],
      "correctAnswer": 3,
      "explanation": "Electric potential difference between two points in an electric circuit is measured in Volts (V), which equals one Joule per Coulomb.",
      "points": 100
    }
  ]
}`;

    for (const model of candidateModels) {
      try {
        console.log(`Generating AI questions with ${model}...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });

        const responseText = response.text || '';
        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        }

        const rawQuestions = Array.isArray(parsed.questions)
          ? parsed.questions
          : Array.isArray(parsed)
          ? parsed
          : [];

        if (rawQuestions.length >= 3) {
          // Shuffle options so A, B, C, D have guaranteed equal 25% probability
          const finalizedQuestions = rawQuestions
            .slice(0, count)
            .map((q: any, idx: number) => shuffleQuestionOptions(q, idx, difficulty));

          return NextResponse.json({
            success: true,
            questions: finalizedQuestions,
            source: model,
          });
        }
      } catch (err: any) {
        console.warn(`Model ${model} attempt failed:`, err.message || err);
        // Continue to next model in candidateModels
      }
    }
  }

  // Fallback Question Bank with balanced distribution of correct answers across A, B, C, and D
  console.log('Serving curriculum question bank with randomized A/B/C/D distribution');
  const fallbackList = getCurriculumQuestionBank(subject, chapter, difficulty, count);
  const shuffledFallback = fallbackList.map((q, idx) => shuffleQuestionOptions(q, idx, difficulty));

  return NextResponse.json({
    success: true,
    questions: shuffledFallback,
    source: 'curriculum-bank',
  });
}

function getCurriculumQuestionBank(subject: string, chapter: string, difficulty: string, count: number): RawGeneratedQuestion[] {
  const bank: RawGeneratedQuestion[] = [
    {
      id: 'fb_1',
      question: `In ${subject} (${chapter}), which statement accurately expresses the fundamental conservation law?`,
      options: [
        'Total mass and energy in an isolated system remain constant throughout any transformation',
        'Mass continuously increases as thermal energy is dissipated',
        'Energy is irreversibly destroyed whenever chemical bonds break',
        'Products in spontaneous reactions always possess higher net rest mass',
      ],
      correctAnswer: 0, // Option A
      explanation: 'According to the first law of thermodynamics and the law of conservation of mass, total mass-energy in an isolated system is strictly conserved.',
      difficulty,
      points: 100,
    },
    {
      id: 'fb_2',
      question: `Which factor is directly responsible for increasing the rate of reaction in ${chapter}?`,
      options: [
        'Decreasing the temperature to stabilize reactants',
        'Lowering the activation energy barrier through the addition of an appropriate catalyst',
        'Diluting the concentration of active species',
        'Increasing particle size to reduce surface contact',
      ],
      correctAnswer: 1, // Option B
      explanation: 'A catalyst accelerates reaction velocity by providing an alternate reaction pathway with a lower activation energy without changing the thermodynamic equilibrium.',
      difficulty,
      points: 100,
    },
    {
      id: 'fb_3',
      question: `When investigating phenomena in ${chapter}, which physical change specifically indicates an exothermic process?`,
      options: [
        'Continuous temperature drop of the surrounding solution',
        'Absorption of radiant thermal energy from ambient surroundings',
        'Evolution and release of heat causing an increase in system temperature',
        'Zero enthalpy change (ΔH = 0) with phase retention',
      ],
      correctAnswer: 2, // Option C
      explanation: 'Exothermic reactions and transitions release heat to their surroundings, causing the surrounding temperature to rise (negative ΔH).',
      difficulty,
      points: 100,
    },
    {
      id: 'fb_4',
      question: `In standard curriculum analysis of ${subject}, what is the authoritative SI unit for measuring energy or work done?`,
      options: [
        'Calorie (cal)',
        'Horsepower (hp)',
        'Erg',
        'Joule (J)',
      ],
      correctAnswer: 3, // Option D
      explanation: 'The International System of Units (SI) standard coherent derived unit for both energy and mechanical work is the Joule (J = N·m = kg·m²/s²).',
      difficulty,
      points: 100,
    },
    {
      id: 'fb_5',
      question: `In ${subject} problem solving for ${chapter}, what is the critical first step before computing final answers?`,
      options: [
        'Selecting an arbitrary multiple-choice option without checking units',
        'Omitting vector direction when solving scalar problems',
        'Systematically identifying given parameters, formulas, and converting all quantities to uniform SI units',
        'Assuming room temperature values regardless of specified experimental conditions',
      ],
      correctAnswer: 2, // Option C
      explanation: 'Sound scientific problem solving demands extracting given values, checking dimensional consistency, and standardizing all metrics to coherent SI units.',
      difficulty,
      points: 100,
    },
    {
      id: 'fb_6',
      question: `Which of the following optical or chemical phenomena is uniquely associated with ${chapter}?`,
      options: [
        'Complete reflection with zero refractive index variance',
        'Spontaneous decay without thermodynamic initiation',
        'Linear proportionality between applied potential and induced flux',
        'Dynamic equilibrium where forward and reverse transition rates are equal',
      ],
      correctAnswer: 3, // Option D
      explanation: 'Dynamic equilibrium represents a state in which competing forward and reverse processes occur at equal rates, resulting in constant macroscopic observable properties.',
      difficulty,
      points: 100,
    },
  ];

  return bank.slice(0, count);
}
