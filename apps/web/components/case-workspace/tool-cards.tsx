'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  FileEdit,
  ClipboardCheck,
  FileSpreadsheet,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToolId = 'creator' | 'officer-review' | 'forms-filler' | 'advisor-chat';

interface ToolCardProps {
  id: ToolId;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const TOOLS: Omit<ToolCardProps, 'onClick'>[] = [
  {
    id: 'creator',
    title: 'Creator',
    description: 'Create / draft documents, narratives, exhibits, letters',
    icon: <FileEdit className="h-8 w-8" />,
  },
  {
    id: 'officer-review',
    title: 'Officer Review',
    description: 'Generate EER: Critical / Recommended / Optional (never approval language)',
    icon: <ClipboardCheck className="h-8 w-8" />,
  },
  {
    id: 'forms-filler',
    title: 'Forms Filler',
    description: 'Fill Form I-140 from Case Profile Data → export PDF + JSON',
    icon: <FileSpreadsheet className="h-8 w-8" />,
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
    <Card
      className="cursor-pointer transition-all hover:border-primary/50 hover:bg-background-secondary/50"
      onClick={onClick}
    >
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
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-4',
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
