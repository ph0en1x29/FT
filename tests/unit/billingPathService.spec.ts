import { describe, expect, it } from 'vitest';
import { classifyBillingPath } from '../../services/billingPathService';
import { BillingPath } from '../../types/service-flow.types';
import type { Forklift, ServiceContract } from '../../types';

// Test seed for the ACWER 3-path classifier. classifyBillingPath() is the
// single source of truth for "is this job AMC / Chargeable / Fleet" — every
// downstream auto-flip (parts add → chargeable, accident → chargeable,
// overage → chargeable) keys off the result. Lock the contract.

const customerForklift = (overrides: Partial<Forklift> = {}): Forklift => ({
  forklift_id: 'fl-1',
  ownership: 'customer',
  serial_number: 'SN-1',
  make: 'Toyota',
  model: '8FBE15',
  status: 'active',
  hourmeter: 0,
  type: 'Electric',
  // Cast to satisfy the wider Forklift shape; tests only need ownership +
  // forklift_id for classification.
  ...overrides,
} as Forklift);

const fleetForklift = (overrides: Partial<Forklift> = {}): Forklift =>
  customerForklift({ ownership: 'company', ...overrides });

const contract = (overrides: Partial<ServiceContract> = {}): ServiceContract => ({
  contract_id: 'c-1',
  contract_number: 'AMC-001',
  customer_id: 'cust-1',
  is_active: true,
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  covered_forklift_ids: null,
  ...overrides,
} as ServiceContract);

const refDate = new Date('2026-05-01T00:00:00Z');

describe('classifyBillingPath — Path C (Fleet)', () => {
  it('classifies company-owned forklift as FLEET regardless of contracts', () => {
    const result = classifyBillingPath({
      forklift: fleetForklift(),
      customer_id: 'cust-1',
      active_contracts: [contract()],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.FLEET);
    expect(result.reason).toMatch(/fleet/i);
  });
});

describe('classifyBillingPath — UNSET', () => {
  it('classifies missing forklift as UNSET', () => {
    const result = classifyBillingPath({
      forklift: null,
      customer_id: 'cust-1',
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.UNSET);
  });

  it('classifies forklift with unknown ownership as UNSET', () => {
    const result = classifyBillingPath({
      forklift: customerForklift({ ownership: undefined as unknown as 'customer' }),
      customer_id: 'cust-1',
      active_contracts: [],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.UNSET);
  });
});

describe('classifyBillingPath — Path A (AMC)', () => {
  it('classifies customer forklift with active blanket contract as AMC', () => {
    const result = classifyBillingPath({
      forklift: customerForklift(),
      customer_id: 'cust-1',
      active_contracts: [contract({ covered_forklift_ids: null })],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.AMC);
    expect(result.contract_id).toBe('c-1');
    expect(result.reason).toMatch(/AMC-001/);
  });

  it('classifies customer forklift with explicit per-fleet contract as AMC when included', () => {
    const result = classifyBillingPath({
      forklift: customerForklift({ forklift_id: 'fl-7' }),
      customer_id: 'cust-1',
      active_contracts: [contract({ covered_forklift_ids: ['fl-7', 'fl-8'] })],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.AMC);
  });

  it('classifies customer forklift NOT covered by per-fleet contract as CHARGEABLE', () => {
    const result = classifyBillingPath({
      forklift: customerForklift({ forklift_id: 'fl-99' }),
      customer_id: 'cust-1',
      active_contracts: [contract({ covered_forklift_ids: ['fl-7', 'fl-8'] })],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.CHARGEABLE);
  });
});

describe('classifyBillingPath — contract validity window', () => {
  it('falls through to CHARGEABLE when contract has expired', () => {
    const result = classifyBillingPath({
      forklift: customerForklift(),
      customer_id: 'cust-1',
      active_contracts: [contract({ start_date: '2025-01-01', end_date: '2025-12-31' })],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.CHARGEABLE);
  });

  it('falls through to CHARGEABLE when contract has not yet started', () => {
    const result = classifyBillingPath({
      forklift: customerForklift(),
      customer_id: 'cust-1',
      active_contracts: [contract({ start_date: '2027-01-01', end_date: '2027-12-31' })],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.CHARGEABLE);
  });

  it('falls through to CHARGEABLE when contract is_active = false', () => {
    const result = classifyBillingPath({
      forklift: customerForklift(),
      customer_id: 'cust-1',
      active_contracts: [contract({ is_active: false })],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.CHARGEABLE);
  });
});

describe('classifyBillingPath — Path B (Chargeable)', () => {
  it('classifies customer forklift with no contracts as CHARGEABLE', () => {
    const result = classifyBillingPath({
      forklift: customerForklift(),
      customer_id: 'cust-1',
      active_contracts: [],
      current_date: refDate,
    });
    expect(result.path).toBe(BillingPath.CHARGEABLE);
    expect(result.reason).toMatch(/no active contract/i);
  });
});
