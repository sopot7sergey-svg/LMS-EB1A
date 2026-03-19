'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { ServerUnavailable } from '@/components/ui/server-unavailable';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  // Fallback: never stay on "Loading..." forever (e.g. if useEffect is delayed)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [ready, isAuthenticated, router]);

  // Server availability check using /api/health (not root /)
  useEffect(() => {
    if (!ready) return;
    api.health()
      .then(() => setApiReachable(true))
      .catch(() => setApiReachable(false));
  }, [ready]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();
      const { user, token } = await api.auth.login(email, password, deviceId);
      setAuth(user, token);
      router.push(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: '#0a0a0f', color: '#a1a1aa' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
          />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  if (apiReachable === false) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background px-4"
        style={{ backgroundColor: '#0a0a0f' }}
      >
        <ServerUnavailable />
      </div>
    );
  }

  if (isAuthenticated()) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: '#0a0a0f', color: '#a1a1aa' }}
      >
        Перенаправление...
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary" />
            <span className="text-2xl font-bold">Aipas</span>
          </Link>
        </div>

        <div className="card">
          <h1 className="mb-6 text-2xl font-bold">Вход</h1>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Эл. почта"
              placeholder="example@mail.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="password"
              type="password"
              label="Пароль"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Войти
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-foreground-secondary">
            Нет аккаунта?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Регистрация
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-foreground-muted">
          Платформа не предоставляет юридические консультации и не предсказывает исход дел.
        </p>
      </div>
    </div>
  );
}
