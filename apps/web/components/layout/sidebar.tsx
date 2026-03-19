'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  Home,
  BookOpen,
  FileText,
  MessageSquare,
  Settings,
  Users,
  Video,
  Shield,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  progress?: { completed: number; total: number };
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ progress, open = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, clearAuth, isAdmin } = useAuthStore();

  const studentLinks = [
    { href: '/dashboard', label: 'Панель', icon: Home },
    { href: '/case', label: 'Мой кейс', icon: FileText },
    { href: '/modules', label: 'Курс', icon: BookOpen },
    { href: '/chat', label: 'Чат с поддержкой', icon: MessageSquare },
    { href: '/account', label: 'Аккаунт', icon: Settings },
  ];

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/ultra-requests', label: 'Ultra Requests', icon: Shield },
    { href: '/admin/modules', label: 'Modules', icon: BookOpen },
    { href: '/admin/lessons', label: 'Lessons', icon: Video },
    { href: '/admin/chat', label: 'Student Chat', icon: MessageSquare },
  ];

  const links = isAdmin() ? adminLinks : studentLinks;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-background-secondary transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <span className="text-lg font-semibold">Aipas</span>
        </div>

        {!isAdmin() && progress && (
          <div className="border-b border-border p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-foreground-secondary">Прогресс курса</span>
              <span className="font-medium">
                {progress.completed}/{progress.total}
              </span>
            </div>
            <ProgressBar
              value={progress.completed}
              max={progress.total}
              size="sm"
            />
          </div>
        )}

        <nav className="flex-1 space-y-1 p-4">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors lg:py-2',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {link.label}
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href={isAdmin() ? '/admin/dashboard' : '/account'}
            onClick={onClose}
            className="mb-4 flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-background-tertiary lg:py-1"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-foreground-muted">{user?.email}</p>
            </div>
          </Link>
          <button
            onClick={() => {
              clearAuth();
              window.location.href = '/login';
            }}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground lg:py-2"
          >
            <LogOut className="h-5 w-5" />
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
