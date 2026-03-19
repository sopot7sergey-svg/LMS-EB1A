'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Check } from 'lucide-react';

export default function AccountProfilePage() {
  const { token, user, setAuth } = useAuthStore();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      router.push('/login');
      return;
    }
    // Fetch user if we have token but no user (e.g. after refresh)
    if (token && !user) {
      api.auth.me(token).then((u) => setAuth(u, token)).catch(() => router.push('/login'));
    }
  }, [mounted, token, user, setAuth, router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Пароль должен содержать минимум 8 символов' });
      return;
    }
    setIsLoading(true);
    try {
      await api.account.changePassword(currentPassword, newPassword, token!);
      setMessage({ type: 'success', text: 'Пароль успешно обновлён' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Не удалось изменить пароль' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted || (!user && token)) {
    return (
      <div className="flex items-center gap-3" style={{ color: '#a1a1aa' }}>
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
        />
        Загрузка профиля...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
        <p className="font-medium">Не удалось загрузить профиль</p>
        <p className="mt-1 text-sm">
          Сессия могла истечь. <Link href="/login" className="underline">Войдите снова</Link>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Аккаунт</h1>
      <p className="mt-2 text-foreground-secondary">
        Управление профилем и безопасностью.
      </p>

      <Card className="mt-8 max-w-xl">
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground-secondary">Email</label>
            <p className="mt-1 text-foreground">{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground-secondary">Имя</label>
            <p className="mt-1 text-foreground">{user.name}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>Смена пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              type="password"
              label="Текущий пароль"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Новый пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              type="password"
              label="Подтвердите новый пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {message && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                }`}
              >
                {message.text}
              </div>
            )}
            <Button type="submit" isLoading={isLoading} className="min-h-[44px]">
              Обновить пароль
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/account/billing">
          <Button variant="secondary" className="min-h-[44px]">Оплата и подписка</Button>
        </Link>
        <Link href="/account/plans">
          <Button variant="secondary" className="min-h-[44px]">Тарифы</Button>
        </Link>
      </div>
    </div>
  );
}
