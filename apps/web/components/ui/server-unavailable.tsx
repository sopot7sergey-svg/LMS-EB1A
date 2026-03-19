'use client';

import Link from 'next/link';
import { Button } from './button';

export function ServerUnavailable() {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-lg border border-warning/30 bg-warning/10 p-8 text-center">
      <p className="font-medium text-warning">Сервер недоступен</p>
      <p className="text-sm text-foreground-secondary">
        API-сервер может быть не запущен. Из корня проекта выполните: <code className="rounded bg-background-tertiary px-1">npm run dev:all</code>
      </p>
      <Link href="/">
        <Button variant="secondary">На главную</Button>
      </Link>
    </div>
  );
}
