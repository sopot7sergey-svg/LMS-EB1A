'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Users, Shield, User } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  suspended?: boolean;
  plan?: string;
  planStatus?: string;
  appAccessActive?: boolean;
  deviceCount?: number;
  createdAt: string;
  _count: {
    cases: number;
    lessonProgress: number;
  };
}

export default function AdminUsersPage() {
  const { token, user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        const data = await api.admin.users.list(token);
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  const handleRoleChange = async (userId: string, newRole: 'student' | 'admin') => {
    if (!token) return;

    try {
      await api.admin.users.updateRole(userId, newRole, token);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (error) {
      console.error('Failed to update role:', error);
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

  const students = users.filter((u) => u.role === 'student');
  const admins = users.filter((u) => u.role === 'admin');

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Manage Users</h1>
        <p className="mt-2 text-foreground-secondary">
          View and manage user accounts and roles.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">Students</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Shield className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">Admins</p>
                <p className="text-2xl font-bold">{admins.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile/tablet: card layout */}
          <div className="space-y-4 lg:hidden">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <Link
                  href={`/admin/users/${user.id}`}
                  className="flex items-center gap-3 hover:opacity-80"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-foreground-muted truncate">{user.email}</p>
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {user.role}
                  </span>
                  <span className="text-foreground-secondary">
                    Plan: <span className="capitalize text-foreground">{user.plan ?? '—'}</span>
                    {user.appAccessActive === false && user.role === 'student' && (
                      <span className="text-warning"> (locked)</span>
                    )}
                  </span>
                  <span className="text-foreground-secondary">
                    Cases: {user._count.cases} · Lessons: {user._count.lessonProgress}
                  </span>
                  <span className="text-foreground-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {user.id !== currentUser?.id && (
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value as 'student' | 'admin')
                    }
                    className="min-h-[44px] w-full max-w-[140px] rounded border border-border bg-background-secondary px-3 py-2 text-sm"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    Cases
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    Lessons
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="flex items-center gap-3 hover:opacity-80"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-foreground-muted">{user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{user.plan ?? '—'}</span>
                      {user.appAccessActive === false && user.role === 'student' && (
                        <span className="ml-1 text-xs text-warning">(locked)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{user._count.cases}</td>
                    <td className="px-4 py-3">{user._count.lessonProgress}</td>
                    <td className="px-4 py-3 text-sm text-foreground-secondary">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {user.id !== currentUser?.id && (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value as 'student' | 'admin')
                          }
                          className="rounded border border-border bg-background-secondary px-2 py-1 text-sm"
                        >
                          <option value="student">Student</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
