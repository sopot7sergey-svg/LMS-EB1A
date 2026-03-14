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
    setActionLoading('upload');
    try {
      await api.admin.users.updateUploadAccess(userId, enabled, token);
      setUser((u: any) => ({ ...u, uploadEnabled: enabled }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (suspended: boolean) => {
    if (!token) return;
    setActionLoading('suspend');
    try {
      await api.admin.users.suspend(userId, suspended, token);
      setUser((u: any) => ({ ...u, suspended }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetDevices = async () => {
    if (!token) return;
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
    setActionLoading('grant');
    try {
      await api.admin.users.grantCourse(userId, token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetUltra = async () => {
    if (!token) return;
    setActionLoading('ultra');
    try {
      await api.admin.users.setUltra(userId, 'monthly', token);
      const updated = await api.admin.users.get(userId, token);
      setUser(updated);
    } catch (e) {
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

        <Card>
          <CardHeader>
            <CardTitle>App Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Plan</span>
              <span className="capitalize">{user.plan ?? 'none'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Status</span>
              <span className="capitalize">{user.planStatus ?? 'expired'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Access</span>
              <span>{user.appAccessActive ? 'Active' : 'Locked'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Cases</span>
              <span>{user._count?.cases ?? 0} / {user.maxCases ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Upload</span>
              <span>{user.uploadEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleUploadToggle(!user.uploadEnabled)}
                isLoading={actionLoading === 'upload'}
              >
                <Upload className="mr-2 h-4 w-4" />
                {user.uploadEnabled ? 'Disable' : 'Enable'} Upload
              </Button>
              {user.role === 'student' && (
                <>
                  {!user.courseEntitlement && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleGrantCourse}
                      isLoading={actionLoading === 'grant'}
                    >
                      Grant Course + Start
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSetUltra}
                    isLoading={actionLoading === 'ultra'}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Set Ultra
                  </Button>
                </>
              )}
            </div>
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
              Resetting devices allows the user to log in from new browsers. Use when they exceed the 2-device limit.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
