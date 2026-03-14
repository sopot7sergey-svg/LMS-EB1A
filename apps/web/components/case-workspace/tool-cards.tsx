'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  FileEdit,
  ClipboardCheck,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToolId = 'document-assistant' | 'officer-review' | 'advisor-chat';

interface ToolCardProps {
  id: ToolId;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const TOOLS: Omit<ToolCardProps, 'onClick'>[] = [
  {
    id: 'document-assistant',
    title: 'Document Assistant',
    description: 'Guided create and fill flows for supported documents and forms',
    icon: <FileEdit className="h-8 w-8" />,
  },
  {
    id: 'officer-review',
    title: 'Review & Audit',
    description: 'Document review, whole-packet audit, and Final Audit Report',
    icon: <ClipboardCheck className="h-8 w-8" />,
  },
  {
    id: 'advisor-chat',
    title: 'Advisor Chat',
    description: 'Ask procedural questions (no approval predictions, no odds)',
    icon: <MessageCircle className="h-8 w-8" />,
  },
];

function ToolCard({ title, description, icon, onClick }: ToolCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${title}`}
      className="w-full text-left"
    >
      <Card className="cursor-pointer transition-all hover:border-primary/50 hover:bg-background-secondary/50">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-foreground-secondary">{description}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

interface ToolCardsProps {
  onToolClick: (toolId: ToolId) => void;
  className?: string;
}

export function ToolCards({ onToolClick, className }: ToolCardsProps) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {TOOLS.map((tool) => (
        <ToolCard
          key={tool.id}
          {...tool}
          onClick={() => onToolClick(tool.id)}
        />
      ))}
    </div>
  );
}
