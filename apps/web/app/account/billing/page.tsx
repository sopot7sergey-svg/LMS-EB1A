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
      alert(e?.message ?? 'Не удалось отменить подписку');
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
        <span>Загрузка данных об оплате...</span>
      </div>
    );
  }

  const hasProviderSubscription = status?.subscriptions?.some((s: any) => s.externalSubscriptionId);
  const canManage = status?.planStatus === 'active' && hasProviderSubscription;

  return (
    <div>
      <h1 className="text-3xl font-bold">Оплата и подписка</h1>
      <p className="mt-2 text-foreground-secondary">
        Ваш план и статус доступа.
      </p>

      <Card className="mt-8 max-w-xl">
        <CardHeader>
          <CardTitle>Текущий план</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">План</span>
            <span className="font-medium capitalize">{status?.plan ?? 'none'}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Статус</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                status?.planStatus === 'active'
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              }`}
            >
              {status?.planStatus === 'active' ? 'активен' : status?.planStatus === 'expired' ? 'истёк' : status?.planStatus === 'canceled' ? 'отменён' : (status?.planStatus ?? 'истёк')}
            </span>
          </div>
          {status?.expiresAt && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground-secondary">
                {status?.cancelAtPeriodEnd ? 'Доступ до' : 'Продление'}
              </span>
              <span>{new Date(status.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
          {status?.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Подписка будет отменена в конце периода.
            </div>
          )}
          {status?.billingCycle && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground-secondary">Период оплаты</span>
              <span>{status.billingCycle === 'monthly' ? 'месячная' : status.billingCycle === 'annual' ? 'годовая' : status.billingCycle}</span>
            </div>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Дела</span>
            <span>
              {status?.caseCount ?? 0} / {status?.maxCases ?? 0}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Загрузка документов</span>
            <span>{status?.uploadEnabled ? <Check className="h-5 w-5 text-success" /> : 'Отключена'}</span>
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
            <span className="text-foreground-secondary">Чат с советником</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.advisorChatCalls ?? 0} / ${usage.limits?.advisorChatCallLimit ?? '—'}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Проверка документов</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.documentReviewCalls ?? 0} / ${usage.limits?.documentReviewLimit ?? '—'}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Финальная проверка</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.finalAuditCalls ?? 0} / ${usage.limits?.finalAuditLimit ?? '—'}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-foreground-secondary">Сопроводительное письмо</span>
            <span className={usage?.blocked ? 'text-error font-medium' : ''}>
              {usage ? `${usage.coverLetterGenerates ?? 0} / ${usage.limits?.coverLetterGenerateLimit ?? '—'}` : '—'}
            </span>
          </div>
          {usage?.nearOrAtLimit && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {usage.blocked
                ? 'Достигнут лимит использования ИИ. Лимиты обновляются в начале следующего месяца.'
                : 'Приближаетесь к лимиту использования ИИ.'}
            </div>
          )}
        </CardContent>
      </Card>

      {status?.planStatus !== 'active' && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Доступ к приложению истёк</p>
            <p className="text-sm">
              Ваш план истёк. Продлите подписку для доступа к My Case и продолжения работы над петицией.
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
            {loadingAction === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Управление оплатой'}
          </Button>
        )}
        {canManage && !status?.cancelAtPeriodEnd && (
          <Button
            variant="danger"
            onClick={() => setCancelDialogOpen(true)}
            disabled={!!loadingAction}
            className="min-h-[44px]"
          >
            Отменить подписку
          </Button>
        )}
        <Link href="/account/plans">
          <Button variant="secondary" className="min-h-[44px]">
            {canManage ? 'Сменить план' : 'Тарифы'}
          </Button>
        </Link>
      </div>

      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Отмена подписки"
      >
        <div className="space-y-4 p-6">
          <p className="text-foreground-secondary">
            Вы уверены, что хотите отменить? Можно отменить в конце периода (доступ сохранится до продления) или немедленно.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="atPeriodEnd"
              checked={cancelAtPeriodEnd}
              onChange={() => setCancelAtPeriodEnd(true)}
            />
            <label htmlFor="atPeriodEnd">Отменить в конце периода (рекомендуется)</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="immediate"
              checked={!cancelAtPeriodEnd}
              onChange={() => setCancelAtPeriodEnd(false)}
            />
            <label htmlFor="immediate">Отменить немедленно</label>
          </div>
          <Input
            label="Причина (необязательно)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Помогите нам стать лучше"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelDialogOpen(false)}>
              Оставить подписку
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelConfirm}
              disabled={!!loadingAction}
            >
              {loadingAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Подтвердить отмену'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
