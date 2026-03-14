'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

interface Lesson {
  id: string;
  title: string;
}

interface Block {
  label: string;
  subtitle?: string;
  lessons: Lesson[];
  tool: string;
}

interface Module {
  id: string;
  index: number;
  title: string;
  duration: string;
  goal: string;
  artifact: string;
  blocks?: Block[];
  lessons?: Lesson[];
  tool?: string;
}

const MODULES: Module[] = [
  {
    id: 'M0',
    index: 0,
    title: '"Case Axis" and Strategy',
    duration: '1–2 days',
    goal: 'Choose your field, narrative, and proposed endeavor so the entire package is cohesive.',
    artifact: 'Case Axis Pack (PDF + checklist)',
    lessons: [
      { id: '0.1', title: 'How USCIS reads an EB-1A case.' },
      { id: '0.2', title: 'Choosing your field.' },
      { id: '0.3', title: 'Proposed endeavor.' },
      { id: '0.4', title: 'Case positioning.' },
    ],
    tool: 'AI Intake Interview → Case Axis Statement, Proposed Endeavor, Brand Keywords',
  },
  {
    id: 'M1',
    index: 1,
    title: 'Diagnosis Across the 10 Criteria',
    duration: '2–5 days',
    goal: 'Build a Criteria Matrix, map evidence, and prepare overall merits in advance.',
    artifact: 'EB-1A Criteria Matrix v1 + Evidence Roadmap',
    lessons: [
      { id: '1.1', title: 'The 10 criteria: what actually "works" in practice' },
      { id: '1.2', title: 'How evidence is "read"' },
      { id: '1.3', title: 'Choosing 5–6 criteria instead of 3' },
      { id: '1.4', title: 'Evidence map: which types of documents satisfy which criteria' },
      { id: '1.5', title: 'Overall merits: how to prepare "cumulative persuasiveness" in advance' },
    ],
    tool: 'Criteria Mapper + Evidence To-Do Generator',
  },
  {
    id: 'M2',
    index: 2,
    title: 'Building Evidence for the 10 Criteria',
    duration: '2–6 weeks',
    goal: 'Build evidence systematically across the criteria, starting with an introductory block and then moving criterion by criterion.',
    artifact: 'Exhibits Folder v1 + Exhibit List draft',
    blocks: [
      {
        label: '2.0 Introductory Block',
        lessons: [
          { id: '2.0.1', title: 'What "initial evidence" is and why context matters' },
          { id: '2.0.2', title: 'Principles: independence, verifiability, scale, cause-and-effect relationship' },
          { id: '2.0.3', title: 'How to formulate the Proposed Endeavor persuasively' },
          { id: '2.0.4', title: 'How to build "Exhibit logic"' },
        ],
        tool: 'Foundational evidence principles and petition framing',
      },
      {
        label: '2.1 Criterion 1',
        subtitle: 'Lesser nationally or internationally recognized prizes or awards',
        lessons: [
          { id: '2.1.1', title: 'What counts as an "award" and what does not' },
          { id: '2.1.2', title: 'How to prove "recognition": contest rules, judges, reach, competitiveness' },
          { id: '2.1.3', title: 'How to package it: certificate + award description + supporting sources' },
        ],
        tool: 'Award analysis and packaging',
      },
      {
        label: '2.2 Criterion 2',
        subtitle: 'Membership in associations that require outstanding achievements',
        lessons: [
          { id: '2.2.1', title: 'How USCIS looks at selectivity' },
          { id: '2.2.2', title: 'What evidence to use' },
          { id: '2.2.3', title: 'Plan B: what to use instead of membership if there is no selectivity' },
        ],
        tool: 'Selectivity analysis and backup evidence strategy',
      },
      {
        label: '2.3 Criterion 3',
        subtitle: 'Published material about you in professional or major media',
        lessons: [
          { id: '2.3.1', title: 'The difference between a profile / interview / mention vs. your own authored article' },
          { id: '2.3.2', title: 'How to prove "major / professional": media profile, audience, editorial policy' },
          { id: '2.3.3', title: 'How to present it' },
        ],
        tool: 'Media qualification and presentation',
      },
      {
        label: '2.4 Criterion 4',
        subtitle: 'Judging: Evaluation of the work of others',
        lessons: [
          { id: '2.4.1', title: 'What qualifies as judging' },
          { id: '2.4.2', title: 'How to document it' },
          { id: '2.4.3', title: 'How to build up judging quickly in a lawful and provable way' },
        ],
        tool: 'Judging qualification and documentation',
      },
      {
        label: '2.5 Criterion 5',
        subtitle: 'Original contributions of major significance',
        lessons: [
          { id: '2.5.1', title: '"Major significance" = impact beyond your own team' },
          { id: '2.5.2', title: 'How to present a claim-based approach' },
          { id: '2.5.3', title: 'What evidence to use' },
        ],
        tool: 'Claim framing and impact evidence',
      },
      {
        label: '2.6 Criterion 6',
        subtitle: 'Authorship of scholarly articles in professional publications or major media',
        lessons: [
          { id: '2.6.1', title: 'Scholarly vs. professional' },
          { id: '2.6.2', title: 'How to prove the impact of articles outside the academic environment' },
          { id: '2.6.3', title: 'Packaging: PDF, links, indexing, metrics (where applicable)' },
        ],
        tool: 'Article qualification and packaging',
      },
      {
        label: '2.7 Criterion 7',
        subtitle: 'Display of work at artistic exhibitions and showcases',
        lessons: [
          { id: '2.7.1', title: 'What counts as an exhibition/showcase' },
          { id: '2.7.2', title: 'How to prove selection and the status of the venue' },
          { id: '2.7.3', title: 'Packaging: catalogs, event pages, curator letters' },
        ],
        tool: 'Exhibition/showcase evidence packaging',
      },
      {
        label: '2.8 Criterion 8',
        subtitle: 'Leading or critical role for distinguished organizations',
        lessons: [
          { id: '2.8.1', title: '"Distinguished" organization: how to prove it' },
          { id: '2.8.2', title: 'How to prove the impact of articles outside the academic environment' },
          { id: '2.8.3', title: '"Critical" = indispensable function + impact on the result' },
        ],
        tool: 'Organization distinction and critical-role proof',
      },
      {
        label: '2.9 Criterion 9',
        subtitle: 'High salary or other significantly high remuneration',
        lessons: [
          { id: '2.9.1', title: 'Which documents qualify' },
          { id: '2.9.2', title: 'Market comparison: how to do it correctly and what sources to use' },
          { id: '2.9.3', title: 'How not to overload the case with too many numbers' },
        ],
        tool: 'Compensation evidence and benchmarking',
      },
      {
        label: '2.10 Criterion 10',
        subtitle: 'Commercial success in the performing arts',
        lessons: [
          { id: '2.10.1', title: 'Who it applies to and which metrics are accepted' },
          { id: '2.10.2', title: 'How to prove it' },
          { id: '2.10.3', title: 'How to package the evidence' },
        ],
        tool: 'Commercial success evidence packaging',
      },
      {
        label: '2.C Comparable Evidence',
        subtitle: 'Comparable Evidence (if the criteria do not fit)',
        lessons: [
          { id: '2.C.1', title: 'When comparable evidence is allowed' },
          { id: '2.C.2', title: 'How to build comparability' },
          { id: '2.C.3', title: 'Risks: why you must explain "why the 10 criteria do not fit"' },
        ],
        tool: 'Comparable evidence analysis',
      },
    ],
  },
  {
    id: 'M3',
    index: 3,
    title: 'Recommendation Letters',
    duration: '2–4 weeks (parallel)',
    goal: '6–10 strong letters, distributed by author type covering all claimed criteria.',
    artifact: 'Letters Pack v1 + Recommender Request Kit',
    lessons: [
      { id: '3.1', title: 'Letter architecture' },
      { id: '3.2', title: '"Independent" letters' },
      { id: '3.3', title: 'A letter should not be reduced to a general positive evaluation' },
      { id: '3.4', title: 'How to avoid template language and letters that are "too similar"' },
      { id: '3.5', title: 'Attachments to recommendation letters' },
    ],
    tool: 'Letter Planner + Letter Draft Studio + Repetition & Risk Checker',
  },
  {
    id: 'M4',
    index: 4,
    title: 'Petition Packaging and Final Assembly',
    duration: '1–3 weeks',
    goal: 'Assemble a complete submission-grade package.',
    artifact: 'Petition Package v1 (Draft Submission)',
    lessons: [
      { id: '4.1', title: 'Petition package structure' },
      { id: '4.2', title: 'Cover letter / legal brief: logic by criteria + overall merits' },
      { id: '4.3', title: 'Exhibit labeling: how to make it "readable for the officer"' },
      { id: '4.4', title: 'Translations: formatting requirements and certification' },
      { id: '4.5', title: 'Final QA review: "how the officer thinks during the first pass-through"' },
    ],
    tool: 'Petition Assembler + Consistency Checker + Translation Packet Helper',
  },
  {
    id: 'M5',
    index: 5,
    title: 'Filing the I-140 and What Comes After',
    duration: '1 week',
    goal: '(premium / AOS / consular)',
    artifact: 'Filing Plan + Final Checklist',
    lessons: [
      { id: '5.1', title: 'What gets filed: the I-140 package + dependencies based on U.S. status' },
      { id: '5.2', title: 'Premium processing: when it makes sense' },
      { id: '5.3', title: 'AOS vs. consular processing: decision logic' },
      { id: '5.4', title: 'What happens after filing' },
      { id: '5.5', title: 'How to respond to real USCIS notices' },
    ],
    tool: 'Filing Readiness Checklist + Post-Filing Tracker',
  },
  {
    id: 'M6',
    index: 6,
    title: 'Officer-Style Review',
    duration: '2–3 iterations',
    goal: 'Not to "approve," but to always produce a "request to strengthen." Activates after Module 4.',
    artifact: 'EER Report v1 → v2 → v3 + Resolution Notes',
    lessons: [
      { id: '6.1', title: 'How to read the EER/SER report and how to close the flagged points' },
      { id: '6.2', title: 'Prioritization: what is critical, what is desirable, and what is optional' },
      { id: '6.3', title: 'Iteration: how to get to "minimum risk" in structure and clarity' },
    ],
    tool: 'Evidence Enhancement Request (EER) Generator — RAG + Officer Decision Tree + cite-or-abstain',
  },
];

