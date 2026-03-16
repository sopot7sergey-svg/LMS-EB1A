'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { cn } from '@/lib/utils';
import { User, BookOpen, FileText, CreditCard, Layers } from 'lucide-react';

const links = [
  { href: '/account', label: 'Profile', icon: User },
  { href: '/account/billing', label: 'Billing & Subscription', icon: CreditCard },
  { href: '/account/plans', label: 'Plans', icon: Layers },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <nav className="w-full shrink-0 space-y-1 lg:w-56">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/account' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors lg:py-2',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </DashboardLayout>
  );
}
