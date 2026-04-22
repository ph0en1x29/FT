# Acwer Service Operations Flow — Detailed Explanation

Below is a full text walkthrough of the Acwer service operations flowchart, organized so another AI can reconstruct the business logic without needing to see the original diagram.

## 1. Business context

This flowchart describes how Acwer (a forklift sales and service company) routes every incoming service job through one of three billing/workflow paths, then pushes the job through a common dispatch → inventory → invoicing pipeline. The ultimate output of every job is either (a) an AUTOCOUNT invoice to the customer, or (b) an internal cost entry used for ROI tracking on company-owned fleet. AUTOCOUNT is the accounting system of record.

## 2. The root decision: "Job Type Determination"

Every job starts at a single node — **Job Type Determination** — which classifies the asset involved and routes the job down one of three paths based on asset ownership and contract status:

- **Path A — AMC (After Sales Service):** The customer *owns* the equipment (they bought a reconditioned diesel forklift or a new Hangcha battery forklift from Acwer) and is covered by an Annual Maintenance Contract / warranty.
- **Path B — Non-Contract (Repair & Service, Chargeable):** The customer owns the equipment but has no active contract. Work is done ad-hoc on a quotation basis.
- **Path C — Contract Rental / Fleet Maintenance:** The equipment is an **Acwer-owned asset** (fleet unit rented to a customer or used internally). Acwer bears maintenance cost as an internal operating expense.

## 3. Path A — AMC (Customer-Owned, Under Contract)

**Who it's for:** Customers who bought equipment from Acwer and are within the warranty/AMC window.

**Equipment types sold:**
- Reconditioned units (typically diesel forklifts)
- New units (e.g., Hangcha battery forklifts)

**Warranty coverage:** Usually 6–12 months depending on the age of the forklift at sale. Covers manufacturing defects and major component failures.

**Supporting system:** A **Service Contract Database** tracks every active contract with end dates, warranty status, and chargeable flags.

**Decision logic (two sequential gates):**

1. **Warranty End?** — Is the contract still active?
   - If **NO** (warranty expired) → the job becomes chargeable and gets routed to the invoicing pipeline.
   - If **YES** (still under warranty) → proceed to gate 2.
2. **Does the job contain Wear & Tear items?** — Wear-and-tear parts (tires, LED lights, seats, etc.) are explicitly **excluded** from AMC coverage.
   - If **YES** (contains excluded parts, or damage is from misuse) → chargeable.
   - If **NO** → covered under contract; no external invoice, just contract cost tracking.

**Path A result rule:**
- **If chargeable →** AUTOCOUNT invoice.
- **If not chargeable →** Contract cost tracking only (no customer invoice).

## 4. Path B — Non-Contract Ad-hoc Service (Customer-Owned, Uncontracted)

**Who it's for:** Customers whose forklifts are not under any Acwer contract. These customers must first be **registered and tracked as assets** in the system before work begins.

**Pricing:** Uses a **Dynamic Pricing Model** — **no fixed fee structure.** Every job is priced via quotation.

**Two service flow options:**

**Option 1 — On-site inspection & repair**
- Technician goes to customer's site for inspection.
- If the issue is minor or identifiable on-site → a quotation is issued.
- If the customer accepts and issues a PO → repair is carried out, and the on-site inspection labor fee is **waived** (absorbed into the repair bill).

**Option 2 — Workshop diagnosis required**
- If the issue cannot be diagnosed on-site, Acwer requests customer approval to transport the equipment to the workshop.
- After detailed inspection, a quotation is issued.
- If the customer **declines** the repair after workshop diagnosis, the customer is still charged for:
  - Transportation (to and from the workshop)
  - Labor / diagnostic cost

**Path B result rule:** Full external invoicing — **everything goes to AUTOCOUNT** (parts + labor). There is no "non-chargeable" outcome in Path B; it is always billed to the customer.

## 5. Path C — Acwer-Owned Fleet (Internal / Contract Rental)

**Who it's for:** Equipment that Acwer owns — either used internally or rented out under a fleet maintenance contract.

**Default billing logic:** Generally **non-chargeable** — treated as internal maintenance and tracked under **Internal Maintenance ROI Tracking** (the company absorbs the cost to understand true maintenance cost per fleet unit).

