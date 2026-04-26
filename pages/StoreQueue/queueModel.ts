import type { Job, Part } from '../../types';
import { JobStatus } from '../../types';
import type { FilterType, InlinePartRow, JobGroup, QueueItem } from './types';
import { findBestPartMatch, getPriority } from './utils';

export interface JobRequestRow {
  request_id: unknown;
  created_at: unknown;
  description: unknown;
  admin_response_part_id?: unknown;
  admin_response_quantity?: unknown;
  issued_at?: unknown;
  collected_at?: unknown;
  requested_by_user?: Record<string, unknown> | null;
  job?: Record<string, unknown> | null;
}

export function buildStoreQueue(
  requests: JobRequestRow[],
  jobs: Job[],
  parts: Part[]
): { items: QueueItem[]; autoMatched: Record<string, InlinePartRow[]> } {
  const items: QueueItem[] = [];
  const validRequests = requests.filter(r => r.job != null && !(r.job.deleted_at));
  const autoMatched: Record<string, InlinePartRow[]> = {};

  for (const r of validRequests) {
    const user = r.requested_by_user;
    const job = r.job;
    const customer = job?.customer as Record<string, unknown> | null;
    const forklift = job?.forklift as Record<string, unknown> | null;

    items.push({
      id: `req-${r.request_id}`,
      type: 'part_request',
      priority: getPriority('part_request', r.created_at as string),
      createdAt: r.created_at as string,
      requestId: r.request_id as string,
      requestDescription: r.description as string,
      requestedByName: (user?.full_name as string) || (user?.name as string) || 'Unknown',
      adminResponsePartId: r.admin_response_part_id as string | undefined,
      adminResponseQuantity: r.admin_response_quantity as number | undefined,
      issuedAt: r.issued_at as string | undefined,
      collectedAt: r.collected_at as string | undefined,
      jobId: (job?.job_id as string) || '',
      jobTitle: (job?.title as string) || 'Unknown Job',
      jobStatus: (job?.status as string) || '',
      customerName: (customer?.name as string) || '',
      technicianName: (job?.assigned_technician_name as string) || '',
      forkliftSerial: (forklift?.serial_number as string) || '',
    });

    const match = findBestPartMatch(r.description as string, parts);
    autoMatched[r.request_id as string] = [{
      partId: match?.part_id || '',
      quantity: '1',
    }];
  }

  const awaitingJobs = jobs.filter(
    (j: Job) => j.status === JobStatus.AWAITING_FINALIZATION
  );

  for (const job of awaitingJobs) {
    if (job.job_confirmed_at) continue;

    items.push({
      id: `job-${job.job_id}`,
      type: 'confirm_job',
      priority: getPriority('confirm_job', job.completed_at || job.created_at),
      createdAt: job.completed_at || job.created_at,
      jobId: job.job_id,
      jobTitle: job.title,
      jobStatus: job.status,
      customerName: job.customer?.name || '',
      technicianName: job.assigned_technician_name || '',
      forkliftSerial: job.forklift?.serial_number || '',
      completedAt: job.completed_at,
      partsConfirmedAt: job.parts_confirmed_at,
    });
  }

  items.sort((a, b) => a.priority - b.priority);
  return { items, autoMatched };
}

export function filterStoreQueue(queue: QueueItem[], filter: FilterType, searchQuery: string): QueueItem[] {
  let items = queue;
  if (filter !== 'all') items = items.filter(i => i.type === filter);
  if (!searchQuery) return items;

  const q = searchQuery.toLowerCase();
  return items.filter(i =>
    (i.requestDescription || '').toLowerCase().includes(q) ||
    i.jobTitle.toLowerCase().includes(q) ||
    i.customerName.toLowerCase().includes(q) ||
    i.technicianName.toLowerCase().includes(q) ||
    i.forkliftSerial.toLowerCase().includes(q) ||
    (i.requestedByName || '').toLowerCase().includes(q)
  );
}

export function groupStoreQueue(
  filteredQueue: QueueItem[],
  inlineState: Record<string, InlinePartRow[]>
): JobGroup[] {
  const grouped = new Map<string, Omit<JobGroup, 'canShowApproveAll'>>();

  for (const item of filteredQueue) {
    const existing = grouped.get(item.jobId);
    if (existing) {
      existing.items.push(item);
      if (new Date(item.createdAt).getTime() > new Date(existing.newestCreatedAt).getTime()) {
        existing.newestCreatedAt = item.createdAt;
      }
      if (new Date(item.createdAt).getTime() < new Date(existing.oldestCreatedAt).getTime()) {
        existing.oldestCreatedAt = item.createdAt;
      }
      if (!existing.jobTitle && item.jobTitle) existing.jobTitle = item.jobTitle;
      if (!existing.customerName && item.customerName) existing.customerName = item.customerName;
      if (!existing.technicianName && item.technicianName) existing.technicianName = item.technicianName;
    } else {
      grouped.set(item.jobId, {
        jobId: item.jobId,
        jobTitle: item.jobTitle,
        customerName: item.customerName,
        technicianName: item.technicianName,
        items: [item],
        newestCreatedAt: item.createdAt,
        oldestCreatedAt: item.createdAt,
      });
    }
  }

  return Array.from(grouped.values())
    .map(group => {
      const allPartRequests = group.items.every(item => item.type === 'part_request');
      const allPartRequestsSelected = allPartRequests
        && group.items.every(item => item.requestId && (inlineState[item.requestId] || []).some(r => r.partId));
      const singleConfirmJob = group.items.length === 1 && group.items[0].type === 'confirm_job';

      return {
        ...group,
        canShowApproveAll: allPartRequestsSelected || singleConfirmJob,
      };
    })
    .sort((a, b) => new Date(b.newestCreatedAt).getTime() - new Date(a.newestCreatedAt).getTime());
}

export function countStoreQueue(queue: QueueItem[]): Record<FilterType, number> {
  const counts: Record<FilterType, number> = { part_request: 0, confirm_job: 0, all: 0 };
  for (const item of queue) {
    counts[item.type]++;
    counts.all++;
  }
  return counts;
}
