'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export default function PlansPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<{
    plans: any[];
    currentPlan?: string;
    planStatus?: string;
    proActive?: boolean;
    ultraEligibilityRequest?: { status: string; requestedAt: string } | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const refresh = () => {
    if (!token) return;
    api.plans.list(token)
      .then((res: any) => setData({
        plans: res.plans ?? [],
        currentPlan: res.currentPlan,
        planStatus: res.planStatus,
        proActive: res.proActive,
        ultraEligibilityRequest: res.ultraEligibilityRequest,
      }))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.plans.list(token)
      .then((res: any) => setData({
        plans: res.plans ?? [],
        currentPlan: res.currentPlan,
        planStatus: res.planStatus,
        proActive: res.proActive,
        ultraEligibilityRequest: res.ultraEligibilityRequest,
      }))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleCheckout = async (plan: string, billingCycle: 'monthly' | 'annual') => {
    if (!token) return;
    setLoadingAction(`${plan}-${billingCycle}`);
    try {
      const res = await api.billing.checkout(plan as 'pro' | 'ultra', billingCycle, token);
      if (res.url) window.location.href = res.url;
    } catch (err: any) {
      alert(err?.message ?? 'Ошибка оформления');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRequestUltra = async () => {
    if (!token) return;
    setLoadingAction('ultra-request');
    try {
      await api.account.requestUltra(token);
      await refresh();
    } catch (err: any) {
      const msg = err?.message ?? 'Request failed';
      if (msg.includes('already have a pending')) {
        await refresh();
        return;
      }
      alert(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Plans</h1>
      <p className="mt-2 text-foreground-secondary">
        App access plans. Course access is lifetime after purchase.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {data?.plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="capitalize">{plan.name}</CardTitle>
              <p className="text-sm text-foreground-secondary">{plan.description}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="text-2xl font-bold">
                {plan.price != null ? `$${plan.price}/mo` : plan.note ?? 'Included'}
              </div>
              {plan.priceAnnual != null && (
                <p className="text-sm text-foreground-secondary">
                  Annual: ${plan.priceAnnual}/yr (${Math.round(plan.priceAnnual / 12)}/mo)
                </p>
              )}
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  {plan.maxCases} case{plan.maxCases !== 1 ? 's' : ''} max
                </li>
                <li className="flex items-center gap-2">
                  {plan.uploadEnabled ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  Document upload {plan.uploadEnabled ? 'enabled' : 'disabled'}
                </li>
              </ul>
              {plan.note && (
                <p className="text-xs text-foreground-muted">{plan.note}</p>
              )}

              {/* Start: info only */}
              {plan.id === 'start' && (
                <p className="text-sm text-foreground-muted">Granted automatically after course purchase.</p>
              )}

              {/* Pro: Subscribe Monthly/Annual or Manage if active */}
              {plan.id === 'pro' && (
                <div className="space-y-2">
                  {data.proActive ? (
                    <Button
                      variant="secondary"
                      className="min-h-[44px] w-full"
                      onClick={() => {
                        if (!token) return;
                        setLoadingAction('portal');
                        api.billing.portal(token)
                          .then((r) => { if (r.url) window.location.href = r.url; })
                          .catch((e) => alert(e?.message ?? 'Failed'))
                          .finally(() => setLoadingAction(null));
                      }}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => handleCheckout('pro', 'monthly')}
                        disabled={!!loadingAction}
                      >
                        {loadingAction === 'pro-monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe Monthly'}
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-[44px] w-full"
                        onClick={() => handleCheckout('pro', 'annual')}
                        disabled={!!loadingAction}
                      >
                        {loadingAction === 'pro-annual' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe Annual'}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Ultra: Request Ultra (not buy) */}
              {plan.id === 'ultra' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    By admin approval only.
                  </div>
                  {data?.ultraEligibilityRequest?.status === 'pending' && (
                    <p className="text-sm text-foreground-secondary">Request pending review.</p>
                  )}
                  {data?.ultraEligibilityRequest?.status === 'approved' && (
                    <p className="text-sm text-success">You have Ultra access.</p>
                  )}
                  {data?.ultraEligibilityRequest?.status === 'rejected' && (
                    <p className="text-sm text-foreground-muted">Previous request was rejected.</p>
                  )}
                  {(!data?.ultraEligibilityRequest || data.ultraEligibilityRequest.status !== 'pending') &&
                    data?.currentPlan !== 'ultra' && (
                    <Button
                      variant="secondary"
                      className="min-h-[44px] w-full"
                      onClick={handleRequestUltra}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === 'ultra-request' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request Ultra'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
