'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  isActive: boolean;
  _count: { lessons: number };
}

export default function AdminModulesPage() {
  const { token } = useAuthStore();
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '', order: 0 });

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchModules = async () => {
      try {
        const data = await api.admin.modules.list(token);
        setModules(data);
      } catch (error) {
        console.error('Failed to fetch modules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModules();
  }, [token]);

  const handleEdit = (module: Module) => {
    setEditingId(module.id);
    setEditForm({ title: module.title, description: module.description || '' });
  };

  const handleSave = async (id: string) => {
    if (!token) return;

    try {
      const updated = await api.admin.modules.update(id, editForm, token);
      setModules((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
      );
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update module:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Are you sure you want to delete this module?')) return;

    try {
      await api.admin.modules.delete(id, token);
      setModules((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Failed to delete module:', error);
    }
  };

  const handleCreate = async () => {
    if (!token || !newModule.title) return;

    try {
      const created = await api.admin.modules.create(newModule, token);
      setModules((prev) => [...prev, { ...created, _count: { lessons: 0 } }]);
      setIsCreating(false);
      setNewModule({ title: '', description: '', order: modules.length });
    } catch (error) {
      console.error('Failed to create module:', error);
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

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Modules</h1>
          <p className="mt-2 text-foreground-secondary">
            Add, edit, and remove course modules.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Module
        </Button>
      </div>

      {isCreating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New Module</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                label="Title"
                value={newModule.title}
                onChange={(e) =>
                  setNewModule((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Module title"
              />
              <Input
                label="Description"
                value={newModule.description}
                onChange={(e) =>
                  setNewModule((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Module description"
              />
              <Input
                label="Order"
                type="number"
                value={newModule.order}
                onChange={(e) =>
                  setNewModule((prev) => ({ ...prev, order: parseInt(e.target.value) }))
                }
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create Module</Button>
                <Button variant="secondary" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {modules.map((module) => (
          <Card key={module.id}>
            <CardContent className="py-4">
              {editingId === module.id ? (
                <div className="space-y-4">
                  <Input
                    label="Title"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                  <Input
                    label="Description"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(module.id)}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                    {module.order}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{module.title}</h3>
                    <p className="text-sm text-foreground-secondary">
                      {module.description}
                    </p>
                    <p className="text-xs text-foreground-muted mt-1">
                      {module._count.lessons} lessons
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(module)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(module.id)}
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {modules.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-foreground-secondary">
                No modules yet. Create your first module to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
