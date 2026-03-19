'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export default function BillingPage() {
  const { token } = useAuthStore();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [mounted, setMounted] = useState(false);

  const refresh = () => {
    if (!token) return;
    setIsLoading(true);
    Promise.all([
      api.billing.status(token),
      api.account.usage(token).catch(() => null),
    ])
      .then(([s, u]) => {
        setStatus(s);
        setUsage(u);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      router.push('/login');
      setIsLoading(false);
      return;
    }
    Promise.all([
      api.billing.status(token),
      api.account.usage(token).catch(() => null),
    ])
      .then(([s, u]) => {
        setStatus(s);
        setUsage(u);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [mounted, token, router]);

  const handleManageBilling = () => {
    if (!token) return;
    setLoadingAction('portal');
    api.billing.portal(token)
      .then((r) => { if (r.url) window.location.href = r.url; })
      .catch((e) => alert(e?.message ?? 'Ошибка'))
      .finally(() => setLoadingAction(null));
  };

  const handleCancelConfirm = async () => {
    if (!token) return;
    setLoadingAction('cancel');
    try {
      await api.billing.cancel({ reason: cancelReason || undefined, atPeriodEnd: cancelAtPeriodEnd }, token);
      setCancelDialogOpen(false);
      setCancelReason('');
      refresh();
    } catch (e: any) {
      alert(e?.message ?? 'Cancel failed');
    } finally {
      setLoadingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex h-64 items-center justify-center gap-3"
        style={{ color: '#a1a1aa' }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
        />
        <span>Loading billing...</span>
      </div>
    );
  }

  const hasProviderSubscription = status?.subscriptions?.some((s: any) => s.externalSubscriptionId);
  const canManage = status?.planStatus === 'active' && hasProviderSubscription;

  return (
    <div>
      <h1 className="text-3xl font-bold">Billing & Subscription</h1>
      <p className="mt-2 text-foreground-secondary">
        Your app plan and access status.
      </p>

      <Card className="mt-8 max-w-xl">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Plan</span>
            <span className="font-medium capitalize">{status?.plan ?? 'none'}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Status</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                status?.planStatus === 'active'
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              }`}
            >
              {status?.planStatus ?? 'expired'}
            </span>
          </div>
          {status?.expiresAt && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground-secondary">
                {status?.cancelAtPeriodEnd ? 'Access until' : 'Renews'}
              </span>
              <span>{new Date(status.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
          {status?.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Subscription will cancel at period end.
            </div>
          )}
          {status?.billingCycle && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground-secondary">Billing cycle</span>
              <span className="capitalize">{status.billingCycle}</span>
            </div>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Cases</span>
            <span>
              {status?.caseCount ?? 0} / {status?.maxCases ?? 0}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Document upload</span>
            <span>{status?.uploadEnabled ? <Check className="h-5 w-5 text-success" /> : 'Disabled'}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>AI Usage</CardTitle>
          <p className="text-sm text-foreground-secondary">
            {usage ? (
              <>Period: {usage.periodStart ? new Date(usage.periodStart).toLocaleDateString() : '—'} to {usage.periodEnd ? new Date(usage.periodEnd).toLocaleDateString() : '—'}</>
            ) : (
              <>Unable to load usage. <button type="button" onClick={refresh} className="underline hover:no-underline">Refresh</button></>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Advisor Chat</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.advisorChatCalls ?? 0} / ${usage.limits?.advisorChatCallLimit ?? '—'}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Document Review</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.documentReviewCalls ?? 0} / ${usage.limits?.documentReviewLimit ?? '—'}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Final Audit</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.finalAuditCalls ?? 0} / ${usage.limits?.finalAuditLimit ?? '—'}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Cover Letter</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.coverLetterGenerates ?? 0} / ${usage.limits?.coverLetterGenerateLimit ?? '—'}` : '—'}
            </span>
          </div>
          {usage?.nearOrAtLimit && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {usage.blocked
                ? 'You have reached your AI usage limits. Limits reset at the start of next month.'
                : 'You are approaching your AI usage limits.'}
            </div>
          )}
        </CardContent>
      </Card>

      {status?.planStatus !== 'active' && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">App access expired</p>
            <p className="text-sm">
              Your app plan has expired. Renew your plan to access My Case and continue building your petition.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {canManage && (
          <Button
            variant="secondary"
            className="min-h-[44px]"
            onClick={handleManageBilling}
            disabled={!!loadingAction}
          >
            {loadingAction === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage Billing'}
          </Button>
        )}
        {canManage && !status?.cancelAtPeriodEnd && (
          <Button
            variant="danger"
            onClick={() => setCancelDialogOpen(true)}
            disabled={!!loadingAction}
            className="min-h-[44px]"
          >
            Cancel Subscription
          </Button>
        )}
        <Link href="/account/plans">
          <Button variant="secondary" className="min-h-[44px]">
            {canManage ? 'Change Plan' : 'View Plans'}
          </Button>
        </Link>
      </div>

      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Cancel Subscription"
      >
        <div className="space-y-4 p-6">
          <p className="text-foreground-secondary">
            Are you sure you want to cancel? You can cancel at period end (keep access until renewal) or cancel immediately.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="atPeriodEnd"
              checked={cancelAtPeriodEnd}
              onChange={() => setCancelAtPeriodEnd(true)}
            />
            <label htmlFor="atPeriodEnd">Cancel at period end (recommended)</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="immediate"
              checked={!cancelAtPeriodEnd}
              onChange={() => setCancelAtPeriodEnd(false)}
            />
            <label htmlFor="immediate">Cancel immediately</label>
          </div>
          <Input
            label="Reason (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Help us improve"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelDialogOpen(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelConfirm}
              disabled={!!loadingAction}
            >
              {loadingAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
