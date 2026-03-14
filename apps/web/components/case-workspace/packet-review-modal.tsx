'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileWarning,
  Calendar,
  CircleDot,
  CircleSlash,
  Circle,
  AlertCircle,
} from 'lucide-react';

interface PacketReviewModalProps {
  caseId: string;
  latestCompileJobId: string | null;
  open: boolean;
  onClose: () => void;
  onReviewComplete?: () => void;
  packetVersion?: number;
  savedReportJobId?: string | null;
}

type RiskLevel = 'low_risk' | 'medium_risk' | 'high_risk' | 'critical_gaps';
type ModalView = 'setup' | 'running' | 'report';

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; icon: typeof ShieldCheck }> = {
  low_risk: { label: 'Low Risk', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: ShieldCheck },
  medium_risk: { label: 'Medium Risk', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Shield },
  high_risk: { label: 'High Risk', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: ShieldAlert },
  critical_gaps: { label: 'Critical Gaps', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: ShieldX },
};

const SUPPORT_LEVEL_STYLES: Record<string, string> = {
  strong: 'text-green-700 bg-green-50 border-green-200',
  moderate: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  weak: 'text-orange-700 bg-orange-50 border-orange-200',
  missing: 'text-red-700 bg-red-50 border-red-200',
  not_assessable: 'text-gray-500 bg-gray-50 border-gray-200',
  not_claimed: 'text-gray-400 bg-gray-50/50 border-gray-100',
};

const FILING_STATUS_STYLES: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  present: { color: 'text-green-600', icon: CheckCircle2 },
  missing: { color: 'text-red-600', icon: CircleSlash },
  incomplete: { color: 'text-yellow-600', icon: CircleDot },
  needs_correction: { color: 'text-orange-600', icon: AlertCircle },
};

function Section({ title, children, defaultOpen = false, badge, badgeColor }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-sm hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          {title}
        </span>
        {badge !== undefined && (
          <span className={`text-xs rounded-full px-2 py-0.5 ${badgeColor || 'bg-gray-100 text-gray-600'}`}>{badge}</span>
        )}
      </button>
      {open && <div className="px-4 pb-4 text-sm border-t border-gray-100">{children}</div>}
    </div>
  );
}