**Automation:** Maintenance is proactive, not reactive. A **Recurring Job Scheduler** automatically generates jobs at monthly, quarterly, or yearly frequencies — this is the "maintenance-focused after-sales" posture.

**Out-of-Scope Validation (Chargeable Exceptions):** Even for Acwer-owned assets, certain conditions flip a job to chargeable:
- **Accident cases** caused by customer negligence
- **Accidents involving external parties**
- **Consumable overage** — e.g., consuming more than 1 set of tires per year is treated as excessive usage and billed

The diagram shows this as an **"Accident Case? / Overage?"** decision gate:
- If **YES** → chargeable → AUTOCOUNT invoice.
- If **NO** → internal cost only → ROI tracking.

**Path C result rule:**
- **If chargeable →** AUTOCOUNT invoice.
- **If not chargeable →** Internal cost (ROI tracking).

## 6. The shared downstream pipeline (all three paths converge here)

After a path is determined, every job — regardless of A, B, or C — flows through the same operational backbone:

**Step 1: Unified Dispatch & Schedule Board**
A single central board where **Admin 1 assigns a technician** to the job. This is the only scheduling surface for all three job types.

**Step 2: Technician App**
The assigned technician receives the job on a mobile app, executes the work on-site or in the workshop, and updates status.

**Step 3: Inventory Dispatch & Scheduling Board**
Runs in parallel with technician work and manages parts flow in two sub-steps:
- **Step 3a — Transfer / Issue Part:** Traces the movement of parts from the central warehouse to the technician's van stock, assigned per job.
- **Step 3b — Part Deduct Upon Job Completion:** Only after **Admin 2 marks the job as finalized** are the parts actually deducted from inventory. This two-step gate prevents premature inventory write-down if a job changes scope mid-execution.

**Step 4: Inventory Database** receives the final deductions and stays in sync with AUTOCOUNT.

## 7. Billing outcomes (terminal nodes)

After the dispatch + inventory flow, the job terminates in one of two buckets:

- **Billable Acceptions → AUTOCOUNT Full Invoice (Parts + Labor).** This covers:
  - Path B (always)
  - Path A when warranty expired or wear-and-tear items are involved
  - Path C when accident/overage exceptions apply
- **Non-Billed Internal Costs → Cost/Maintenance ROI.** This covers:
  - Path A when still under warranty and no excluded parts (contract cost tracking)
  - Path C default case (internal fleet maintenance)

## 8. Reporting

Both terminal branches (billed + non-billed) feed a unified **Report** output that is **printable with or without cost price** — meaning the same underlying job data can be rendered as a customer-facing invoice report (cost hidden) or an internal management report (cost visible) depending on audience.

## 9. Summary logic table

| Path | Asset Owner | Contract | Default Billing | Chargeable Exception | Ends At |
|------|------------|----------|-----------------|---------------------|---------|
| A | Customer | AMC / Warranty active | Non-chargeable (contract tracking) | Warranty expired OR wear-and-tear items OR misuse | AUTOCOUNT if exception; else contract cost tracking |
| B | Customer | None | Always chargeable (quotation-based) | N/A — always billed | AUTOCOUNT (full parts + labor) |
| C | Acwer (fleet) | Internal / rental | Non-chargeable (internal ROI) | Accident, negligence, consumable overage (>1 set tires/yr) | AUTOCOUNT if exception; else internal ROI tracking |

## 10. Key architectural takeaways for another AI

- **Single entry point, three-way split, shared downstream.** Route logic is front-loaded; execution and inventory are unified.
- **Two different database references drive the routing:** the Service Contract Database (for Path A) and a Dynamic Pricing Model (for Path B). Path C is driven by the Recurring Job Scheduler plus an exception validator.
- **Two human gatekeepers:** Admin 1 (dispatches technicians) and Admin 2 (finalizes job, which triggers inventory deduction). This separation-of-duties prevents inventory shrinkage from in-progress jobs.
- **AUTOCOUNT is the only external invoicing system.** Internal costs never touch AUTOCOUNT as invoices but feed a parallel ROI tracking stream.
- **Reports are the only consumer-facing artifact that span both billed and non-billed jobs,** with a cost-visibility toggle for internal vs external audiences.
