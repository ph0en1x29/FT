import type { LucideIcon } from 'lucide-react';
import { Package, Wrench } from 'lucide-react';
import type { Part } from '../../types';
import type { QueueItemType } from './types';

export function getPriority(type: QueueItemType, createdAt: string): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const basePriority: Record<QueueItemType, number> = {
    part_request: 0,
    confirm_job: 100,
  };
  return basePriority[type] - Math.min(ageHours, 99);
}

export function formatTimeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function getTypeLabel(type: QueueItemType): string {
  switch (type) {
    case 'part_request': return 'Part Request';
    case 'confirm_job': return 'Confirm Job';
  }
}

export function getTypeColor(type: QueueItemType): string {
  switch (type) {
    case 'part_request': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'confirm_job': return 'bg-green-100 text-green-700 border-green-200';
  }
}

export function getTypeIcon(type: QueueItemType): LucideIcon {
  switch (type) {
    case 'part_request': return Package;
    case 'confirm_job': return Wrench;
  }
}

export function findBestPartMatch(description: string, parts: Part[]): Part | null {
  if (!description || parts.length === 0) return null;
  const descLower = description.toLowerCase();
  const descWords = descLower.split(/[\s,]+/).filter(w => w.length > 2);
  let bestMatch: Part | null = null;
  let bestScore = 0;
  for (const part of parts) {
    if (part.stock_quantity <= 0) continue;
    const partLower = part.part_name.toLowerCase();
    if (partLower === descLower) return part;
    let score = 0;
    for (const word of descWords) {
      if (partLower.includes(word)) score += word.length;
    }
    if (descLower.includes(partLower)) score += partLower.length * 2;
    if (partLower.includes(descLower)) score += descLower.length * 2;
    if (score > bestScore) { bestScore = score; bestMatch = part; }
  }
  return bestScore >= 3 ? bestMatch : null;
}
