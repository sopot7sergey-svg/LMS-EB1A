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
      const msg = err?.message ?? 'Запрос не выполнен';
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
      <h1 className="text-3xl font-bold">Тарифы</h1>
      <p className="mt-2 text-foreground-secondary">
        Планы доступа к приложению. Доступ к курсу — пожизненный после покупки.
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
                {plan.price != null ? `$${plan.price}/мес` : plan.note ?? 'Включено'}
              </div>
              {plan.priceAnnual != null && (
                <p className="text-sm text-foreground-secondary">
                  Годовой: ${plan.priceAnnual}/год (${Math.round(plan.priceAnnual / 12)}/мес)
                </p>
              )}
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  макс. {plan.maxCases} {plan.maxCases === 1 ? 'дело' : plan.maxCases >= 2 && plan.maxCases <= 4 ? 'дела' : 'дел'}
                </li>
                <li className="flex items-center gap-2">
                  {plan.uploadEnabled ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  Загрузка документов {plan.uploadEnabled ? 'включена' : 'отключена'}
                </li>
              </ul>
              {plan.note && (
                <p className="text-xs text-foreground-muted">{plan.note}</p>
              )}

              {/* Start: info only */}
              {plan.id === 'start' && (
                <p className="text-sm text-foreground-muted">Предоставляется автоматически после покупки курса.</p>
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
                          .catch((e) => alert(e?.message ?? 'Ошибка'))
                          .finally(() => setLoadingAction(null));
                      }}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Управление'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => handleCheckout('pro', 'monthly')}
                        disabled={!!loadingAction}
                      >
                        {loadingAction === 'pro-monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Подписка помесячно'}
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-[44px] w-full"
                        onClick={() => handleCheckout('pro', 'annual')}
                        disabled={!!loadingAction}
                      >
                        {loadingAction === 'pro-annual' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Подписка годовая'}
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
                    Только по одобрению администратора.
                  </div>
                  {data?.ultraEligibilityRequest?.status === 'pending' && (
                    <p className="text-sm text-foreground-secondary">Запрос на рассмотрении.</p>
                  )}
                  {data?.ultraEligibilityRequest?.status === 'approved' && (
                    <p className="text-sm text-success">У вас есть доступ Ultra.</p>
                  )}
                  {data?.ultraEligibilityRequest?.status === 'rejected' && (
                    <p className="text-sm text-foreground-muted">Предыдущий запрос отклонён.</p>
                  )}
                  {(!data?.ultraEligibilityRequest || data.ultraEligibilityRequest.status !== 'pending') &&
                    data?.currentPlan !== 'ultra' && (
                    <Button
                      variant="secondary"
                      className="min-h-[44px] w-full"
                      onClick={handleRequestUltra}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === 'ultra-request' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Запросить Ultra'}
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
