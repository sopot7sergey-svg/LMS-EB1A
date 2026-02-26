'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
}

interface Block {
  label: string;
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
    title: 'Case Axis and Strategy',
    duration: '1–2 days',
    goal: 'Choose your field, narrative, and proposed endeavor so the entire package is cohesive.',
    artifact: 'Case Axis Pack (PDF + checklist)',
    lessons: [
      { id: '0.1', title: 'How USCIS reads an EB-1A case: "one story, one logic, one trajectory"' },
      { id: '0.2', title: 'Choosing your Field: how not to spread yourself too thin' },
      { id: '0.3', title: 'Proposed Endeavor: how to frame your future work convincingly' },
      { id: '0.4', title: 'Case positioning: which criteria make sense for your axis' },
    ],
    tool: 'AI Intake Interview → Case Axis Statement, Proposed Endeavor, Brand Keywords',
  },
  {
    id: 'M1',
    index: 1,
    title: 'Diagnostic Across the 10 Criteria',
    duration: '2–5 days',
    goal: 'Build a Criteria Matrix and choose 3–6 criteria aligned with your axis and evidence.',
    artifact: 'EB-1A Criteria Matrix v1 + Evidence Roadmap',
    lessons: [
      { id: '1.1', title: 'The 10 criteria: what actually "works" in practice (no promises)' },
      { id: '1.2', title: 'How evidence is "read": quality, independence, scale, verifiability' },
      { id: '1.3', title: 'Choosing 5–6 criteria instead of 3: the "thick case" strategy' },
      { id: '1.4', title: 'Evidence map: which document types support which criteria' },
      { id: '1.5', title: 'Overall merits: how to prepare "total persuasiveness" in advance' },
    ],
    tool: 'Criteria Mapper + Evidence To-Do Generator',
  },
  {
    id: 'M2',
    index: 2,
    title: 'Building Evidence for 3–6 Criteria',
    duration: '2–6 weeks',
    goal: 'Build Exhibits that truly "carry" the criteria. Structured by criterion blocks.',
    artifact: 'Exhibits Folder v1 + Exhibit List draft',
    blocks: [
      {
        label: '2A · Leading / Critical Role',
        lessons: [
          { id: '2A.1', title: 'What "critical role" means in evidence (not the title, but the impact)' },
          { id: '2A.2', title: 'How to present projects: scope → ownership → impact → metrics' },
          { id: '2A.3', title: 'Role confirmation letters: which wording and which attachments' },
        ],
        tool: 'Role & Impact Builder → Project Impact Brief + attachments list',
      },
      {
        label: '2B · High Salary / Remuneration',
        lessons: [
          { id: '2B.1', title: 'How to present compensation correctly' },
          { id: '2B.2', title: 'Market benchmarks (and what to use if perfect benchmarks are not available)' },
          { id: '2B.3', title: 'How not to "break" the case with unnecessary numbers' },
        ],
        tool: 'Compensation Pack Builder → pay stubs / offer letters / W-2 / equity docs + memo',
      },
      {
        label: '2C · Original Contributions of Major Significance',
        lessons: [
          { id: '2C.1', title: '"Major significance" = impact beyond your own team' },
          { id: '2C.2', title: 'Patents are not required: alternatives (architectures, implementations, savings, scale)' },
          { id: '2C.3', title: 'How to write a "Contribution Narrative" and support it with independent sources' },
        ],
        tool: 'Contribution Narrative Generator → 2–3 claims + evidence / metrics / confirming parties',
      },
      {
        label: '2D · Judging the Work of Others',
        lessons: [
          { id: '2D.1', title: 'What counts as judging (and what does not)' },
          { id: '2D.2', title: 'How to quickly and legally build up judging (hackathons, grants, peer review)' },
          { id: '2D.3', title: 'How to document judging: invitations, criteria, confirmations, logs' },
        ],
        tool: 'Judging Portfolio Builder → request email templates + log table + exhibit pack',
      },
      {
        label: '2E · Published Material About You',
        lessons: [
          { id: '2E.1', title: '"About you" vs "by you" — the key distinction' },
          { id: '2E.2', title: 'Interviews / profiles / mentions: structure and requirements' },
          { id: '2E.3', title: 'How to package publications as exhibits' },
        ],
        tool: 'Media Kit Builder → press bio + pitch angles + target list + exhibit formatting',
      },
      {
        label: '2F · Membership in Selective Associations',
        lessons: [
          { id: '2F.1', title: 'Why "paid and joined" does not work' },
          { id: '2F.2', title: 'How to prove selectivity: selection criteria, acceptance rate, requirements' },
          { id: '2F.3', title: 'What to use instead if membership is not selective' },
        ],
        tool: 'Membership Eligibility Analyzer → checks selectivity; recommends pack or alternative',
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
      { id: '3.1', title: 'Letter architecture: who confirms which facts' },
      { id: '3.2', title: '"Independent" letters: how to find authors and how to ask' },
      { id: '3.3', title: 'A letter must not be "he is a good person": structure (claim → evidence → impact)' },
      { id: '3.4', title: 'How to avoid templating and "too-similar" letters' },
      { id: '3.5', title: 'Letter attachments: author CV, bio, proof of authority' },
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
      { id: '4.1', title: 'Petition package structure: table of contents, tabs, exhibit numbering' },
      { id: '4.2', title: 'Cover letter / legal brief: criteria logic + overall merits' },
      { id: '4.3', title: 'Exhibit labeling: making it "officer-readable"' },
      { id: '4.4', title: 'Translations: formatting requirements and certification' },
      { id: '4.5', title: 'Final QA check: "how an officer thinks during the first pass"' },
    ],
    tool: 'Petition Assembler + Consistency Checker + Translation Packet Helper',
  },
  {
    id: 'M5',
    index: 5,
    title: 'Filing I-140 and Post-Filing Process',
    duration: '1 week',
    goal: 'Understand filing scenarios and what to do after filing.',
    artifact: 'Filing Plan + Final Checklist',
    lessons: [
      { id: '5.1', title: 'What gets filed: the I-140 package + dependencies based on U.S. status' },
      { id: '5.2', title: 'Premium processing: when it makes sense (no promises)' },
      { id: '5.3', title: 'AOS vs Consular processing: decision logic' },
      { id: '5.4', title: 'What happens after filing: receipt, requests, timelines, actions' },
      { id: '5.5', title: 'How to respond to real USCIS letters (process-focused)' },
    ],
    tool: 'Filing Readiness Checklist + Post-Filing Tracker',
  },
  {
    id: 'M6',
    index: 6,
    title: 'Officer-Style Review (EER)',
    duration: '2–3 iterations',
    goal: 'Not to "approve," but to always produce a "request to strengthen." Activates after Module 4.',
    artifact: 'EER Report v1 → v2 → v3 + Resolution Notes',
    lessons: [
      { id: '6.1', title: 'How to read the EER report and close items' },
      { id: '6.2', title: 'Prioritization: what is critical, recommended, optional' },
      { id: '6.3', title: 'Iteration: how to reach "minimal risk" in structure and clarity' },
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
  const totalLessons = MODULES.reduce((sum, m) => {
    if (m.blocks) return sum + m.blocks.reduce((s, b) => s + b.lessons.length, 0);
    return sum + (m.lessons?.length ?? 0);
  }, 0);

  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary" />
              <span className="text-xl font-semibold">LMS EB1A</span>
            </div>
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
          <div className="mt-12 flex items-center justify-center gap-10 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">7</p>
              <p className="text-foreground-muted">Modules</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{totalLessons}</p>
              <p className="text-foreground-muted">Video Lessons</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">12+</p>
              <p className="text-foreground-muted">AI Tools</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">1</p>
              <p className="text-foreground-muted">EER Engine</p>
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
              <span className="font-semibold">LMS EB1A</span>
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
