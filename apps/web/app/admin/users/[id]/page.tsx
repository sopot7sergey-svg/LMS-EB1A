'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { ArrowLeft, Lock, Unlock, Smartphone, Shield, Upload } from 'lucide-react';

export default function AdminUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const userId = params.id as string;

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.admin.users.get(userId, token)
      .then(setUser)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token, userId]);

  const handleUploadToggle = async (enabled: boolean) => {
    if (!token) return;
    setActionError(null);
    setActionLoading('upload');
    try {
      await api.admin.users.updateUploadAccess(userId, enabled, token);
      setUser((u: any) => ({ ...u, uploadEnabled: enabled }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Upload update failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (suspended: boolean) => {
    if (!token) return;
    setActionError(null);
    setActionLoading('suspend');
    try {
      await api.admin.users.suspend(userId, suspended, token);
      setUser((u: any) => ({ ...u, suspended }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Suspend failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetDevices = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('devices');
    try {
      await api.admin.users.resetDevices(userId, token);
      setUser((u: any) => ({ ...u, deviceAccesses: [] }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrantCourse = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('grant');
    try {
      await api.admin.users.grantCourse(userId, token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Grant course failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetUltra = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('ultra');
    try {
      await api.admin.users.setUltra(userId, 'monthly', token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Set Ultra failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetPro = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('pro');
    try {
      await api.admin.users.setPro(userId, 'monthly', token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Set Pro failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetStart = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('start');
    try {
      await api.admin.users.setStart(userId, token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Set Start failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockAccess = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('lock');
    try {
      await api.admin.users.lockAccess(userId, token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Lock access failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockAccess = async () => {
    if (!token) return;
    setActionError(null);
    setActionLoading('unlock');
    try {
      await api.admin.users.unlockAccess(userId, token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unlock access failed');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <p className="text-foreground-secondary">User not found</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">User Profile</h1>
        <p className="mt-2 text-foreground-secondary">
          {user.email}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Name</span>
              <span>{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Role</span>
              <span className="capitalize">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Suspended</span>
              <span>{user.suspended ? 'Yes' : 'No'}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSuspend(!user.suspended)}
              isLoading={actionLoading === 'suspend'}
            >
              {user.suspended ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {user.suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Package Control</CardTitle>
            <p className="text-sm text-foreground-secondary">
              Manually manage this student&apos;s plan and app access. Changes apply immediately.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {actionError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {actionError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium text-foreground-secondary">Current Plan</div>
                <div className="mt-1 text-lg font-semibold capitalize">{user.plan ?? 'none'}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium text-foreground-secondary">Plan Status</div>
                <div className="mt-1 text-lg font-semibold capitalize">{user.planStatus ?? 'expired'}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium text-foreground-secondary">Expires</div>
                <div className="mt-1 text-lg font-semibold">
                  {user.expiresAt ? new Date(user.expiresAt).toLocaleDateString() : '—'}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium text-foreground-secondary">Upload</div>
                <div className="mt-1 text-lg font-semibold">{user.uploadEnabled ? 'Enabled' : 'Disabled'}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium text-foreground-secondary">Max Cases</div>
                <div className="mt-1 text-lg font-semibold">{user.maxCases ?? 0}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-medium text-foreground-secondary">App Access</div>
                <div className="mt-1 text-lg font-semibold">{user.appAccessActive ? 'Active' : 'Locked'}</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Plan switching</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetStart}
                  isLoading={actionLoading === 'start'}
                  disabled={!!actionLoading}
                >
                  Set Start
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetPro}
                  isLoading={actionLoading === 'pro'}
                  disabled={!!actionLoading}
                >
                  Set Pro
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetUltra}
                  isLoading={actionLoading === 'ultra'}
                  disabled={!!actionLoading}
                >
                  Set Ultra
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Access enforcement</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={user.appAccessActive ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={handleLockAccess}
                  isLoading={actionLoading === 'lock'}
                  disabled={!!actionLoading}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Lock App Access
                </Button>
                <Button
                  variant={!user.appAccessActive ? 'default' : 'secondary'}
                  size="sm"
                  onClick={handleUnlockAccess}
                  isLoading={actionLoading === 'unlock'}
                  disabled={!!actionLoading}
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock App Access
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Upload (manual override)</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUploadToggle(true)}
                  isLoading={actionLoading === 'upload'}
                  disabled={!!actionLoading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Enable Upload
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUploadToggle(false)}
                  isLoading={actionLoading === 'upload'}
                  disabled={!!actionLoading}
                >
                  Disable Upload
                </Button>
              </div>
            </div>

            {user.role === 'student' && !user.courseEntitlement && (
              <div className="space-y-4">
                <h4 className="font-medium">Course grant</h4>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGrantCourse}
                  isLoading={actionLoading === 'grant'}
                  disabled={!!actionLoading}
                >
                  Grant Course + Start
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary">
                Active devices: {user.deviceAccesses?.length ?? 0} / 2
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetDevices}
                isLoading={actionLoading === 'devices'}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Reset Devices
              </Button>
            </div>
            <p className="mt-2 text-sm text-foreground-muted">
              Resets the student&apos;s trusted device list (sets all to inactive). Frees slots so they can log in from new browsers. Does not log them out of their current session.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
