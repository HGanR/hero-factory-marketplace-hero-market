"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp } from "lucide-react";

const ELECTRIC_BLUE = "#00D1FF";

type Answer = "A" | "B" | "C" | null;

const SECTIONS = [
  {
    id: "liability",
    title: "Section 1 — Liability & Risk Exposure",
    questions: [
      {
        id: "q1",
        text: "Will your business interact directly with customers, clients, or the public?",
        options: [
          { value: "A", label: "No — fully online or informational only" },
          { value: "B", label: "Occasionally" },
          { value: "C", label: "Yes — regularly" },
        ],
      },
      {
        id: "q2",
        text: "Could a mistake in your work cause financial harm to a client?",
        options: [
          { value: "A", label: "Very unlikely" },
          { value: "B", label: "Possible" },
          { value: "C", label: "Likely" },
        ],
      },
      {
        id: "q3",
        text: "Will you sell physical products?",
        options: [
          { value: "A", label: "No" },
          { value: "B", label: "Possibly" },
          { value: "C", label: "Yes" },
        ],
      },
      {
        id: "q4",
        text: "Will your business sign contracts with vendors, clients, or partners?",
        options: [
          { value: "A", label: "Rarely" },
          { value: "B", label: "Sometimes" },
          { value: "C", label: "Frequently" },
        ],
      },
    ],
  },
  {
    id: "tax",
    title: "Section 2 — Revenue & Tax Profile",
    questions: [
      {
        id: "q5",
        text: "What revenue do you expect in the first 12 months?",
        options: [
          { value: "A", label: "Under $25,000" },
          { value: "B", label: "$25,000 – $75,000" },
          { value: "C", label: "$75,000+" },
        ],
      },
      {
        id: "q6",
        text: "Do you expect to deduct business expenses (equipment, software, office, marketing)?",
        options: [
          { value: "A", label: "Minimal expenses" },
          { value: "B", label: "Moderate expenses" },
          { value: "C", label: "Significant expenses" },
        ],
      },
      {
        id: "q7",
        text: "Do you want the option to elect S-Corp taxation later to reduce self-employment tax?",
        options: [
          { value: "A", label: "Not necessary" },
          { value: "B", label: "Possibly" },
          { value: "C", label: "Yes" },
        ],
      },
      {
        id: "q8",
        text: "Are you comfortable paying self-employment tax (15.3%) on all business profits?",
        options: [
          { value: "A", label: "Yes" },
          { value: "B", label: "Unsure" },
          { value: "C", label: "Prefer a strategy to reduce it" },
        ],
      },
    ],
  },
  {
    id: "growth",
    title: "Section 3 — Growth & Scaling",
    questions: [
      {
        id: "q9",
        text: "Do you plan to hire employees or contractors?",
        options: [
          { value: "A", label: "No" },
          { value: "B", label: "Maybe" },
          { value: "C", label: "Yes" },
        ],
      },
      {
        id: "q10",
        text: "Do you plan to bring in partners or investors?",
        options: [
          { value: "A", label: "No" },
          { value: "B", label: "Possibly" },
          { value: "C", label: "Yes" },
        ],
      },
      {
        id: "q11",
        text: "Do you want your business to appear more established or credible to clients?",
        options: [
          { value: "A", label: "Not important" },
          { value: "B", label: "Somewhat important" },
          { value: "C", label: "Very important" },
        ],
      },
    ],
  },
  {
    id: "financial",
    title: "Section 4 — Financial Separation",
    questions: [
      {
        id: "q12",
        text: "Do you want a separate business bank account and financial identity?",
        options: [
          { value: "A", label: "Not necessary" },
          { value: "B", label: "Possibly" },
          { value: "C", label: "Yes" },
        ],
      },
      {
        id: "q13",
        text: "Do you want your personal assets protected from business liabilities?",
        options: [
          { value: "A", label: "Not concerned" },
          { value: "B", label: "Somewhat concerned" },
          { value: "C", label: "Very concerned" },
        ],
      },
      {
        id: "q14",
        text: "Will you apply for business credit, loans, or merchant accounts?",
        options: [
          { value: "A", label: "No" },
          { value: "B", label: "Possibly" },
          { value: "C", label: "Yes" },
        ],
      },
    ],
  },
  {
    id: "operational",
    title: "Section 5 — Operational Complexity",
    questions: [
      {
        id: "q15",
        text: "Are you willing to maintain basic compliance such as:",
        subtext: "• annual filings\n• registered agent\n• operating agreement",
        options: [
          { value: "A", label: "Prefer simplicity" },
          { value: "B", label: "Possibly" },
          { value: "C", label: "Yes" },
        ],
      },
    ],
  },
];

