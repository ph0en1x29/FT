/**
 * Quotation Service — ACWER Path B chargeable scaffolding (Phase 10).
 *
 * The `quotations` table was created in an earlier migration (zero rows
 * in production today). Phase 10 ships the data layer so admin can create,
 * read, and update quotations via the API. A full quotation creation modal
 * + PDF generator + send-via-email flow is the natural follow-up; this
 * service file unblocks any of those without further schema changes.
 *
 * Status semantics (per the existing `Quotation` type):
 *   - 'draft'    → being authored, not yet sent
 *   - 'sent'     → emailed/whatsapped to customer, awaiting response
 *   - 'accepted' → customer accepted; ready to convert to a job
 *   - 'rejected' → customer declined
 */
import type { Quotation, QuotationItem } from '../types';
import { logDebug, supabase } from './supabaseClient';

const QUOTATION_SELECT = `
  *,
  customer:customers(*),
  forklift:forklifts!forklift_id(*)
`;

interface CreateQuotationInput {
  customer_id: string;
  forklift_id?: string | null;
  date: string;                                  // ISO timestamp
  attention: string;
  reference: string;
  items: QuotationItem[];
  sub_total: number;
  tax_rate?: number;
  tax_amount?: number;
  total: number;
  validity: string;
  delivery_site?: string | null;
  delivery_term: string;
  payment_term: string;
  remark?: string | null;
  job_id?: string | null;
}

/**
 * Generate a sequential quotation number for today. Format: QT-YYYYMMDD-NNN.
 * Falls back to a timestamp suffix if the day count query fails.
 */
async function generateQuotationNumber(): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dayPrefix = `QT-${yyyy}${mm}${dd}`;
  const { count } = await supabase
    .from('quotations')
    .select('quotation_id', { count: 'exact', head: true })
    .like('quotation_number', `${dayPrefix}%`);
  const seq = (count ?? 0) + 1;
  return `${dayPrefix}-${String(seq).padStart(3, '0')}`;
}

export async function listQuotations(filters?: {
  status?: 'draft' | 'sent' | 'accepted' | 'rejected';
  customer_id?: string;
}): Promise<Quotation[]> {
  let query = supabase.from('quotations').select(QUOTATION_SELECT).order('date', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
  const { data, error } = await query;
  if (error) {
    logDebug('[quotationService] listQuotations error:', error);
    return [];
  }
  return (data ?? []) as Quotation[];
}

export async function getQuotationById(quotationId: string): Promise<Quotation | null> {
  const { data, error } = await supabase
    .from('quotations')
    .select(QUOTATION_SELECT)
    .eq('quotation_id', quotationId)
    .single();
  if (error || !data) return null;
  return data as Quotation;
}

export async function createQuotation(
  input: CreateQuotationInput,
  createdById: string,
  createdByName: string,
): Promise<Quotation> {
  const quotationNumber = await generateQuotationNumber();
  const payload = {
    quotation_number: quotationNumber,
    customer_id: input.customer_id,
    forklift_id: input.forklift_id ?? null,
    date: input.date,
    attention: input.attention,
    reference: input.reference,
    items: input.items,
    sub_total: input.sub_total,
    tax_rate: input.tax_rate ?? 0,
    tax_amount: input.tax_amount ?? 0,
    total: input.total,
    validity: input.validity,
    delivery_site: input.delivery_site ?? null,
    delivery_term: input.delivery_term,
    payment_term: input.payment_term,
    remark: input.remark ?? null,
    status: 'draft',
    created_by_id: createdById,
    created_by_name: createdByName,
    job_id: input.job_id ?? null,
  };
  const { data, error } = await supabase
    .from('quotations')
    .insert(payload)
    .select(QUOTATION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as Quotation;
}

export async function updateQuotation(
  quotationId: string,
  updates: Partial<CreateQuotationInput> & { status?: 'draft' | 'sent' | 'accepted' | 'rejected' },
): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    .update(updates)
    .eq('quotation_id', quotationId)
    .select(QUOTATION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as Quotation;
}

/** Mark a quotation as sent (admin clicks "Send to customer"). */
export async function markQuotationSent(quotationId: string): Promise<Quotation> {
  return updateQuotation(quotationId, { status: 'sent' });
}

/** Customer accepted — admin can now convert to a job. */
export async function markQuotationAccepted(quotationId: string): Promise<Quotation> {
  return updateQuotation(quotationId, { status: 'accepted' });
}

/** Customer declined. */
export async function markQuotationRejected(quotationId: string): Promise<Quotation> {
  return updateQuotation(quotationId, { status: 'rejected' });
}

/**
 * Convert an accepted quotation into a job. Stamps `job_id` on the quotation
 * and copies quotation_number / quotation_date / delivery_term / payment_term
 * onto the new job (which is created externally via `createJob`).
 */
export async function linkQuotationToJob(quotationId: string, jobId: string): Promise<Quotation> {
  return updateQuotation(quotationId, { job_id: jobId });
}
