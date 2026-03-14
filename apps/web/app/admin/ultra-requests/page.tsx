'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Check, X, Loader2 } from 'lucide-react';

export default function AdminUltraRequestsPage() {
  const { token } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const refresh = () => {
    if (!token) return;
    api.admin.ultraRequests.list(token)
      .then(setRequests)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.admin.ultraRequests.list(token)
      .then(setRequests)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleApprove = async (id: string) => {
    if (!token) return;
    setActionId(id);
    try {
      await api.admin.ultraRequests.approve(id, token);
      refresh();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    setActionId(id);
    try {
      await api.admin.ultraRequests.reject(id, token);
      refresh();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Ultra Eligibility Requests</h1>
          <Link href="/admin/users">
            <Button variant="secondary">Back to Users</Button>
          </Link>
        </div>
        <p className="mt-2 text-foreground-secondary">
          Review and approve Ultra plan requests.
        </p>

        {isLoading ? (
          <div className="mt-8 flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>
                {pending.length} pending request{pending.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-foreground-secondary">No Ultra requests yet.</p>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4"
                    >
                      <div>
                        <p className="font-medium">{req.user?.name}</p>
                        <p className="text-sm text-foreground-secondary">{req.user?.email}</p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          Requested {new Date(req.requestedAt).toLocaleString()} · {req.status}
                        </p>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReject(req.id)}
                            disabled={actionId !== null}
                          >
                            {actionId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                            disabled={actionId !== null}
                          >
                            {actionId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