// Optional Advanced Section
const ADVANCED_QUESTIONS = [
  {
    id: "q16",
    text: "Will your business own assets (equipment, vehicles, IP, real estate)?",
    options: [
      { value: "A", label: "No" },
      { value: "B", label: "Possibly" },
      { value: "C", label: "Yes" },
    ],
  },
  {
    id: "q17",
    text: "Will you operate in multiple states?",
    options: [
      { value: "A", label: "No" },
      { value: "B", label: "Possibly" },
      { value: "C", label: "Yes" },
    ],
  },
  {
    id: "q18",
    text: "Will you license intellectual property or digital products?",
    options: [
      { value: "A", label: "No" },
      { value: "B", label: "Possibly" },
      { value: "C", label: "Yes" },
    ],
  },
  {
    id: "q19",
    text: "Will you run paid advertising campaigns?",
    options: [
      { value: "A", label: "No" },
      { value: "B", label: "Possibly" },
      { value: "C", label: "Yes" },
    ],
  },
  {
    id: "q20",
    text: "Will you build a brand intended for acquisition or scaling?",
    options: [
      { value: "A", label: "No" },
      { value: "B", label: "Possibly" },
      { value: "C", label: "Yes" },
    ],
  },
];

const SCORE_MAP: Record<string, number> = { A: 0, B: 1, C: 2 };

function getScore(answers: Record<string, Answer>, includeAdvanced = false): number {
  const coreIds = SECTIONS.flatMap((s) => s.questions.map((q) => q.id));
  const ids = includeAdvanced
    ? [...coreIds, ...ADVANCED_QUESTIONS.map((q) => q.id)]
    : coreIds;
  return ids.reduce((sum, id) => sum + (answers[id] ? SCORE_MAP[answers[id]!] : 0), 0);
}

function getMaxScore(includeAdvanced: boolean): number {
  return includeAdvanced ? 40 : 30;
}

function getResult(score: number, maxScore: number) {
  const threshold1 = Math.round(maxScore * (10 / 30));
  const threshold2 = Math.round(maxScore * (20 / 30));

  if (score <= threshold1) {
    return {
      title: "Sole Proprietorship",
      subtitle: "Best if:",
      bullets: [
        "Low revenue",
        "Low liability risk",
        "Testing a business idea",
        "Minimal operational complexity",
      ],
      taxation: "Report income on Schedule C. Subject to self-employment tax.",
    };
  }
  if (score <= threshold2) {
    return {
      title: "Single-Member LLC",
      subtitle: "Benefits:",
      bullets: [
        "Liability separation",
        "Business credibility",
        "Cleaner accounting",
        "Can elect S-Corp taxation later",
      ],
      taxation:
        "Default: Pass-through (Schedule C). Optional: S-Corp election (Form 2553).",
    };
  }
  return {
    title: "LLC Structure (Possibly Multi-Member)",
    subtitle: "Best for:",
    bullets: [
      "Higher revenue potential",
      "Hiring employees",
      "Partnerships",
      "Investor participation",
      "Asset protection strategy",
    ],
    taxation:
      "Partnership taxation, S-Corp election, or default pass-through.",
  };
}

function getNextSteps(resultTitle: string): string[] {
  if (resultTitle.includes("Sole")) return [];
  return [
    "Choose a business name",
    "File Articles of Organization",
    "Obtain EIN",
    "Open business bank account",
    "Draft operating agreement",
  ];
}

function getWhyReasons(answers: Record<string, Answer>, score: number): string[] {
  const reasons: string[] = [];
  if (answers.q5 === "B")
    reasons.push("Your expected revenue is in the $25,000–$75,000 range");
  if (answers.q5 === "C")
    reasons.push("Your expected revenue exceeds $75,000");
  if (answers.q1 === "B" || answers.q1 === "C")
    reasons.push("You will interact with customers regularly");
  if (answers.q13 === "B" || answers.q13 === "C")
    reasons.push("Liability protection is beneficial");
  if (answers.q12 === "B" || answers.q12 === "C")
    reasons.push("You want business financial separation");
  if (answers.q9 === "B" || answers.q9 === "C")
    reasons.push("You plan to hire employees or contractors");
  if (answers.q10 === "B" || answers.q10 === "C")
    reasons.push("You may bring in partners or investors");
  if (reasons.length === 0 && score > 10)
    reasons.push("Your overall risk and growth profile supports entity formation");
  return reasons;
}

