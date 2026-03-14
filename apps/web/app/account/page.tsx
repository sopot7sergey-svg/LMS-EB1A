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
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    setIsLoading(true);
    try {
      await api.account.changePassword(currentPassword, newPassword, token!);
      setMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to change password' });
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
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
        <p className="font-medium">Unable to load profile</p>
        <p className="mt-1 text-sm">
          Your session may have expired. <Link href="/login" className="underline">Sign in again</Link>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Account</h1>
      <p className="mt-2 text-foreground-secondary">
        Manage your profile and security.
      </p>

      <Card className="mt-8 max-w-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground-secondary">Email</label>
            <p className="mt-1 text-foreground">{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground-secondary">Name</label>
            <p className="mt-1 text-foreground">{user.name}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              type="password"
              label="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              type="password"
              label="Confirm new password"
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
            <Button type="submit" isLoading={isLoading}>
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 flex gap-4">
        <Link href="/account/billing">
          <Button variant="secondary">Billing & Subscription</Button>
        </Link>
        <Link href="/account/plans">
          <Button variant="secondary">View Plans</Button>
        </Link>
      </div>
    </div>
  );
}