export function PacketReviewModal({
  caseId,
  latestCompileJobId,
  open,
  onClose,
  onReviewComplete,
  packetVersion,
  savedReportJobId,
}: PacketReviewModalProps) {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [view, setView] = useState<ModalView>('setup');

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (savedReportJobId && token) {
      setView('running');
      setLoading(true);
      api.packetReview
        .getSavedReport(caseId, savedReportJobId, token)
        .then((result) => {
          setReport(result.report);
          setView('report');
        })
        .catch(() => {
          setView('setup');
        })
        .finally(() => setLoading(false));
    } else {
      setView('setup');
      setReport(null);
    }
  }, [open, savedReportJobId, caseId, token]);

  if (!open) return null;

  const handleRunReview = async () => {
    if (!token || !latestCompileJobId) return;
    setView('running');
    setLoading(true);
    setError(null);
    try {
      const result = await api.packetReview.run(caseId, latestCompileJobId, token);
      setReport(result.report);
      onReviewComplete?.();
      setView('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Packet review failed');
      setView('setup');
    } finally {
      setLoading(false);
    }
  };

  const riskLevel: RiskLevel = report?.executiveConclusion?.riskLevel ?? 'medium_risk';
  const riskCfg = RISK_CONFIG[riskLevel];
  const RiskIcon = riskCfg.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold">Final Audit Report</h2>
            <p className="text-xs text-gray-500">Packet-level risk assessment — not a legal determination</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* SETUP view */}
          {view === 'setup' && (
            <div className="space-y-6">
              <div className="text-center py-8 space-y-4">
                <FileWarning className="mx-auto h-12 w-12 text-gray-300" />
                <div>
                  <p className="font-medium text-lg">Run a Final Audit</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    Evaluates your compiled officer packet for structure, evidence quality,
                    criterion coverage, and missing items.
                  </p>
                </div>
                {!latestCompileJobId && (
                  <p className="text-sm text-orange-600">
                    No completed compile found. Compile your packet first.
                  </p>
                )}
                {latestCompileJobId && packetVersion && (
                  <p className="text-sm text-gray-600">
                    Auditing: <strong>Compiled Packet Version {packetVersion}</strong>
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleRunReview}
                  disabled={!latestCompileJobId || loading}
                >
                  Run Audit
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* RUNNING view */}
          {view === 'running' && (
            <div className="text-center py-16 space-y-4">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <div>
                <p className="font-medium">{savedReportJobId ? 'Loading saved audit report...' : 'Running Final Audit...'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Analyzing packet structure, evidence quality, and legal references.
                </p>
              </div>
            </div>
          )}

          {/* REPORT view */}
          {view === 'report' && report && (
            <ReportContent
              report={report}
              riskCfg={riskCfg}
              RiskIcon={RiskIcon}
              riskLevel={riskLevel}
              packetVersion={packetVersion ?? report.packetVersion}
              loading={loading}
              handleRunReview={handleRunReview}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReportContent({
  report,
  riskCfg,
  RiskIcon,
  riskLevel,
  packetVersion,
  loading,
  handleRunReview,
  onClose,
}: {
  report: any;
  riskCfg: (typeof RISK_CONFIG)[RiskLevel];
  RiskIcon: typeof ShieldCheck;
  riskLevel: RiskLevel;
  packetVersion?: number;
  loading: boolean;
  handleRunReview: () => void;
  onClose: () => void;
}) {
  const thresholdCount = report.thresholdDeficiencies?.length ?? 0;
  const criticalThresholds = (report.thresholdDeficiencies ?? []).filter((t: any) => t.impact === 'critical').length;
  const filingMissing = (report.filingCompleteness ?? []).filter((f: any) => f.status === 'missing').length;
  const requiredAdditions = (report.requiredAdditions ?? []).filter((a: any) => a.group === 'required');
  const strengtheningAdditions = (report.requiredAdditions ?? []).filter((a: any) => a.group === 'strengthening');

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <div className={`rounded-lg border ${riskCfg.border} ${riskCfg.bg} p-5`}>
        <div className="flex items-start gap-4">
          <RiskIcon className={`h-10 w-10 ${riskCfg.color} shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-xl font-bold ${riskCfg.color}`}>{riskCfg.label}</span>
              {packetVersion && (
                <span className="text-xs bg-white/60 rounded-full px-2.5 py-1 text-gray-600">
                  Packet Version {packetVersion}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(report.generatedAt || Date.now()).toLocaleDateString(undefined, {
                  month: 'long', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {report.packetSource && <span>{report.packetSource}</span>}
              {report.usedAI && <span>Model: {report.modelUsed ?? 'AI'}</span>}
              {!report.usedAI && <span>Deterministic review only</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Executive Conclusion */}
      <div className="space-y-2">
        <h3 className="font-bold text-base">Executive Conclusion</h3>
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
          <p>{report.executiveConclusion?.summary}</p>
          {report.executiveConclusion?.structuralVerdict && (
            <p className="font-medium text-gray-800 mt-2 text-xs border-l-2 border-gray-300 pl-3">
              {report.executiveConclusion.structuralVerdict}
            </p>
          )}
        </div>
      </div>

      {/* 3. Threshold Deficiencies */}
      <Section
        title="3. Threshold Deficiencies"
        defaultOpen={thresholdCount > 0}
        badge={thresholdCount > 0 ? `${criticalThresholds} critical` : 'None'}
        badgeColor={criticalThresholds > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
      >
        {thresholdCount === 0 ? (
          <p className="text-gray-500 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            No threshold deficiencies detected.
          </p>
        ) : (
          <div className="space-y-3 mt-3">
            {(report.thresholdDeficiencies ?? []).map((td: any, i: number) => {
              const impactColor = td.impact === 'critical'
                ? 'border-red-200 bg-red-50/50'
                : td.impact === 'material'
                  ? 'border-orange-200 bg-orange-50/50'
                  : 'border-yellow-200 bg-yellow-50/50';
              const impactTextColor = td.impact === 'critical' ? 'text-red-700' : td.impact === 'material' ? 'text-orange-700' : 'text-yellow-700';
              return (
                <div key={i} className={`rounded-lg border p-3 ${impactColor}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${impactTextColor}`} />
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${impactTextColor}`}>{td.issue}</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wide rounded px-1.5 py-0.5 ${impactTextColor} opacity-70`}>
                          {td.impact}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">{td.whyItMatters}</p>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Expected:</span> {td.expectedPacketItem}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 4. Filing Completeness / Mandatory Packet Components */}
      <Section
        title="4. Filing Completeness"
        defaultOpen={filingMissing > 0}
        badge={filingMissing > 0 ? `${filingMissing} missing` : 'Complete'}
        badgeColor={filingMissing > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
      >
        <div className="mt-3 space-y-1.5">
          {(report.filingCompleteness ?? []).map((item: any, i: number) => {
            const statusCfg = FILING_STATUS_STYLES[item.status] ?? FILING_STATUS_STYLES.missing;
            const StatusIcon = statusCfg.icon;
            return (
              <div key={i} className="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-gray-50">
                <StatusIcon className={`h-4 w-4 shrink-0 ${statusCfg.color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">{item.component}</span>
                  {item.detail && (
                    <span className="text-xs text-gray-500 ml-2">— {item.detail}</span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${statusCfg.color}`}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 5. Criterion Coverage Assessment */}
      <Section
        title="5. Criterion Coverage Assessment"
        badge={report.criterionCoverage?.length ?? 0}
        defaultOpen
      >
        {(report.criterionCoverage ?? []).length === 0 ? (
          <p className="text-gray-600 mt-2">
            Criterion coverage could not be meaningfully assessed because the packet lacks mapped criterion evidence.
            Add evidence documents mapped to specific criteria in the Submission Checklist before re-running the audit.
          </p>
        ) : (
          <div className="space-y-3 mt-2">
            {(report.criterionCoverage ?? []).map((c: any) => {
              const style = SUPPORT_LEVEL_STYLES[c.supportLevel] ?? SUPPORT_LEVEL_STYLES.missing;
              const statusLabel = c.supportLevel === 'not_assessable'
                ? 'Not Assessable'
                : c.supportLevel === 'not_claimed'
                  ? 'Not Claimed'
                  : c.supportLevel;
              return (
                <div key={c.criterionId} className="rounded border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>
                      {statusLabel}
                    </span>
                    <span className="font-medium text-sm">{c.criterionId} — {c.criterionLabel}</span>
                  </div>
                  {c.whyThisRating && (
                    <p className="text-xs text-gray-600 mt-1">{c.whyThisRating}</p>
                  )}
                  {c.exhibitCount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {c.exhibitCount} exhibit{c.exhibitCount !== 1 ? 's' : ''} ({c.primaryCount} primary, {c.supportingCount} supporting)
                      {c.reviewedCount > 0 && ` · ${c.reviewedCount} reviewed`}
                    </p>
                  )}
                  {c.supportPresent?.length > 0 && (
                    <div className="mt-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600">Support present:</span>
                      <ul className="mt-0.5 space-y-0.5 text-xs text-gray-600">
                        {c.supportPresent.map((s: string, si: number) => (
                          <li key={si} className="flex items-start gap-1.5">
                            <span className="text-green-400 shrink-0">+</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.supportMissing?.length > 0 && (
                    <div className="mt-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600">Support missing:</span>
                      <ul className="mt-0.5 space-y-0.5 text-xs text-gray-600">
                        {c.supportMissing.map((s: string, si: number) => (
                          <li key={si} className="flex items-start gap-1.5">
                            <span className="text-red-400 shrink-0">−</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.findings?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-700">
                      {c.findings.map((f: string, fi: number) => (
                        <li key={fi} className="flex items-start gap-1.5">
                          <span className="text-gray-400 shrink-0">—</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 6. Final Merits Assessment */}
      <Section title="6. Final Merits Assessment" defaultOpen>
        {report.finalMeritsAssessment ? (
          <div className="space-y-3 mt-2">
            {([
              ['sustainedAcclaim', 'Sustained Acclaim'],
              ['topOfFieldSignaling', 'Top-of-Field Positioning'],
              ['futureWorkContinuity', 'Future Work Continuity'],
              ['evidentiaryCoherence', 'Evidentiary Coherence'],
            ] as const).map(([key, label]) => (
              <div key={key} className="rounded border p-3">
                <div className="font-medium text-xs text-gray-800">{label}</div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {report.finalMeritsAssessment[key] || 'Not assessed.'}
                </p>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 mt-2">Not assessed.</p>}
      </Section>

      {/* 7. Evidence Quality and Weight */}
      <Section
        title="7. Evidence Quality and Weight"
        badge={report.evidenceQualityIssues?.length ?? 0}
      >
        {(report.evidenceQualityIssues ?? []).length === 0 ? (
          <p className="text-gray-500 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> No evidence quality issues detected.
          </p>
        ) : (
          <ul className="space-y-2 mt-2">
            {(report.evidenceQualityIssues ?? []).map((issue: any, i: number) => {
              const Icon = issue.severity === 'error' ? ShieldX : issue.severity === 'warning' ? AlertTriangle : Info;
              const color = issue.severity === 'error' ? 'text-red-600' : issue.severity === 'warning' ? 'text-yellow-600' : 'text-blue-500';
              return (
                <li key={i} className="flex items-start gap-2 text-xs rounded border p-2">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 ${color} shrink-0`} />
                  <div>
                    <span className="font-medium text-gray-800">{issue.documentTitle}</span>
                    {issue.exhibitCode && <span className="text-gray-400 ml-1">({issue.exhibitCode})</span>}
                    <p className="text-gray-600 mt-0.5">{issue.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 8. Packet Structure / Exhibit Problems */}
      <Section
        title="8. Packet Structure / Exhibit Problems"
        badge={report.packetArchitectureIssues?.length ?? 0}
      >
        {(report.packetArchitectureIssues ?? []).length === 0 ? (
          <p className="text-gray-500 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> No structural issues detected.
          </p>
        ) : (
          <ul className="space-y-2 mt-2">
            {(report.packetArchitectureIssues ?? []).map((issue: any, i: number) => {
              const Icon = issue.severity === 'error' ? ShieldX : issue.severity === 'warning' ? AlertTriangle : Info;
              const color = issue.severity === 'error' ? 'text-red-600' : issue.severity === 'warning' ? 'text-yellow-600' : 'text-blue-500';
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 ${color} shrink-0`} />
                  <span className="text-gray-700">{issue.description}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 9. Required Additions / Corrections */}
      <Section
        title="9. Required Additions / Corrections"
        badge={(report.requiredAdditions?.length ?? 0) || (report.missingItems?.length ?? 0)}
        defaultOpen={requiredAdditions.length > 0}
      >
        <div className="mt-2 space-y-4">
          {/* A. Required before meaningful reliance */}
          <div>
            <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
              A. Required before meaningful reliance
            </h4>
            {requiredAdditions.length === 0 ? (
              <p className="text-xs text-gray-500 pl-2">No mandatory additions identified.</p>
            ) : (
              <div className="space-y-1.5">
                {requiredAdditions.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs rounded border border-red-100 bg-red-50/30 p-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-gray-800">{item.description}</span>
                      <span className="text-gray-400 ml-1">→ Section {item.expectedSection}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B. Strengthening actions */}
          <div>
            <h4 className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-2">
              B. Strengthening actions
            </h4>
            {strengtheningAdditions.length === 0 ? (
              <p className="text-xs text-gray-500 pl-2">No strengthening actions identified.</p>
            ) : (
              <div className="space-y-1.5">
                {strengtheningAdditions.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs rounded border border-yellow-100 bg-yellow-50/30 p-2">
                    <Info className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-gray-800">{item.description}</span>
                      <span className="text-gray-400 ml-1">→ Section {item.expectedSection}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legacy missing items fallback */}
          {(!report.requiredAdditions || report.requiredAdditions.length === 0) && (report.missingItems?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              {(report.missingItems ?? []).map((item: any, i: number) => {
                const prColor = item.priority === 'high' ? 'text-red-700 bg-red-50 border-red-200'
                  : item.priority === 'medium' ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                  : 'text-gray-600 bg-gray-50 border-gray-200';
                return (
                  <div key={i} className="flex items-start gap-2 text-xs rounded border p-2">
                    <span className={`rounded border px-1.5 py-0.5 font-semibold shrink-0 ${prColor}`}>
                      {item.priority}
                    </span>
                    <div>
                      <span className="text-gray-800">{item.description}</span>
                      <span className="text-gray-400 ml-1">
                        → Section {item.expectedSection} · {item.action}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* 10. Priority Fixes */}
      <Section
        title="10. Priority Fixes"
        badge={report.priorityFixes?.length ?? 0}
        defaultOpen
      >
        {(report.priorityFixes ?? []).length === 0 ? (
          <p className="text-gray-500 mt-2">No priority fixes identified.</p>
        ) : (
          <ol className="space-y-3 mt-2">
            {(report.priorityFixes ?? []).map((fix: any) => (
              <li key={fix.rank} className="flex items-start gap-3 text-xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {fix.rank}
                </span>
                <div>
                  <div className="font-medium text-gray-800">{fix.action || fix.description}</div>
                  {(fix.whyItMatters || fix.impact) && (
                    <div className="text-gray-500 mt-0.5">{fix.whyItMatters || fix.impact}</div>
                  )}
                  {fix.expectedEffect && (
                    <div className="text-gray-400 mt-0.5 italic">{fix.expectedEffect}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* 11. Source Basis (collapsed by default) */}
      <Section title="11. Source Basis" badge={report.sourceBasis?.length ?? 0}>
        {(report.sourceBasis ?? []).length === 0 ? (
          <p className="text-gray-500 mt-2">No sources recorded.</p>
        ) : (
          <ul className="space-y-1 mt-2">
            {(report.sourceBasis ?? []).map((s: any, i: number) => (
              <li key={i} className="text-[11px] text-gray-500">
                <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 mr-1">
                  {s.kind}
                </span>
                <span className="text-gray-600">{s.source}</span>
                {s.excerpt && <span className="text-gray-400 ml-1">— {s.excerpt.slice(0, 80)}…</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t">
        <Button variant="secondary" size="sm" onClick={handleRunReview} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Re-run on this packet
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
