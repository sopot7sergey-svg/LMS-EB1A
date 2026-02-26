'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { DOCUMENT_CATEGORIES } from '@lms-eb1a/shared';
import {
  Upload,
  FileText,
  Trash2,
  ArrowLeft,
  File,
  Image,
} from 'lucide-react';

interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const params = useParams();
  const { token } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('misc');

  const caseId = params.id as string;

  useEffect(() => {
    if (!token || !caseId) return;

    const fetchDocuments = async () => {
      try {
        const data = await api.documents.list(caseId, token);
        setDocuments(data);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [token, caseId]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!token || !caseId) return;

      setIsUploading(true);
      try {
        for (const file of acceptedFiles) {
          const newDoc = await api.documents.upload(
            caseId,
            file,
            selectedCategory,
            token
          );
          setDocuments((prev) => [newDoc, ...prev]);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setIsUploading(false);
      }
    },
    [token, caseId, selectedCategory]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const handleDelete = async (docId: string) => {
    if (!token) return;

    try {
      await api.documents.delete(docId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    return FileText;
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
      <div className="mb-8">
        <Link
          href={`/case/${caseId}`}
          className="mb-4 inline-flex items-center text-sm text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to case
        </Link>
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="mt-2 text-foreground-secondary">
          Upload and manage your evidence documents.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="mb-4">
                <label className="label mb-2 block">Document Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="input"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
                {isDragActive ? (
                  <p className="text-foreground">Drop files here...</p>
                ) : (
                  <>
                    <p className="text-foreground">
                      Drag & drop files here, or click to select
                    </p>
                    <p className="mt-2 text-sm text-foreground-muted">
                      PDF, DOC, DOCX, PNG, JPG up to 50MB
                    </p>
                  </>
                )}
                {isUploading && (
                  <div className="mt-4">
                    <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-sm text-foreground-secondary">
                      Uploading...
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded Documents ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-center text-foreground-secondary py-8">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const Icon = getFileIcon(doc.mimeType);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 rounded-lg border border-border p-4"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary">
                          <Icon className="h-5 w-5 text-foreground-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.originalName}</p>
                          <div className="flex items-center gap-2 text-sm text-foreground-muted">
                            <span className="capitalize">{doc.category}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.size)}</span>
                            <span>•</span>
                            <span>
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 text-error" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const count = documents.filter((d) => d.category === cat).length;
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between rounded-lg bg-background-secondary p-3"
                    >
                      <span className="capitalize">{cat}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