function ModuleAccordion({ module }: { module: Module }) {
  const [open, setOpen] = useState(false);
  const lessonCount = module.blocks
    ? module.blocks.reduce((sum, b) => sum + b.lessons.length, 0)
    : (module.lessons?.length ?? 0);

  const accentColors: Record<string, string> = {
    M0: 'text-violet-400',
    M1: 'text-blue-400',
    M2: 'text-emerald-400',
    M3: 'text-amber-400',
    M4: 'text-orange-400',
    M5: 'text-pink-400',
    M6: 'text-red-400',
  };
  const accent = accentColors[module.id] ?? 'text-primary';

  return (
    <div className={`rounded-xl border transition-colors duration-200 ${open ? 'border-border-hover bg-background-card' : 'border-border bg-background-card hover:border-border-hover'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center gap-4 text-left"
      >
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-background-tertiary font-bold text-sm ${accent}`}>
          {module.index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-foreground">{module.title}</h3>
            <span className="text-xs text-foreground-muted bg-background-tertiary px-2 py-0.5 rounded-full">
              {lessonCount} lessons
            </span>
            <span className="text-xs text-foreground-muted">{module.duration}</span>
          </div>
          <p className="mt-1 text-sm text-foreground-secondary truncate">{module.goal}</p>
        </div>

        <svg
          className={`h-5 w-5 flex-shrink-0 text-foreground-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-border pt-5 space-y-5">
          {/* Flat lessons list */}
          {module.lessons && !module.blocks && (
            <div className="space-y-2">
              {module.lessons.map((lesson) => (
                <div key={lesson.id} className="flex items-start gap-3 py-2">
                  <span className={`flex-shrink-0 text-xs font-mono font-semibold mt-0.5 w-8 ${accent}`}>
                    {lesson.id}
                  </span>
                  <span className="text-sm text-foreground-secondary">{lesson.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Blocked lessons (Module 2) */}
          {module.blocks && (
            <div className="space-y-4">
              {module.blocks.map((block) => (
                <div key={block.label} className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${accent}`}>
                    {block.label}
                  </p>
                  {block.subtitle && (
                    <p className="mb-3 text-sm text-foreground-secondary">{block.subtitle}</p>
                  )}
                  <div className="space-y-2 mb-3">
                    {block.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-start gap-3">
                        <span className={`flex-shrink-0 text-xs font-mono font-semibold mt-0.5 w-8 ${accent}`}>
                          {lesson.id}
                        </span>
                        <span className="text-sm text-foreground-secondary">{lesson.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border">
                    <svg className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-foreground-muted">{block.tool}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Tool row (non-block modules) */}
          {module.tool && !module.blocks && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-background-secondary px-4 py-3">
              <svg className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-foreground-secondary">{module.tool}</span>
            </div>
          )}

          {/* Artifact */}
          <div className="flex items-center gap-2 text-sm">
            <svg className="h-4 w-4 flex-shrink-0 text-foreground-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-foreground-muted">Artifact:</span>
            <span className="text-foreground-secondary">{module.artifact}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(isAdmin() ? '/admin/dashboard' : '/dashboard');
    }
  }, [router, isAuthenticated, isAdmin]);

  const totalLessons = MODULES.reduce((sum, m) => {
    if (m.blocks) return sum + m.blocks.reduce((s, b) => s + b.lessons.length, 0);
    return sum + (m.lessons?.length ?? 0);
  }, 0);

  // Always render landing; redirect happens in useEffect (avoids stuck Loading)
  if (isAuthenticated()) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center" style={{ backgroundColor: '#0a0a0f', color: '#a1a1aa' }}>
        <div>Redirecting...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary" />
              <span className="text-xl font-semibold">Aipas</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="btn-ghost">Sign In</Link>
              <Link href="/register" className="btn-primary">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Build Your{' '}
            <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              EB-1A Petition
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-secondary">
            AI-assisted course to build a submission-ready EB-1A I-140 petition package.
            Learn the process, build your evidence, and get officer-style feedback.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register" className="btn-primary px-8 py-3 text-base">
              Start Your Journey
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-3 text-base">
              Sign In
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="flex flex-col items-center justify-center rounded-lg bg-background-card border border-border px-6 py-4">
              <span className="text-2xl font-bold text-foreground">7</span>
              <span className="mt-1 text-sm text-foreground-muted">Modules</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg bg-background-card border border-border px-6 py-4">
              <span className="text-2xl font-bold text-foreground">{totalLessons}</span>
              <span className="mt-1 text-sm text-foreground-muted">Video Lessons</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg bg-background-card border border-border px-6 py-4">
              <span className="text-2xl font-bold text-foreground">12+</span>
              <span className="mt-1 text-sm text-foreground-muted">AI Tools</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg bg-background-card border border-border px-6 py-4">
              <span className="text-2xl font-bold text-foreground">1</span>
              <span className="mt-1 text-sm text-foreground-muted">IEER Engine</span>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
              title: 'Structured Course',
              desc: '7 modules covering case strategy, evidence building, letters, assembly, and filing.',
            },
            {
              icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
              title: 'AI-Powered Tools',
              desc: '12+ AI tools replace homework — evidence packs, letter drafts, petition assembly.',
            },
            {
              icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
              title: 'Officer-Style Review',
              desc: 'EER with citations to 8 CFR, USCIS Policy Manual, and Kazarian precedent.',
            },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-foreground-secondary">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Course Modules Accordion */}
        <div className="mt-24">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">Course Curriculum</h2>
            <p className="mt-3 text-foreground-secondary">
              {MODULES.length} modules · {totalLessons} lessons · Click any module to see what&apos;s inside
            </p>
          </div>

          <div className="space-y-3">
            {MODULES.map((module) => (
              <ModuleAccordion key={module.id} module={module} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-12 mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary" />
              <span className="font-semibold">Aipas</span>
            </div>
            <p className="text-sm text-foreground-muted text-center">
              This platform does not provide legal advice or predict immigration outcomes.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