export function EntrepreneurStructureAssessment({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showResult, setShowResult] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const coreQuestionIds = SECTIONS.flatMap((s) => s.questions.map((q) => q.id));
  const advancedQuestionIds = ADVANCED_QUESTIONS.map((q) => q.id);
  const requiredIds = coreQuestionIds;
  const allIds = showAdvanced ? [...coreQuestionIds, ...advancedQuestionIds] : coreQuestionIds;

  const answeredCount = requiredIds.filter((id) => answers[id] != null).length;
  const totalRequired = requiredIds.length;
  const isComplete = answeredCount === totalRequired;
  const maxScore = getMaxScore(showAdvanced);
  const score = getScore(answers, showAdvanced);
  const result = getResult(score, maxScore);
  const nextSteps = getNextSteps(result.title);
  const whyReasons = getWhyReasons(answers, score);

  const handleAnswer = (id: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = () => {
    setShowResult(true);
  };

  const handleReset = () => {
    setAnswers({});
    setShowResult(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAnswers({});
      setShowResult(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-cyan-500/20"
        style={{ boxShadow: `0 0 40px rgba(0,209,255,0.15)` }}
      >
        <DialogHeader className="p-6 pb-4 border-b border-white/10 shrink-0">
          <DialogTitle className="text-xl">
            Entrepreneur Structure Assessment
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              &ldquo;Should You Form an LLC or Operate as a Sole Proprietor?&rdquo;
            </span>
            <span className="block text-slate-400">
              To determine whether you should operate as a <strong className="text-slate-300">Sole Proprietor</strong> or form a <strong className="text-slate-300">Limited Liability Company (LLC)</strong>, this assessment evaluates four structural factors:
            </span>
            <ul className="list-disc list-inside text-slate-400 text-sm space-y-1 ml-2">
              <li>Liability Risk</li>
              <li>Tax Profile</li>
              <li>Operational Complexity</li>
              <li>Growth & Capital Intent</li>
            </ul>
            <span className="block text-cyan-400/90 text-sm mt-2">
              Answer each question honestly based on your expected business activity in the next <strong>12–24 months</strong>.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6">
          <div className="py-6 space-y-8">
            {showResult ? (
              <ResultView
                score={score}
                maxScore={maxScore}
                result={result}
                nextSteps={nextSteps}
                whyReasons={whyReasons}
                onReset={handleReset}
                onOpenChange={onOpenChange}
              />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Progress
                    value={(answeredCount / totalRequired) * 100}
                    className="flex-1 h-2"
                  />
                  <span className="text-sm text-slate-400 shrink-0">
                    {answeredCount} / {totalRequired}
                  </span>
                </div>

                {SECTIONS.map((section) => (
                  <section key={section.id} className="space-y-4">
                    <h3 className="text-base font-semibold text-cyan-400">
                      {section.title}
                    </h3>
                    {section.questions.map((q) => (
                      <QuestionBlock
                        key={q.id}
                        question={q}
                        value={answers[q.id]}
                        onChange={(v) => handleAnswer(q.id, v)}
                      />
                    ))}
                  </section>
                ))}

                {/* Optional Advanced Section */}
                <div className="rounded-xl border border-cyan-500/20 bg-slate-800/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-300">
                      Additional Insight Questions (Optional)
                    </span>
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  {showAdvanced && (
                    <div className="p-4 pt-0 space-y-4 border-t border-white/5">
                      {ADVANCED_QUESTIONS.map((q) => (
                        <QuestionBlock
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                          onChange={(v) => handleAnswer(q.id, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={!isComplete}
                    className="font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${ELECTRIC_BLUE} 0%, #00E5FF 50%, #7DF9FF 100%)`,
                      color: "#0a0a0f",
                    }}
                  >
                    See My Recommendation
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionBlock({
  question,
  value,
  onChange,
}: {
  question: {
    id: string;
    text: string;
    subtext?: string;
    options: { value: string; label: string }[];
  };
  value: Answer;
  onChange: (v: Answer) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-200">{question.text}</p>
        {question.subtext && (
          <pre className="mt-2 text-xs text-slate-400 whitespace-pre-wrap font-sans">
            {question.subtext}
          </pre>
        )}
      </div>
      <RadioGroup
        value={value ?? ""}
        onValueChange={(v) => onChange(v as Answer)}
        className="flex flex-col gap-2"
      >
        {question.options.map((opt) => (
          <div
            key={opt.value}
            className="flex items-center space-x-3 rounded-lg border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} />
            <Label
              htmlFor={`${question.id}-${opt.value}`}
              className="flex-1 cursor-pointer text-sm text-slate-300"
            >
              {opt.value}. {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function ResultView({
  score,
  maxScore,
  result,
  nextSteps,
  whyReasons,
  onReset,
  onOpenChange,
}: {
  score: number;
  maxScore: number;
  result: ReturnType<typeof getResult>;
  nextSteps: string[];
  whyReasons: string[];
  onReset: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-cyan-500/30 bg-cyan-500/5 p-6">
        <div className="text-xs text-cyan-400 font-medium uppercase tracking-wider mb-1">
          Your Score: {score} / {maxScore}
        </div>
        <h3 className="text-xl font-bold text-white">
          Result: {result.title} Recommended
        </h3>
      </div>

      {whyReasons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Why:</h4>
          <ul className="space-y-1">
            {whyReasons.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-green-400">✔</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          {result.subtitle}
        </h4>
        <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
          {result.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Taxation:</h4>
        <p className="text-sm text-slate-400">{result.taxation}</p>
      </div>

      {nextSteps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">
            Next Steps:
          </h4>
          <ol className="list-decimal list-inside text-sm text-slate-400 space-y-1">
            {nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <Link
            href="/entity-builder"
            onClick={() => onOpenChange(false)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: `linear-gradient(135deg, ${ELECTRIC_BLUE} 0%, #00E5FF 100%)`,
              color: "#0a0a0f",
            }}
          >
            Go to Entity Builder →
          </Link>
        </div>
      )}

      <div className="pt-4 flex gap-3">
        <Button
          variant="outline"
          onClick={onReset}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          Retake Assessment
        </Button>
      </div>
    </div>
  );
}
