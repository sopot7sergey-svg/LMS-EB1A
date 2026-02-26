'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Plus, Edit2, Trash2, Save, X, Video } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  videoEmbed: string | null;
  order: number;
  isActive: boolean;
  module: { id: string; title: string };
}

interface Module {
  id: string;
  title: string;
  order: number;
}

export default function AdminLessonsPage() {
  const { token } = useAuthStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    videoEmbed: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [newLesson, setNewLesson] = useState({
    moduleId: '',
    title: '',
    description: '',
    videoUrl: '',
    videoEmbed: '',
    order: 1,
  });
  const [filterModuleId, setFilterModuleId] = useState('');

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [lessonsData, modulesData] = await Promise.all([
          api.admin.lessons.list(token),
          api.admin.modules.list(token),
        ]);
        setLessons(lessonsData);
        setModules(modulesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleEdit = (lesson: Lesson) => {
    setEditingId(lesson.id);
    setEditForm({
      title: lesson.title,
      description: lesson.description || '',
      videoUrl: lesson.videoUrl || '',
      videoEmbed: lesson.videoEmbed || '',
    });
  };

  const handleSave = async (id: string) => {
    if (!token) return;

    try {
      const updated = await api.admin.lessons.update(id, editForm, token);
      setLessons((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updated } : l))
      );
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update lesson:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Are you sure you want to delete this lesson?')) return;

    try {
      await api.admin.lessons.delete(id, token);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (error) {
      console.error('Failed to delete lesson:', error);
    }
  };

  const handleCreate = async () => {
    if (!token || !newLesson.title || !newLesson.moduleId) return;

    try {
      const created = await api.admin.lessons.create(newLesson, token);
      const moduleInfo = modules.find((m) => m.id === newLesson.moduleId);
      setLessons((prev) => [
        ...prev,
        { ...created, module: { id: newLesson.moduleId, title: moduleInfo?.title || '' } },
      ]);
      setIsCreating(false);
      setNewLesson({
        moduleId: '',
        title: '',
        description: '',
        videoUrl: '',
        videoEmbed: '',
        order: 1,
      });
    } catch (error) {
      console.error('Failed to create lesson:', error);
    }
  };

  const filteredLessons = filterModuleId
    ? lessons.filter((l) => l.module.id === filterModuleId)
    : lessons;

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
          <h1 className="text-3xl font-bold">Manage Lessons</h1>
          <p className="mt-2 text-foreground-secondary">
            Add, edit, and manage video lessons.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lesson
        </Button>
      </div>

      <div className="mb-6">
        <label className="label mb-2 block">Filter by Module</label>
        <select
          value={filterModuleId}
          onChange={(e) => setFilterModuleId(e.target.value)}
          className="input max-w-xs"
        >
          <option value="">All Modules</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              Module {module.order}: {module.title}
            </option>
          ))}
        </select>
      </div>

      {isCreating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New Lesson</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="label mb-2 block">Module</label>
                <select
                  value={newLesson.moduleId}
                  onChange={(e) =>
                    setNewLesson((prev) => ({ ...prev, moduleId: e.target.value }))
                  }
                  className="input"
                >
                  <option value="">Select a module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      Module {module.order}: {module.title}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Title"
                value={newLesson.title}
                onChange={(e) =>
                  setNewLesson((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Lesson title"
              />
              <Input
                label="Description"
                value={newLesson.description}
                onChange={(e) =>
                  setNewLesson((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Lesson description"
              />
              <Input
                label="Video URL"
                value={newLesson.videoUrl}
                onChange={(e) =>
                  setNewLesson((prev) => ({ ...prev, videoUrl: e.target.value }))
                }
                placeholder="https://..."
              />
              <div>
                <label className="label mb-2 block">Video Embed Code</label>
                <textarea
                  value={newLesson.videoEmbed}
                  onChange={(e) =>
                    setNewLesson((prev) => ({ ...prev, videoEmbed: e.target.value }))
                  }
                  className="input min-h-[100px]"
                  placeholder="<iframe>...</iframe>"
                />
              </div>
              <Input
                label="Order"
                type="number"
                value={newLesson.order}
                onChange={(e) =>
                  setNewLesson((prev) => ({ ...prev, order: parseInt(e.target.value) }))
                }
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create Lesson</Button>
                <Button variant="secondary" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {filteredLessons.map((lesson) => (
          <Card key={lesson.id}>
            <CardContent className="py-4">
              {editingId === lesson.id ? (
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
                  <Input
                    label="Video URL"
                    value={editForm.videoUrl}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, videoUrl: e.target.value }))
                    }
                  />
                  <div>
                    <label className="label mb-2 block">Video Embed Code</label>
                    <textarea
                      value={editForm.videoEmbed}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, videoEmbed: e.target.value }))
                      }
                      className="input min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(lesson.id)}>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary">
                    <Video className="h-5 w-5 text-foreground-muted" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary">
                        {lesson.module.title}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        Lesson {lesson.order}
                      </span>
                    </div>
                    <h3 className="font-semibold">{lesson.title}</h3>
                    {lesson.description && (
                      <p className="text-sm text-foreground-secondary">
                        {lesson.description}
                      </p>
                    )}
                    {lesson.videoUrl && (
                      <p className="text-xs text-foreground-muted mt-1 truncate">
                        {lesson.videoUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(lesson)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(lesson.id)}
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredLessons.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-foreground-secondary">
                No lessons found. Create your first lesson to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
