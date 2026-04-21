## [2026-04-21] — Completion Gate: "Parts" Photos Incompatible with "No Parts Used"

### Fixed

**Technicians could upload photos tagged "Parts" AND tick "No parts used" AND complete the job — now blocked at both UI and DB layers**
- Client report: the workflow allowed technicians to photograph parts (tagging `category='spare_part'` in `job_media` — the "Parts" option in the photo category dropdown) while simultaneously ticking "No parts were used" and completing the job. Logically contradictory, polluted service history, and undermined the intent of the parts-declaration gate.
- Pre-deploy live DB audit (2026-04-21): 1 In Progress job (`JOB-260406-001`, 1 spare_part photo, no_parts_used=true, 0 parts) and 36 historical Completed / Awaiting Finalization jobs matched the pattern — this was a recurring cheat path, not a theoretical edge case. The historical 36 confirm the rule is justified; they are left as-is because they are already invoiced.
- Fix (DB, authoritative): new migration `supabase/migrations/20260421_block_completion_with_spare_part_photo_conflict.sql` extends `public.validate_job_completion_requirements` with a new check inserted after the existing "approved spare part requests" block. When the transition into `Awaiting Finalization` fires, if the job has any `job_media` row with `category='spare_part'` AND `has_parts` is false AND `service_record.no_parts_used` is true, the trigger raises: *"Cannot complete job: You uploaded photos tagged as 'Parts' but ticked 'No parts used'. Either add the parts you used to the Used Parts list, or re-tag the photos (Condition / Evidence / Other)."* The message explicitly surfaces both escape hatches so techs don't have to guess. Admin/supervisor bypass at the top of the trigger is unchanged — admins can still force-complete if needed. Migration applied to the live Supabase DB this session; post-apply assertion verified the new check text is present in the function body.
- Fix (UI, friendly early-reject): `pages/JobDetail/hooks/useJobActions.ts:handleStatusChange` — added a mirror check that runs just before the existing "approved spare part requests" block. Compares `job.media?.filter(m => m.category === 'spare_part').length` against `(job.parts_used?.length ?? 0) > 0` and `state.noPartsUsed`. Gated on `currentUserRole === 'technician' && !isHelper` so admins aren't UI-gated (they bypass the DB trigger anyway). The toast copy matches the DB exception wording so the technician sees consistent guidance regardless of which layer catches the conflict.
- Fix (docs): `USER_GUIDE.md` completion checklist now carries an explicit warning under the parts-declaration bullet explaining the new rule and the two escape hatches (add parts to Used Parts OR re-tag the photos as Condition / Evidence / Other).
- Scope notes: the 36 historical conflicting jobs are left untouched — they are already Completed/Awaiting Finalization and altering them would disturb invoice state; the trigger only guards future transitions. `JOB-260406-001` (the one In Progress job at risk) will now see the friendly toast on the tech's next Complete tap; a supervisor can force-complete if the tech is blocked in the field. Did not add a client-side prevention at photo-upload time (e.g., "if no_parts_used is ticked, forbid tagging as Parts") — the completion-time gate is sufficient and keeps upload ergonomics simple. Did not rename or remove the `'spare_part'` MediaCategory — that would touch the enum, multiple services, and existing `job_media` rows, and is out of scope. Did not modify helpers' workflow — helpers don't tick no_parts_used themselves on the jobs they're assisting with. The existing "approved spare part requests with zero parts_used" block is untouched — distinct policy, already working.
- Verification: `npm run typecheck` clean. `npm run build` clean. Migration sanity-check assert passed. Manual test path: as technician, upload photo tagged "Parts" → tick "No parts used" → Complete → friendly toast fires with both escape hatches → add a part OR re-tag photo → Complete succeeds. As admin on the same job → completes (admin bypass intact).

## [2026-04-21] — Security: Fleet + Customers Quick Actions Removed + Role-Gated Routes (Defense in Depth)

### Fixed

**Technician dashboard still had "Fleet" and "Customers" quick-action buttons after the permission flag was flipped — buttons removed, route guards strengthened with explicit role checks**
- Client follow-up: after the earlier permission change, technicians could still see "Fleet" and "Customers" buttons on their home dashboard quick-actions grid. Clicking redirected via the route guard, but the presence of the buttons was itself the reported leak. Request: remove the buttons entirely and gate the routes by user role so direct URL typing or bookmarks also fail.
- Root cause: two dashboard components had hardcoded navigation buttons that bypassed the permission layer entirely. `components/dashboards/DashboardPreviewV4/components/TechnicianDashboard.tsx` — the live home page rendered via `PrototypeDashboards` at `/` — had inline `<button onClick={() => navigate('/forklifts')}>` and `<button onClick={() => navigate('/customers')}>` with no role check. `components/dashboards/TechnicianDashboard/components/QuickActionsGrid.tsx` — the older dashboard variant — had the same two entries in its actions array. Both relied on the route-level `Navigate` redirect to catch the click, but the buttons themselves being present was the user-reported problem. Separately, the route guards only checked the permission flag (`devMode.hasPermission('canViewForklifts')`), which can theoretically be flipped back to true through `permissionOverrides` — no explicit role check backing it up.
- Fix: (1) `DashboardPreviewV4/components/TechnicianDashboard.tsx` — deleted the Fleet and Customers button JSX; cleaned up now-unused `MapPin` and `Truck` icon imports; added an inline comment explaining the removal and pointing at the route guards. (2) `TechnicianDashboard/components/QuickActionsGrid.tsx` — removed the two entries from the `actions` array (so the grid now shows only "All Jobs" and "Van Stock"), dropped their color-map entries, removed unused `MapPin` + `Truck` imports, added a component-level comment explaining the restriction. (3) `components/layout/AuthenticatedApp.tsx` — added `const isTechnicianView = navRole === UserRole.TECHNICIAN;` in both the Sidebar component and the `AuthenticatedAppInner` render scope; redefined `canViewForklifts` and `canViewCustomers` in each as `hasPermission(...) && !isTechnicianView`. Every consumer of those variables — sidebar `NavItem`s, route guards for `/forklifts`, `/forklifts/:id`, `/customers`, `/customers/:id`, `/site-map` — now requires BOTH the permission flag AND a non-technician role. Even if a permission override flipped `canViewForklifts` back to true for a technician somehow, the role check still blocks.
- Scope notes: did not touch `canManageInventory` — already correct and inventory's gating is role-independent (van stock is a separate route). Did not modify `AccountantQuickActions`, `ServiceAdminDashboard`, `NotificationBell`, or `AssetDashboard` Fleet navigations — those components are never rendered for technicians, so they pose no leak; the route guard catches them if anything accidentally directs a technician there. Dev-mode "preview as technician" now correctly mirrors the blocked view so admins testing the technician experience see exactly what a real technician sees.
- Verification: `npm run typecheck` clean. `npm run build` clean. Manual test paths: (a) real technician logs in → home dashboard shows only Jobs + Van Stock quick actions, no Fleet or Customers button; (b) typing `/forklifts` in URL redirects to `/`; (c) CommandPalette search for "fleet" returns no match; (d) admin dev-mode preview as technician → same blocked view. No UI surface accessible to a technician can reach the Fleet or Customer pages.

## [2026-04-21] — Security: Fleet Page Hidden from Technicians (Rental + Pricing Restricted)

### Fixed

**Technicians could see Fleet tab exposing rental rates and customer rental details — now fully blocked**
- Client report (URGENT): the Fleet section in the Technician App was showing rental details and monthly rental pricing that must stay restricted. Follow-up: block the whole Customer and Fleet pages for technicians — same treatment as Inventory (which is already blocked) — while keeping My Van Stock accessible (that's the technician's own stock, not the main warehouse).
- Before: `canViewCustomers: false` and `canManageInventory: false` for the TECHNICIAN role were already gating `/customers`, `/customers/:id`, `/site-map`, and `/inventory` correctly. The gap was `canViewForklifts: true` — technicians saw the Fleet tab in the sidebar, could browse `/forklifts` and `/forklifts/:id`, and `FleetTab.tsx` exposes `monthlyRentalRate`, `rentalNotes`, and `rentalSite` in the rental edit and assignment flows. Click-through from a job detail's forklift name also opened the full ForkliftProfile page.
- Fix: single flag flip in `types/user.types.ts` — `canViewForklifts: true` → `false` for the `TECHNICIAN` role. No new routes, no new components, no new checks. All enforcement was already wired through `hasPermission('canViewForklifts')`: desktop sidebar NavItem (`AuthenticatedApp.tsx:190`), mobile drawer, route guards for `/forklifts` and `/forklifts/:id` (`AuthenticatedApp.tsx:533-534`), and the Command Palette (`CommandPalette.tsx:55`). `/my-van-stock` is protected by its own explicit UserRole-list guard (`AuthenticatedApp.tsx:545`), independent of `canViewForklifts`, so technicians still see it.
- Added an inline comment next to the flipped flag explaining the rental + pricing visibility reasoning, so the next person reading the TECHNICIAN permissions block understands the intent (not just the value).
- Scope notes: did not change `canViewCustomers` or `canManageInventory` — they were already at the target value. Did not change `canViewServiceRecords: true` — service records are scoped to the technician's own jobs, not a fleet-wide browse. The mobile bottom nav for TECHNICIAN already excluded `/forklifts`, unaffected. Dev-mode "preview as technician" correctly reflects the new state, so admins testing the technician view will see the Fleet tab hidden.
- Verification: `npm run typecheck` clean. `npm run build` clean. Manual test: log in as technician (or use Dev Mode → Preview as Technician) → "Fleet" no longer in the sidebar → typing `/forklifts` in the URL redirects to Home → Command Palette search for "fleet" returns no match → clicking a forklift link on a job detail lands on Home (forklift name still displays on JobDetail itself; only the profile page and the Fleet list are gated).

## [2026-04-21] — Hourmeter ≥ 1 enforced at Start + Broken-Meter Remark Convention

### Changed

**Start Job modal now rejects empty and zero hourmeter values; broken-meter fallback requires a remark**
- Client report: technicians were entering "0" or skipping hourmeter when the meter was broken, silently losing data. Forklift history then showed 0 with no context, polluting service-prediction and amendment tooling.
- Policy decision: hourmeter is mandatory with a minimum of **1**. If the meter is broken or the reading is unavailable, the tech must enter `1` and add a remark explaining why. This is system-enforced — not advisory — so the unit's history always carries a numeric reading plus a reason when the reading is 1.
- Implementation: the Start Job modal's hourmeter input now has `min={1}` and a greyed italic hint below it: *"If the hourmeter is broken or reading is unavailable, enter 1 and add a remark below stating the meter is broken."* When the input value is exactly "1", a conditional "Broken meter remark *" textarea appears; the Start Job button stays disabled until a non-empty remark is entered. An inline hint next to the Start button tells the technician exactly what's missing ("hourmeter must be ≥ 1", "broken meter remark required", etc.). On submit, the `startJobWithCondition` service appends a structured entry `[Broken Hourmeter — DD MMM YYYY — TECH]: <reason>` to `jobs.notes` — same format as Continue Tomorrow — so the remark is visible wherever the job's notes are surfaced.
- The "reading must be ≥ forklift's current reading" floor is intentionally relaxed when the reading is `1` — otherwise a unit with any history would reject the broken-meter sentinel. All other readings still enforce the monotonic floor.
- Files touched: `pages/JobDetail/hooks/useJobDetailState.ts` (new `brokenMeterNote` state), `pages/JobDetail/components/JobDetailModals.tsx` (StartJobModal input gate + conditional remark textarea + rewritten Start button disabled logic), `pages/JobDetail/JobDetailPage.tsx` (wires state/setter to modal props), `pages/JobDetail/hooks/useJobActions.ts` (handler validates `hourmeter ≥ 1` and requires remark when value is 1), `services/jobChecklistService.ts` (accepts optional `brokenMeterNote`, appends to `jobs.notes` on save, relaxes the floor for value 1).
- Scope notes: FTS + Repair remain fully hourmeter-exempt per the earlier `HOURMETER_EXEMPT_JOB_TYPES` helper — the hourmeter block is hidden entirely for those job types, and the `min=1` rule does not apply. Did not add a DB CHECK constraint on `jobs.hourmeter_reading >= 1` — the policy is UI-enforced per the client's stated scope ("Start Job modal only"), and adding a DB floor would break the grandfathered FTS jobs currently sitting at `hourmeter_reading = 0`. Did not touch the "edit hourmeter" quick-input row in the in-progress banner — the Start flow was the primary leak the client reported; the edit row can be hardened in a follow-up if the same pattern reappears there. Did not backfill or migrate existing `hourmeter_reading = 0` rows.
- Verification: `npm run typecheck` clean. `npm run build` clean. Manual test path: open non-FTS/non-Repair job as technician → Start Job → Step 2 → (a) empty input: Start button greyed with "hourmeter required"; (b) value "0": greyed with "hourmeter must be ≥ 1"; (c) value "1" without remark: conditional textarea visible, Start greyed with "broken meter remark required"; (d) value "1" + remark: Start enables, `jobs.notes` gains `[Broken Hourmeter — DD MMM YYYY — TECH]: <reason>` after submit; (e) normal value like "5230": Start enables normally. FTS/Repair flow unchanged (hourmeter block hidden).

## [2026-04-21] — Repair Hourmeter Exemption + HOURMETER_EXEMPT_JOB_TYPES Marker + Layering Contract

### Changed

**Repair jobs no longer require hourmeter at Start or Complete — matches FTS behaviour, single source of truth in `isHourmeterExemptJob`**
- Client report: Repair jobs were stuck on Complete with a "Hourmeter" blocker chip, same symptom as the earlier FTS bug. Additionally, the user asked for a label/marker so future work on this area doesn't repeat the 3-session debug loop the FTS fix took.
- Root cause: the 2026-04-20 FTS exemption was implemented as inline `isFieldTech = job.job_type === FIELD_TECHNICAL_SERVICES` in 5 separate UI files (`useJobActions`, `JobDetailPage`, `JobHeader`, `MobileTechnicianWorkflowCard`, `JobDetailModals`). Each file owned its own copy of the exemption list, so extending to Repair would require 5 synchronized diffs — exactly the drift pattern that caused the original bug. DB trigger `validate_job_completion_requirements` does not check hourmeter at all, so no migration is needed; the policy lives entirely at the UI layer.
- Fix: added `isHourmeterExemptJob(jobType)` helper in `pages/JobDetail/utils.ts` — single source of truth, returns true for `FIELD_TECHNICAL_SERVICES` and `REPAIR`. Every UI hourmeter gate now consumes this helper instead of an inline check. To make the exemption discoverable by grep, the helper's JSDoc and every call-site comment carry the tag `HOURMETER_EXEMPT_JOB_TYPES`. Adding a new exempt job type in the future is a one-line change in the helper; the grep tag surfaces every consumer that needs re-review.
- Specific edits: (1) `pages/JobDetail/utils.ts` — new `isHourmeterExemptJob` + JSDoc documenting the layering contract. (2) `pages/JobDetail/hooks/useJobActions.ts:199-218` — `handleStartJobWithCondition` skips the hourmeter parse/validate for Repair, passing through the forklift's reading like FTS. (3) `useJobActions.ts:338-352` — `handleStatusChange` drops the hourmeter-required toast and the start-reading-comparison toast when Repair. (4) `pages/JobDetail/JobDetailPage.tsx` — `hourmeterRequired` derived from the helper; `StartJobModal` now receives `skipHourmeter={isHourmeterExemptJob(job?.job_type)}` so Repair hides the input at Step 2. (5) `pages/JobDetail/components/JobHeader.tsx` — sticky Complete button + tooltip consume the helper. (6) `pages/JobDetail/components/MobileTechnicianWorkflowCard.tsx` — "Hourmeter" blocker chip skipped via the helper; removed the now-unused `JobType` import. (7) `services/jobStatusService.ts` — header comment upgraded to declare the full layering contract (`service = CRUD only, never add job-type throws here`).
- Documentation: `CLAUDE.md` gains a "Job-type validation layering" section — encodes the three-layer contract (UI friendly gates / service CRUD-only / DB-trigger authoritative), lists the `HOURMETER_EXEMPT_JOB_TYPES` grep recipe, and prescribes the "touch all three layers in one PR" rule. Future sessions load this context automatically and won't have to re-derive the pattern.
- Scope notes: kept the checklist exemption as explicit `!== REPAIR && !== FTS` checks in `handleStatusChange` and the Condition Checklist card render guard — intentionally not merged into `isHourmeterExemptJob` because hourmeter and checklist exemptions may diverge for a future job type. Did not touch the DB trigger — it already exempts Repair + FTS from the checklist path, and never checked hourmeter. Did not touch the `isRepairJob` prop on `StartJobModal` — it remains the checklist-hide signal; `skipHourmeter` is the separate hourmeter-hide signal.
- Verification: `npm run typecheck` clean. `npm run build` clean. `grep -rn HOURMETER_EXEMPT_JOB_TYPES pages/ services/ CLAUDE.md` returns the helper + every call-site annotation + the CLAUDE.md section. Remaining manual verification: tech opens a Repair job on mobile or desktop → Start Job modal Step 2 has no hourmeter input → enters In Progress after before photo → Complete button enables once after photo + both sigs + parts declared (or "no parts" ticked); no "Hourmeter" chip in the blocker list.

## [2026-04-20] — Cleanup: Remove stray debug script

### Fixed
- Removed `.tmp_check.js` stray debug script left from FTS troubleshooting session.


## [2026-04-21] — Field Technical Services: Remove Service-Layer Hourmeter + Forklift Gates

### Fixed

**FTS Complete button silently failed with "Failed to update status" toast — service-layer hourmeter gate blocked status transition even after UI + DB trigger already exempt FTS**
- Client report: FTS job (JOB-260420-035) still could not complete. Every earlier session (2026-04-16, 2026-04-20) had already exempted FTS from hourmeter + checklist in the Start Job modal, the DB completion trigger, the mobile workflow card, the desktop in-progress banner, the sticky header Complete button, and the Condition Checklist card. The technician had added the after photo, both signatures, and declared parts — still blocked.
- Root cause (verified against the live DB via the Supabase pooler): the job sits at `status='In Progress'`, `forklift_id=null`, `hourmeter_reading=0`. The blocker was a service-layer gate in `services/jobStatusService.ts:37-40` — `updateJobStatus` threw `'Cannot complete job: Hourmeter reading is required'` whenever `hourmeter_reading` was falsy. For FTS, the Start flow now passes the forklift's reading through verbatim (0 when there is no forklift), so FTS jobs land at `hourmeter_reading=0` by design. `!0 === true` → the service throws before PostgREST is even called, `handleStatusChange`'s catch surfaces the error as "Failed to update status" — the generic toast the client was seeing. Sibling gate at line 32-34 also forced `forklift_id` on every IN_PROGRESS transition through `updateJobStatus`, which would break any admin rollback / un-finalize / bulk path for forklift-less FTS jobs. Critically: the live `validate_job_completion_requirements` DB trigger (which is the authoritative completion contract) never checks hourmeter at any point — the JS gate was stricter than the actual server contract and had simply drifted.
- Fix: removed both FTS-blind gates from `updateJobStatus`. Kept the universal `assigned_technician_id` check on IN_PROGRESS and the signature check on AWAITING_FINALIZATION (mirrors what the DB trigger enforces, gives a friendlier early-reject than a raw Postgres RAISE). Added a comment calling out why hourmeter + forklift validation belongs at the UI layer (per-job-type branching in `handleStatusChange`) and the DB layer (authoritative trigger), not in the service.
- Scope notes: did not touch `handleStatusChange` in `useJobActions.ts` — its FTS + helper branching is already correct and remains the single source of friendly UI-side gating. Did not touch `startJobWithCondition` — it validates hourmeter ≥ forklift's reading only when a forklift exists, which is already FTS-safe. Did not touch the DB trigger. Did not touch `BulkSignOffModal` — it funnels to `updateJobStatus` and now inherits the fix, meaning bulk-completed FTS jobs no longer error with the misleading "check hourmeter" warning.
- Verification: `npm run typecheck` clean. Queried live DB to confirm JOB-260420-035 state (FTS, `forklift_id=null`, `hourmeter_reading=0`, both signatures present, 2 `after` photos, In Progress) — every DB-trigger precondition already satisfied, only the JS gate was blocking. Remaining manual verification: that tech taps Complete → expect "Status updated to Awaiting Finalization" toast, redirect to dashboard. Also verifies for any future forklift-less FTS job going through the admin rollback path into IN_PROGRESS.

## [2026-04-20 21:46] — Field Technical Services: Desktop UI Complete button + header button + checklist card mirroring

### Fixed

**FTS hourmeter/checklist exemption missing from desktop Complete button, header button, and Condition Checklist card**
- Desktop UI inconsistency: the desktop in-progress page still gated the Complete button and checklist card visibility on the raw `statusFlags.hasHourmeter` flag, even though the completion logic and mobile UI already exempt FTS from hourmeter. This left the desktop Complete button disabled with a "Hourmeter needed" blocker for FTS jobs.
- Root cause: three separate UI consumers of `statusFlags.hasHourmeter` (`JobDetailPage.tsx:111` for completionBlocked, `JobHeader.tsx:174-181` for the sticky Complete button, and `JobDetailPage.tsx:224` for the Condition Checklist card) were still checking the raw flag without FTS exemption. The completion handler (`useJobActions.ts:341`) already exempts FTS from hourmeter, but the UI-side guards were not mirrored.
- Fix: (1) `JobDetailPage.tsx:109-116` — added local `isFieldTechJob` flag and extracted `hourmeterRequired = !isFieldTechJob && !statusFlags.hasHourmeter`, threading it into `completionBlocked` and the "Hourmeter needed" amber chip. (2) `JobDetailPage.tsx:226` — expanded the Condition Checklist card render guard to hide for both `REPAIR` and `FIELD_TECHNICAL_SERVICES`, matching the exemption pattern in `utils.ts:getMissingMandatoryItems`. (3) `JobHeader.tsx:75-78` — computed `isFieldTech` and `hourmeterRequired` locally, substituting them into the sticky Complete button's disabled condition, className, and tooltip string.
- Scope notes: did not modify `statusFlags.hasHourmeter` itself — that flag is used elsewhere (e.g., hourmeter edit UI) where the raw signal is meaningful. Kept per-consumer exemptions to avoid overloading the flag. Did not touch helpers (not reported — they already go through the mobile card which handles FTS correctly).

## [2026-04-20 21:37] — Field Technical Services: Skip Hourmeter + Checklist at Job Start

### Fixed

**FTS hourmeter/checklist exemption missing from desktop Complete button, header button, and Condition Checklist card**
- Client follow-up (same session): after the mobile Complete-button fix, asked to audit everywhere else the FTS exemption was not mirrored. Found three additional unmirrored gates on the desktop path.
- Root cause: every UI consumer of `statusFlags.hasHourmeter` needs its own FTS exemption because the flag is computed in `utils.ts:174` as raw `!!job.hourmeter_reading` — which is false for FTS since we pass the forklift's current reading (often 0 or absent) rather than a tech-entered value. Three spots still gated on the raw flag: (a) `JobDetailPage.tsx:111` which derives `completionBlocked` for the in-progress banner's green Complete button and its "Hourmeter needed" amber chip; (b) `JobHeader.tsx:174-181` which disables the sticky header's Complete button and its tooltip; (c) `JobDetailPage.tsx:224` which hid the "Condition Checklist" collapsible card for Repair only, leaving it visible (and showing "0/16 items checked") for FTS where checklist has been skipped entirely.
- Fix: extracted a single `hourmeterRequired = !isFieldTech && !hasHourmeter` local in both `JobDetailPage` and `JobHeader` and substituted it everywhere the raw `!hasHourmeter` appeared (disabled condition, className branch, tooltip priority chain, blocker chip). Expanded the Condition Checklist card render guard on `JobDetailPage.tsx:226` to `job_type !== REPAIR && job_type !== FIELD_TECHNICAL_SERVICES`, mirroring the existing exemption in `utils.ts:getMissingMandatoryItems`.
- Scope notes: did not modify `utils.ts:hasHourmeter` itself — the raw boolean is still consumed by the hourmeter-edit UI block where the original signal (was a reading ever recorded?) is still the right question. Per-consumer exemption keeps the semantic cleaner than overloading one flag. Did not extend helper exemption on `JobHeader`'s Complete button (not reported — helpers use the mobile card path which already handles their case).

**FTS "Complete Job" button perma-disabled on mobile after the start-flow exemption**
- Client report (follow-up in the same session): once the Start Job modal stopped collecting hourmeter for Field Technical Services, technicians found the mobile Complete Job button locked with a "Hourmeter" chip in the blocker list. They had done everything else (after photo, both signatures, parts declaration) and could not finish the job.
- Root cause: `MobileTechnicianWorkflowCard.tsx` builds its blocker list from `statusFlags.hasHourmeter`, which is `!!job.hourmeter_reading`. FTS jobs now record 0 (or the forklift's existing reading — 0 when there's no forklift), so `hasHourmeter` is always false and "Hourmeter" stays in `blockers`, disabling the Complete button. The desktop / `handleStatusChange` completion path was already exempt from hourmeter for FTS; the UI-side blocker was a second, unmirrored check that slipped through when the exemption was originally wired.
- Fix: added an `isFieldTech` check in `MobileTechnicianWorkflowCard.tsx` and gated the "Hourmeter" blocker entry on `!isFieldTech && !statusFlags.hasHourmeter`, mirroring the exemption pattern already in `useJobActions.ts`. Imported `JobType` for the comparison. The after-photo, signature, and parts-declaration blockers still apply to FTS as before.
- Scope notes: did not modify `statusFlags.hasHourmeter` itself — that flag is still consumed elsewhere for rendering the hourmeter edit UI where the raw signal matters. Did not extend helper exemption on the blocker list (not reported this session).

**Start Job modal forced hourmeter and checklist on Field Technical Services jobs**
- Client report: for Field Technical Services (FTS) jobs — on-site consultation, parts collection, charger/battery install — technicians should not have to fill hourmeter or a condition checklist. The completion flow was already exempt since 2026-04-16, but the Start Job modal still demanded both. Technicians either typed a throwaway hourmeter value or used the "Check All" shortcut, neither of which produced useful data.
- Root cause: `StartJobModal` was driven by a single `isRepairJob` prop that hid only the checklist (Repair jobs still need hourmeter). FTS reused no flag at Step 2, so the hourmeter input stayed mandatory and the checklist stayed visible. `handleStartJobWithCondition` in `pages/JobDetail/hooks/useJobActions.ts` also unconditionally parsed and range-validated `startJobHourmeter`.
- Fix (three locations): (1) `pages/JobDetail/components/JobDetailModals.tsx` — added `skipHourmeter?: boolean` prop; hides the hourmeter input block and removes hourmeter from the Start button's disabled condition and hint text. Step 2 header text now distinguishes Confirm Start / Checklist / Hourmeter / Hourmeter & Checklist based on `skipHourmeter` + `isRepairJob`. (2) `pages/JobDetail/JobDetailPage.tsx:338` — now passes `isRepairJob={REPAIR || FIELD_TECHNICAL_SERVICES}` (reusing the existing checklist-hide path) and `skipHourmeter={FIELD_TECHNICAL_SERVICES}`. (3) `pages/JobDetail/hooks/useJobActions.ts:199-218` — when the job is FTS, skip the hourmeter parse/validate and forward `job.forklift?.hourmeter || 0` to `startJobWithCondition` so the `jobs.hourmeter_reading` column stays numerically consistent for downstream queries without requiring user input.
- Scope notes: did not rename `isRepairJob` to a more generic `skipChecklist` — two call sites touched, rename would churn the diff. Did not change the DB trigger: `validate_job_completion_requirements` already exempts FTS from checklist and has never enforced hourmeter server-side. Did not touch before-photo requirement — FTS techs still take at least one before photo, which is the only remaining gate for starting an FTS job. Did not touch Repair's Step 2 behaviour.
- Verification: `npm run typecheck` clean. Manual test path: create an FTS job → open as technician → tap Start Job → Step 1 take a before photo → Step 2 should render with only a Back/Cancel/Start Job row (no hourmeter field, no checklist grid) → Start Job transitions to In Progress.

## [2026-04-19]

### Fixed
- four job request system bugs — skilled tech visibility, approval dispatch, delete duplicates, rejection photo constraint (`37f58f6`)

### Documentation
- docs(changelog): update weekly magic docs (`8eef81c`)

### Chores
- auto-commit session changes (`cbd0544`)
- auto-commit session changes (`580ad37`)
- auto-commit session changes (`d90839d`)
- auto-commit session changes (`74e6bdc`)

## [2026-04-16] — Helper Technician: Exempt from Completion Gates, Notifications on Every Assign Path

### Fixed

**Helpers were blocked from completing jobs by hourmeter + checklist requirements**
- Client report: the helper function is broken — helpers cannot complete a job because the system demands a hourmeter reading and a filled-in condition checklist from them. Per the client, the helper role is intentionally light: a helper assists the lead technician, and the hourmeter reading + checklist are produced by the lead on a single canonical record.
- Root cause: `handleStatusChange` in `pages/JobDetail/hooks/useJobActions.ts` gated completion on `!isFieldTech` only. The parts-declaration gate at line 356 already excluded helpers via `!state.isCurrentUserHelper`, but the hourmeter-required gate (line 329), the hourmeter-range gate (line 334), and the missing-checklist gate (line 380) never got the same exemption when the helper role was introduced. So helpers hit "Hourmeter reading required" / checklist-warning toasts on every completion attempt.
- Fix: extracted `state.isCurrentUserHelper` into a local `isHelper` flag at the top of the `AWAITING_FINALIZATION` branch and added `!isHelper` to the three gates. Helpers now complete jobs without hourmeter/checklist blockers; the lead technician still enforces them as before.

**Helpers and admins silently not notified when a helper is assigned**
- Client report: notifications for helper assignment are not received — neither the helper (who should know they've been added to a job) nor the admin/lead tech (who wants visibility that help is en route).
- Root cause: two paths reach `assignHelper()` but notification side-effects only lived on one. When an admin approves a technician's "Request Helper" request, `approveAssistanceRequest` in `services/jobRequestApprovalService.ts` called `assignHelper` and then separately called `createNotification` for the helper — that worked. When an admin directly assigned a helper via the JobDetail "Assign Helper" modal, `handleAssignHelper` called `MockDb.assignHelper` which hit `services/jobAssignmentBulkService.ts:assignHelper()` — that function only INSERTed into `job_assignments` and returned. Zero notifications fired on the direct-assign path, and the lead technician was never notified on either path. Verified on the live Supabase DB: only 1 assistance request exists in the system (still pending); 2 `helper_request` admin notifications were fired on 2026-04-17 confirming the `createJobRequest → notifyAdminsOfRequest` path works — the gap is the assignment side.
- Fix: pushed helper notification down to the lowest level. `assignHelper()` now, after a successful INSERT, fetches the job title and lead technician, then fires a `JOB_ASSIGNED` notification ("Helper Assignment") to the helper and a `JOB_UPDATED` notification ("Helper Assigned") to the lead technician (skipped if lead is missing or equals the helper). Both paths — request-approval and direct-assign — now surface the assignment to both parties. The notification block is wrapped in its own try/catch so notification failure cannot roll back the already-committed assignment. Removed the now-duplicate helper notification from `approveAssistanceRequest` along with the unused `jobTitle` local, `jobs` fetch, and `NotificationType` / `createNotification` imports. The "your request was approved" notification to the original requester (`notifyRequestApproved`) is kept — it's semantically distinct from "you've been assigned". The 5-minute dedup inside `createNotification` (user_id + type + reference_id) protects against concurrent writes.
- Scope: did not notify admins when a helper is assigned (admin is always the one clicking Assign or Approve — self-notification is noise). The admin-notify on REQUEST creation is unchanged and already working. Did not exempt helpers from after-photo or signature requirements — the client did not call those out, and the lead tech owns the completion artifacts regardless.

## [2026-04-16] — Field Technical Services, Auto-Populate Used Parts, Completion Validation

### Added

**New "Field Technical Services" job type replacing Minor Service and Courier**
- Client request: Shin asked to consolidate "Minor Service" and "Courier" into a single "Field Technical Services" type covering charger/battery installation, parts collection from suppliers, on-site consultation, and customer training. No hourmeter tracking or checklist required for this type.
- Implementation: Added `FIELD_TECHNICAL_SERVICES = 'Field Technical Services'` to the `JobType` enum (`types/job-core.types.ts:43`). The legacy `MINOR_SERVICE` and `COURIER` values remain in the enum for backward compatibility with existing jobs, but are excluded from the new `CREATABLE_JOB_TYPES` constant used by the Create Job form (`pages/CreateJob/CreateJobPage.tsx:186`), so only new job types appear in the dropdown.
- Completion exemptions: Field Technical Services is exempt from both hourmeter validation and mandatory checklist in the frontend completion handler (`pages/JobDetail/hooks/useJobActions.ts:327`) and in the database trigger `validate_job_completion_requirements()`. This matches the exemption pattern already used for Repair jobs.
- UI updates across 13 files: teal badge color in JobHeader, JobBoard, and TechnicianDashboard; new entry in technician filter bar, KPI breakdown, and service report PDF checkbox row; duration alert threshold set at 3h warning / 4h alert.
- DB migration `20260416_field_technical_services_and_parts_validation.sql` adds the value to `jobs_job_type_check` constraint.

**Auto-populate Used Parts from approved spare part requests**
- Client request: Shin asked if approved parts could automatically appear in the Used Parts section so technicians only need to verify quantities instead of manually re-adding each part.
- Implementation: The existing `approveSparePartRequest()` and `issuePartToTechnician()` functions in `services/jobRequestApprovalService.ts` already insert into `job_parts` when parts are approved. Added `auto_populated: true` flag to these inserts, backed by a new `auto_populated BOOLEAN DEFAULT FALSE` column on the `job_parts` table.
- UI: `PartsSection.tsx:113` renders auto-populated parts with a lock icon and "Auto" badge. Edit, delete, and price-change buttons are hidden for these parts — technicians can view them but cannot modify or remove them.

### Fixed

**Completion allowed with empty Used Parts despite approved spare part requests**
- Client report: Shin reported that technicians and admins can complete a job even when parts have been marked "Approved" but no parts appear in the Used Parts section.
- Root cause: The completion validation in `useJobActions.ts:352` checked `parts_used.length > 0 || noPartsUsed` but never cross-referenced the `job_requests` table. A technician could toggle "No parts used" and complete the job even when spare part requests with status `approved` or `issued` existed. The database trigger `validate_job_completion_requirements()` had the same gap.
- Fix: Added a new validation block in `handleStatusChange` (`useJobActions.ts:371`) that queries `state.jobRequests` for spare_part requests with `approved` or `issued` status. If any exist and `parts_used` is empty, completion is blocked with Shin's requested error message. The same check was added to the database trigger as a server-side backstop.
- Error message: "Parts have been approved for this job. Please ensure all used parts are added to the 'Used Part' section before completing."

## [2026-04-15] — Hide Customer Names, Fix Customer Search, Notification Overhaul

### Fixed

**SEAGULL customer invisible in Create Job search**
- Client report: Admin unable to find customer "SEAGULL" when creating a New Job Order, even though the profile exists in the system.
- Root cause: `services/customerService.ts:searchCustomers()` filtered `.eq('is_active', true)` on both code paths (empty query + text search). SEAGULL's record has `is_active = false`. The bulk debtor import script (`scripts/import_debtors.cjs`) deactivated 1,814 of 2,184 customers — any unmatched customer became permanently invisible in every dropdown search, with no UI to reactivate them.
- Fix: removed the `is_active` filter from `searchCustomers()`, added `is_active` to the selected fields and return type, ordered results with active customers first. Added `is_active: boolean` to the `Customer` TypeScript interface (`types/customer.types.ts:19`). `CreateJobPage.tsx:42` now appends "(Inactive)" to the Combobox label for deactivated customers, so admins can see the status at a glance while still being able to select the customer.
- Did not add a reactivation UI — that's a separate feature request.

### Added

**Notification system overhaul: dismiss, history page, auto-cleanup**
- Client report: notifications act like a static log. Even after clicking "View", the notification stays in the list, the badge doesn't update visually, and old notifications stack up, pushing important alerts out of view.
- Feature 1 — View & Dismiss: `NotificationBell.tsx` dropdown now shows only unread notifications (was: all 50 regardless of read status). Clicking a notification or the checkmark dismiss button marks it as read via the existing `markAsRead()` handler, which removes it from the dropdown and decrements the badge count. "Mark all read" clears the entire dropdown.
- Feature 2 — Notification History: new `pages/NotificationsPage.tsx` at route `/notifications` provides a full-page view of all notifications (read + unread) with Unread/All tab toggle, paginated loading (30 per page with "Load more"), and click-to-navigate to the referenced resource (job, forklift, leave). The existing dead "View all notifications" links in `NotificationBell.tsx` footer and `DashboardNotificationCard.tsx:255` now correctly navigate to this page.
- Feature 3 — Auto-Cleanup: DB migration `20260415_notification_auto_cleanup.sql` adds `cleanup_old_notifications()` function that deletes read notifications where `read_at < NOW() - INTERVAL '30 days'`. Hooked into `run_escalation_checks()` which runs every 5 minutes via the existing `escalation-checks` pg_cron schedule. No new cron entry needed. Applied to live DB.
- Note at bottom of history page informs users: "Read notifications are automatically cleared after 30 days."

### Changed

**Customer names hidden from technician role across all views**
- Client request: Clint asked that technicians should not see customer names anywhere in the app — names should appear blank by default.
- Implementation: Added a new `canViewCustomerName` permission to the role-based permission system (`types/user.types.ts:99`), set to `false` for Technician and `true` for all other roles. This follows the same pattern as the existing `canViewPricing` permission that already hides pricing from technicians.
- Job Board: Customer names are masked in both card view (`JobCard.tsx:201`) and list view (`JobListRow.tsx:172,318`). The "Customer" column header in desktop list view (`JobListTable.tsx:68`) is conditionally hidden for technicians so the column doesn't take up space.
- Job Detail: The `CustomerAssignmentCard.tsx:73` header shows a generic "Customer" label instead of the customer name. Account numbers are also hidden. The customer name pre-fill in `SignaturesCard.tsx:25` and `BulkSignOffModal.tsx:56` is now blank — technicians must have the customer fill in their own name during signature collection.
- Site Sign-Off: The `SiteSignOffBanner.tsx:57` groups jobs by site with a generic "Site" label instead of the customer name.
- Customer page access: Technician's `canViewCustomers` permission flipped to `false` (`user.types.ts:238`), which blocks access to the Customers page, Customer Profile, Site Map, and the customer search in the command palette.
- Dev mode: The new permission is available in both DevMode override panels (PermissionOverrides + PermissionModal) under the "Customers" group for QA testing.
- Scope: Admin-only pages (PendingConfirmations, DeletedJobsSection, ServiceRequestsQueue, AutoCountExport) were not modified — technicians cannot access them. No database changes required — this is a client-side permission enforcement.

## [2026-04-14] — Fix: Job Request System — Four Bugs

### Fixed

**Skilled technician and assistance requests invisible to Admin 1 (Service)**
- Client report: TECH 19 requested a skilled technician for Job #JOB-260414-010 but the Admin could not see it anywhere on the admin screen.
- Root cause: `PartRequestsPage.tsx:95` filters `.eq('request_type', 'spare_part')`, which is correct for Admin 2 (Store). But there was no equivalent dashboard for Admin 1 (Service) to see `skillful_technician` and `assistance` requests. These request types are service operations (job reassignment, helper assignment) that belong to `admin_service`, not `admin_store`.
- Fix: created `pages/ServiceRequests/ServiceRequestsQueue.tsx`, a new dashboard component that fetches pending `skillful_technician` and `assistance` requests. For skilled tech requests, admins see an "Acknowledge" button that calls `acknowledgeSkillfulTechRequest()`. For assistance requests, admins see a technician picker (backed by `getTechnicians()`) plus an "Assign" button that calls `approveAssistanceRequest()`. Both types have a reject button. The component renders in the Approvals tab of `JobsTabs.tsx` above the existing `StoreQueue`, but only for `admin`, `admin_service`, and `supervisor` roles — `admin_store` is excluded since they can't reassign jobs (`canAssignJobs: false`). Self-hides when no pending service requests exist.

**Admin approval of non-spare-part requests fails silently**
- Client report: Admin tried to approve and assign a technician for the skilled tech request, but the action failed.
- Root cause: `useJobRequestActions.ts:59` always called `approveSparePartRequest()` regardless of `request.request_type`. For non-spare-part requests, `ApproveRequestModal:354` passes `onApprove([], notes)` — an empty items array. `approveSparePartRequest` at `jobRequestApprovalService.ts:33` immediately returns `false` because `items.length === 0`. The correct service functions — `acknowledgeSkillfulTechRequest()` and `approveAssistanceRequest()` — were implemented and exported but never called from any UI handler.
- Fix: rewrote `handleApproveRequest` in `useJobRequestActions.ts` to dispatch by `request.request_type`: `spare_part` routes to `approveSparePartRequest()`, `skillful_technician` routes to `acknowledgeSkillfulTechRequest()`, `assistance` routes to `approveAssistanceRequest()` with the helper tech ID passed via the items array. Added `currentUserRole` to the dependency array since it's used in the spare_part path.

**Technicians cannot delete duplicate part requests caused by repeated tapping**
- Client report: app lag causes techs to tap "submit" multiple times, creating duplicate requests. No way to clean them up.
- Fix: three layers. (1) Added `deleteJobRequest()` to `services/jobRequestService.ts` — verifies ownership (`requested_by === userId`) and pending status before deleting. (2) Added a "Delete" button (Trash2 icon) in `JobRequestsSection.tsx` next to the existing "Edit" button, same guard: own request + pending status + technician role. Uses optimistic local state removal for instant UI feedback. (3) DB migration `20260414_allow_tech_delete_own_pending_requests.sql` updates the RLS delete policy to allow technicians to delete their own pending requests (previously only Admin/Supervisor could delete).

**Job rejection fails with `job_media_category_check` constraint violation**
- Client report: rejecting a job fails with error "new row for relation job_media violates check constraint job_media_category_check".
- Root cause: `services/rejectionPhotoUpload.ts:147` inserts with `category: 'rejection_proof'`. The TypeScript type `MediaCategory` in `types/common.types.ts:30` includes this value. But the DB check constraint (from `database/historical/migrations/add_job_media_category.sql:30`) only allows `'before','after','spare_part','condition','evidence','other'`. The `rejection_proof` value was added to the TypeScript type when the rejection photo feature was built but was never added to the database constraint.
- Fix: DB migration `20260414_fix_job_media_category_constraint.sql` drops and recreates the constraint with `rejection_proof` included. Idempotent, production-safe.

## [2026-04-12]

### Added
- shorten job_number format to JOB-YYMMDD-NNN (14 chars) (`4581f6c`)
- 15-min no-reply re-alert for technician job assignments (`1417aff`)
- confirm show/hide prices when generating service report (`02ad353`)
- feat(jobs): admin 1 can edit job description + fix external forklift creation (`0b9efe4`)

### Fixed
- fix(db): exempt Repair jobs from checklist requirement in completion trigger (`b342559`)
- disambiguate job_media embeds after technician_rejection_photo_id FK (`132f1fa`)
- JobBoard list header/row column width drift after job# widening (`c809ca8`)
- JobDetailPage crash on null job (post-purge regression) (`8a1682b`)
- job# column overflow + ConfirmationStatusCard mobile overflow (`af201b4`)
- unblock tech job rejection + require on-site photo proof (`29105f1`)
- require parts declaration before lead technician can complete job (`48fa273`)
- fix(jobs): repair jobs no longer blocked by checklist on completion (`a7cf894`)
- fix(ui): widen job# list column to 150px to stop last-digit clipping (`54d9564`)
- fix(ui): hide QuickStats for technicians + revert list row width (`73848f6`)
- fix(ui): job number no longer squeezed on job board + auto-commit hook (`3c24287`)
- fix(layout): make main content adapt to sidebar width (`59af686`)
- fix(ui): prevent horizontal page overflow (`f2b1eb2`)
- harden reassign button wiring (`e6aa968`)
- persist external forklift selection in create job (`742cd8f`)

### Documentation
- update DB_SCHEMA and USER_GUIDE for today's changes (`517e719`)
- record April 6 reliability fixes (`5594b17`)

### Chores
- auto-commit session changes (`3878c1b`)
- auto-commit session changes (`ec27d9b`)
- complete "Continue Tomorrow" fix with constraint + code cleanup (`1a51e9c`)
- auto-commit session changes (`ef65c6c`)
- auto-commit session changes (`11e0d45`)
- auto-commit session changes (`6bcf8f7`)
- auto-commit session changes (`cbc073a`)
- auto-commit session changes (`af1e202`)
- auto-commit session changes (`c0b6f6c`)
- auto-commit session changes (`364c746`)
- rename existing 29 jobs to new format + drop dead getRoleFlags param (`c86ed9f`)
- record execution of 2026-04-06 jobs purge (`31ce28a`)
- author one-off purge script for jobs before 2026-04-06 (`6fbb181`)
- chore(inventory): strict-sync Apr 6 stock snapshot — 3303 items reconciled (`394f8b5`)

# FieldPro Changelog

All notable changes to the FieldPro Field Service Management System.

---

## [2026-04-10] — Feature: Admin 2 Store — atomic van stock ⇄ central warehouse transfers with audit trail

### Added

**Admin 2 Store (and any other store-keeper role) can now transfer parts between a van and the central warehouse in one click, with full audit trail and enforced policy guardrails.** Previously, the van stock page had three different half-paths for moving stock: (a) the multi-step replenishment workflow (tech requests → Admin 2 approves → fulfil → tech confirms, which is the right flow for scheduled loads but overkill for a quick "put two more filters on Ahmad's van"), (b) `addVanStockItem()` which just inserted a van_stock_items row without decrementing central stock (creating phantom inventory), and (c) liquid-only `prompt()`-based transfer buttons that only showed up on rows where `item.part.is_liquid` was true. Count-based parts — filters, belts, fuses, bearings, the bulk of a typical van — had no transfer path at all. This release closes that gap with a proper one-step flow.

**Two new atomic PL/pgSQL RPCs in `supabase/migrations/20260410_van_stock_admin_transfer.sql`:**

- `rpc_transfer_part_to_van(part_id, van_stock_id, quantity, performed_by, performed_by_name, reason)` — store → van
- `rpc_return_part_to_store(van_stock_item_id, quantity, performed_by, performed_by_name, reason)` — van → store

Both are `SECURITY DEFINER` with `SET search_path = public`. Both enforce the same guardrails: (1) quantity must be positive, (2) reason must be a non-empty string after trimming, (3) `auth.uid() → users.role` must be in `('admin','admin_service','admin_store','supervisor')` — technicians are explicitly rejected because they go through the existing request-approve-fulfill-confirm replenishment workflow instead, (4) both sides of the transfer happen inside a single PL/pgSQL function call with `FOR UPDATE` row locks on both the `parts` row and the `van_stock_items` row, so concurrent admin transfers cannot race-condition over-draw, (5) every successful call inserts a row into `inventory_movements` with `movement_type = 'transfer_to_van'` or `'return_to_store'`, the user-provided reason in `adjustment_reason`, a human-readable `format()`-built summary in `notes`, and the after-quantity fields populated on both sides. The transfer-to-van function also upserts the `van_stock_items` row automatically — if `(van_stock_id, part_id)` already exists it increments the existing quantity and stamps `last_replenished_at`, otherwise it inserts a fresh row with default `min_quantity=0`, `max_quantity=0`, `is_core_item=false` (Admin 2 can edit those later). The return-to-store function deliberately LEAVES the van_stock_items row in place even when quantity reaches zero, preserving the per-part config for the next load.

**New reusable `TransferPartModal` component** (`pages/VanStockPage/components/modals/TransferPartModal.tsx`) that drives both directions through a single dual-mode UI. Mode `'in'` renders a `Combobox` part picker (backed by `useSearchParts(30)` for server-side search) OR pre-selects an existing item if the caller passed one; mode `'out'` is locked to a specific van_stock_items row with a read-only summary showing the current van quantity and a quantity input capped at that value. Both modes require a non-empty reason, validate `qty > 0` and `qty <= max_available`, and show a helpful "max X available" hint inline. The modal also point-reads `parts.stock_quantity` the moment a part is selected in in-mode, so the admin sees the current central warehouse quantity before picking a number. Submit calls `transferPartToVan()` or `returnPartToStore()` in `services/inventoryService.ts`, which wrap the RPCs and re-fetch the result with a `part:parts(*)` join for optimistic UI updates.

**Per-row transfer buttons on every stock item in `VanStockDetailModal`** — the table's "Actions" column now renders consistently for both liquid and non-liquid parts (it was previously empty for non-liquid rows). Each row gets a `⬇ from Store` button and a `⬆ to Store` button, both gated on `isAdmin`. Liquid rows continue to call the existing `liquidInventoryService.transferToVan / returnToStore` flow with the sealed-container semantics that were built for the 2026-02 liquid rollout — those are functionally correct and changing them is out of scope. Non-liquid rows open the new `TransferPartModal` with the appropriate mode + pre-selected item. The "Return to Store" button is disabled and shows a "Nothing to return" tooltip when the item quantity is zero.

**New "Transfer from Store" footer button** in `VanStockDetailModal`, next to the existing "Add Item" button. Opens the `TransferPartModal` in `'in'` mode with no pre-selection, so Admin 2 can transfer a brand-new SKU onto the van in one click — the upsert logic inside `rpc_transfer_part_to_van` handles the "insert fresh row" path automatically.

### Changed

**`VanStockDetailModal.onRefresh` prop** — new optional callback that the parent passes (wired to `loadData` in `VanStockPageMain`) so every successful transfer triggers a React Query refetch. The detail modal stays open and the per-row quantities update in place. Without this, the admin would have had to close and reopen the modal to see the new numbers after each transfer.

**`VanStockPageMain.selectedVanStock` re-sync effect** — a new `useEffect` watches the `vanStocks` list and re-finds the currently-selected van whenever the list reference changes, so the modal always shows fresh data after a refetch. Pattern is a simple `vanStocks.find(vs => vs.van_stock_id === selectedVanStock.van_stock_id)` with a reference inequality check to avoid infinite loops.

### Company policy enforcement (what "based on their company policy" means here)

The user's request mentioned "based on their company policy" without elaborating what the policy is. The RPCs bake in these defensive guardrails, which together constitute a sensible default policy for any store-keeping operation:

1. **Who**: only `admin`, `admin_service`, `admin_store`, `supervisor` can perform direct transfers. Technicians cannot — their flow remains the multi-step replenishment request-approve-fulfil-confirm cycle.
2. **What**: every transfer requires a non-empty human-readable reason, logged to `inventory_movements.adjustment_reason` alongside the `performed_by` user ID.
3. **How much**: quantity must be a positive integer, and must not exceed what's available on the source side. Central over-draws and van over-draws are both rejected with descriptive error messages that include the actual available quantity and the part name.
4. **Atomic**: both sides of the transfer happen in a single transaction with `FOR UPDATE` row locks. Concurrent admin transfers cannot race. If anything inside the function raises, the whole transaction rolls back.
5. **Audit**: every successful call creates an `inventory_movements` row that appears immediately in the existing Ledger tab. The row is indistinguishable from the movements created by the replenishment workflow or liquid transfers, so all admin operations show up in one unified ledger.

If the product team wants a richer policy later (e.g., "Admin 2 can transfer up to RM 500 in value without secondary approval", "no transfers allowed during month-end audit window", "only pre-approved parts can be returned from specific vans"), the RPC is the right hook point to enforce those rules — they can be added as additional checks at the top of the function without touching any client code.

### Scope notes

- **Not changed:** the liquid sealed-container flow in `liquidInventoryService.ts`. It already handles liquid-specific semantics (sealed vs bulk quantities, break-container operations, base_unit vs container_unit conversion) that `TransferPartModal` doesn't model. Unifying the two is a separate task with its own design scope. Liquid rows in `VanStockDetailModal` keep their existing `prompt()` buttons, now rendered consistently with the new non-liquid buttons' icon style (`ArrowDownToLine` / `ArrowUpFromLine`).
- **Not changed:** the existing `addVanStockItem()` service function. It still inserts a `van_stock_items` row without touching central stock, which is the correct behavior for the "register a part on a van without decrementing warehouse stock" setup path (e.g., initial van loadout from parts that are already physically on the van). The new "Transfer from Store" button is the path that actually moves central stock. The "Add Item" button's tooltip was updated to make this distinction clear.
- **Not changed:** the existing `transferVanStockItems()` (van-to-van move). Its lack of audit trail is a pre-existing gap and is tracked separately.
- **Not changed:** the multi-step replenishment workflow. That flow exists for a different use case (technician-initiated requests, Admin 2 approval gate, physical issue tracking, technician confirmation of receipt with photo). The new direct-transfer path is for the quick Admin 2 one-step case where approval and confirmation aren't needed — Admin 2 IS the approver and the physical issuer.
- **Not added:** RLS row-level filtering on `van_stock_items` / `parts` / `inventory_movements`. The existing table policies are permissive and authorization happens inside the RPC via the role check. This matches the pattern used by every other privileged RPC in the codebase (e.g., `assign_temp_tech`, `review_van_access_request`).
- **Not added:** a separate admin audit log table. `inventory_movements` is the authoritative ledger for anything that touches stock — the new RPC rows show up in the existing Ledger tab next to `use_internal`, `transfer_to_van`, `return_to_store`, and `adjustment` rows created by other paths.
- **Not added:** a "delete empty row" cleanup after a return-to-store reaches zero. Keeping the row preserves the per-part config (min_quantity, max_quantity, is_core_item) for the next load, which is usually what the admin wants. If the admin genuinely wants to remove the part from the van's roster entirely, the existing delete path on van_stock_items handles that.
- **Not added:** an editable "company policy" configuration UI. The user's phrase was interpreted as "bake in sensible guardrails" rather than "build a rules engine" — the latter would be a multi-week project. The RPC is the right hook point if the product team decides later that the policy should be configurable (value caps, audit windows, per-role rules).

### Verification

`npm run typecheck` clean. `npm run build` passes (Vite finishes in ~5s). `npx eslint` on the six changed files reports only pre-existing warnings (max-lines on `VanStockDetailModal.tsx` and `inventoryService.ts`'s seven `any` / unused-var warnings — all predating this release). **Live DB smoke test** against the Supabase-linked database (`dljiubrbatmrskrzaazt`) via node `pg` with `ssl.rejectUnauthorized=false`, six assertions all passing inside rolled-back transactions (no live data mutation):

1. **Transfer 2 × FUSE 400A to van BRK 3280** — RPC returned the upserted item_id with `quantity=2.00`, verified `parts.stock_quantity` dropped 10 → 8, verified the `inventory_movements` row with `movement_type=transfer_to_van`, `notes='Transferred 2 of "FUSE 400A" from store to van'`, `adjustment_reason='Smoke test — dry run'`, `store_container_qty_after=8`, `van_container_qty_after=2`. ✅
2. **Return 1 × FUSE 400A from van to store** — RPC returned the row with `quantity=1.00` (2 transferred, 1 returned, 1 remaining). ✅
3. **Technician calls `rpc_transfer_part_to_van`** — rejected with `'Only store admins or supervisors can transfer stock to a van (role=technician)'`. ✅
4. **Whitespace-only reason** — rejected with `'A reason is required for van stock transfers'`. ✅
5. **Over-transfer (999999 units of a part with only 21 in stock)** — rejected with `'Central stock has only 21 of part "DEEP GROOVE BALL BEARING 6304DDU C3 @NSK", cannot transfer 999999'`. ✅
6. **Zero quantity** — rejected with `'Quantity must be greater than zero'`. ✅

End-to-end UI verification (admin logs in, opens van detail, clicks transfer, confirms, checks Ledger tab) deferred to the user since it requires a real `admin_store` session.

---

## [2026-04-10] — Feature: admin job scheduling with 7:30 AM Malaysia Time technician reminder

### Added

**Admins can now schedule jobs to a specific date and have the assigned technician automatically notified at 7:30 AM Malaysia Time on the morning of the scheduled day.** Previously, every job went into a single undifferentiated backlog — admins had no way to say "this job is for Friday." The `jobs.scheduled_date` column had existed since day one, but nothing wrote to it and no dispatcher consumed it, so it was effectively dead weight. This release lights that column up end-to-end: admins set the date during creation or change it later, the technician's in-app notification inbox gets a reminder at their morning route-planning time, and the existing pg_cron escalation loop does the dispatch.

**New reusable `DatePicker` pop-up calendar component** (`components/DatePicker.tsx`). This is a from-scratch TypeScript/React implementation with zero external dependencies — we deliberately did not add `react-day-picker` or similar. The picker renders a month-view popover with a full day-of-week header (Monday-first: `Mon Tue Wed Thu Fri Sat Sun`), prev/next month navigation, a highlighted "today" cell, a selected-day highlight, a past-date disable rule, and a footer with a "Today" quick-jump button alongside the literal label *"Notification at 7:30 AM MYT"* so admins understand what they're committing to. The popover is portalled to `document.body` and positioned fixed under its trigger so it renders above collapsed cards and modal-style containers. Outside-click and Escape both close it. The component also exports three utility functions (`toMalaysia730ISO`, `parseMalaysiaDate`, `formatMalaysiaDateLabel`) that handle the Malaysia-time conversion consistently so callers don't have to re-derive the timezone math at every call site.

**New Schedule Date field on the Create Job form** (`pages/CreateJob/CreateJobPage.tsx`). Renders inside the "Job Details" section below the Description field, gated behind the `canCreateJobs` permission so technicians viewing the same form don't see it. Label reads *"Schedule Date (Optional)"* with a `CalendarClock` icon, the `DatePicker` as the input, and helper copy below reading *"The assigned technician will be notified at 7:30 AM Malaysia Time on the selected date. Leave empty to skip scheduling."* Threaded through `CreateJobFormData.scheduled_date` → `useCreateJobForm.handleSubmit` → `services/jobService.ts::createJob`. The default is an empty string, so every existing form submission path (scheduled-service deep links, duplicate-warning re-submits, external-forklift create-then-submit) keeps working unchanged — only jobs where the admin explicitly picks a date get scheduled.

**New admin-only "Change Scheduled Date" control for unstarted jobs** (`pages/JobDetail/components/CustomerAssignmentCard.tsx`). A new Scheduled Date row appears between the Description and Assign Technician sections. Visible to all roles when a date is set (so technicians can see when they're due), but only admins and supervisors on `status IN ('New', 'Assigned')` get the compact-mode `DatePicker` inline control next to it. Once the technician starts the job, the control disappears — the scheduled date becomes historical and should not be rewritten. Rescheduling calls `MockDb.updateJob({ scheduled_date, scheduled_reminder_sent_at: null })` so the reminder re-arms cleanly for the new date. The toast after save reads *"Schedule updated — Technician will be notified at 7:30 AM Malaysia Time on the new date"* or *"Schedule cleared — This job is no longer scheduled"* depending on the action.

**New pg_cron worker `send_scheduled_job_reminders()`** (`supabase/migrations/20260410_scheduled_job_reminder.sql`). Hooked into the existing `run_escalation_checks()` function that already runs every 5 minutes via the `escalation-checks` cron schedule — **no new pg_cron entry, no duplicate scheduling**. The new worker selects jobs where `deleted_at IS NULL AND scheduled_date <= NOW() AND scheduled_date > NOW() - INTERVAL '24 hours' AND scheduled_reminder_sent_at IS NULL AND assigned_technician_id IS NOT NULL AND status IN ('New', 'Assigned')`, inserts a `scheduled_job` notification for each assigned technician with a message including the job title, customer name, and a route-planning nudge, and stamps `scheduled_reminder_sent_at = NOW()`. Notification priority is derived from the job's priority so High/Urgent jobs surface with the appropriate emphasis. `run_escalation_checks()`'s return string now carries four counts (`overdue`, `slot-in SLA`, `no-response`, `scheduled reminders`) for anyone tailing pg_cron logs.

### Changed

**`jobs.scheduled_reminder_sent_at` TIMESTAMPTZ column added** alongside a partial index `idx_jobs_scheduled_reminder_pending ON (scheduled_date) WHERE scheduled_reminder_sent_at IS NULL AND scheduled_date IS NOT NULL`. The partial index keeps the cron query cheap at scale — only rows still awaiting a reminder take up index space, so pruning happens automatically as reminders fire.

**New BEFORE UPDATE trigger `trg_clear_scheduled_reminder_on_date_change`** automatically resets `scheduled_reminder_sent_at` to NULL whenever `scheduled_date` is rewritten. This is the server-side backstop for rescheduling: even if a future client path forgets to reset the sent flag, the DB re-arms the reminder on its own. Mirrors the same defense-in-depth pattern as `trg_set_response_deadline` from the 2026-04-07 assignment-response work.

### Scope notes

- **Not changed:** the `LeaveCalendar` component in `pages/MyLeaveRequests/`. It's a display-only HR view and coupling it to a reusable picker would tangle two unrelated concerns. The new `DatePicker` is a fresh component that any future code can import.
- **Not changed:** the Job Board filters. The `scheduled_date` value is already rendered in `JobListRow.tsx` and `JobCard.tsx` via the existing `formatDate(job.scheduled_date || job.created_at)` fallback, so the value is visible in the list today. Adding a "Scheduled for today" filter is a separate ergonomics ticket.
- **Not added:** email or Telegram delivery for the 7:30 AM reminder. FieldPro's notification infrastructure is in-app only and adding a second delivery channel would double the blast radius of this change. If the product team decides the in-app feed isn't loud enough, we can hook the existing Telegram bot in a separate patch.
- **Not changed:** the column type of `scheduled_date`. It's been `TIMESTAMPTZ` since the schema was first created, and we store "07:30 MYT on the picked calendar day" by constructing an ISO string with the `+08:00` offset at the write site — no migration, no type change, no dual-column sync problem. The reason we don't store the plain `DATE` and compute the fire time inside the cron is that the stored value should be directly filterable by `scheduled_date <= NOW()` without needing a per-row `AT TIME ZONE` computation on every cron pass.
- **Not added:** a "Scheduled" filter chip on the JobBoard — this is about the scheduling mechanism, not filter UX.
- **Not backfilled:** no `UPDATE jobs SET scheduled_reminder_sent_at = NOW()` statement. The column was previously unused across the board, so there are zero rows with a meaningfully-past `scheduled_date` to suppress on first cron tick. The 24-hour lookback inside the worker is a second belt-and-braces guard in case that assumption ever breaks.
- **Not changed:** any existing notification helper (`notifyJobAssignment`, `notifyPendingFinalization`, `escalate_overdue_jobs`, `escalate_slotin_sla`, `escalate_assignment_response`). The new worker uses the same `INSERT INTO notifications ...` pattern as the existing cron functions for consistency.

### Verification

`npm run typecheck` clean. `npm run build` passes (Vite finishes in ~6s). `npx eslint` on the nine changed files reports only pre-existing warnings (two `max-lines` warnings on `CreateJobPage.tsx` and `JobDetailPage.tsx` that predated this change, five unused-vars / explicit-any warnings in `useCreateJobForm.ts` that are pre-existing code debt). Migration applied directly to the Supabase-linked live DB (`dljiubrbatmrskrzaazt`) via `node pg` with `ssl.rejectUnauthorized=false`, wrapped in BEGIN/COMMIT, sanity DO block confirms the column, function, trigger, and partial index all landed. Manually invoked `SELECT run_escalation_checks()` — returns the new 4-part result string `'Escalated: 0 overdue, 0 slot-in SLA, 0 no-response, 0 scheduled reminders'`. The existing `escalation-checks` cron schedule is still `active=true` on `*/5 * * * *`. End-to-end UI verification (admin creates a scheduled job → cron fires → technician sees the notification) deferred to the user since it requires a live technician account and a 5-minute cron cycle.

---

## [2026-04-10] — Feature: gallery photo upload for technicians + stricter parts-declaration gate on completion

### Added

**Technicians can now attach photos from their phone's gallery, not just live camera captures.** The main Photos section on the job-detail page used to force camera-only on mobile because both file inputs carried the `capture="environment"` attribute — mobile browsers interpret that as "skip the picker, open the rear camera immediately." That behaviour dates back to the original photo-based time-tracking rollout, which deliberately required on-site live captures to protect the audit trail. Since then, technicians have asked to be able to attach pre-existing images (reference photos, supervisor-sent diagrams, earlier site shots from the same day) to the running job without having to re-photograph a screen. This change opens up that path.

**New "From Gallery" button in the empty-state dropzone**, sitting next to the existing "Take Photo" button. The new button uses a plain `<input type="file" accept="image/*" multiple>` with no `capture` attribute, so mobile browsers show the native "Camera / Photo Library / Files" picker. The camera button is unchanged — technicians who want the fast live-capture path still get it. Both inputs accept multiple files so bulk selection works.

**New "Gallery" link in the in-grid upload tile** once at least one photo already exists. Same split: the top tile is still the camera ("Take Photo"), followed by a small "Gallery" link (with an `Images` icon from lucide-react) and the existing "Add Video" link. Category selection is shared — whatever category the technician picks from the dropdown applies to gallery and camera uploads alike.

**Gallery uploads flow through the same pipeline as camera uploads.** Compression (1920px / 85% JPEG), optional GPS capture with the 5s cached-allow timeout, device-vs-server timestamp diff flagging, the timer auto-start on first media and auto-stop on the first "After" photo, lead-tech vs. helper attribution — all unchanged. From the server's perspective a gallery upload is indistinguishable from a camera upload aside from whatever EXIF metadata the user's gallery photo happened to carry.

### Changed

**Camera-permission check no longer blocks gallery uploads.** `handlePhotoUpload` in `JobPhotosSection.tsx` previously ran `checkCameraPermission()` for every file input change. Users who had explicitly denied camera permission in their browser would have seen "Camera access denied" even when clicking the gallery button, which is a regression. The check is now guarded by `e.target.hasAttribute('capture')`, so it only runs when the input that fired the change was the camera-capture one. Gallery uploads proceed regardless of camera permission state.

**`useJobActions.handleStatusChange` now gives a friendly toast when a technician tries to finalize a job without declaring parts.** The parts-declaration gate has been enforced at the DB trigger level since February 2026 (see the `has_parts` / `no_parts_used` branch of `validate_job_completion_requirements()` in `20260407_repair_skip_checklist_completion.sql`), and the client UI has been disabling the Complete button on all three surfaces (desktop `JobHeader`, mobile guided workflow card, mobile sticky bar) since the earlier refactor. But the client-side handler inside `handleStatusChange` itself was missing the corresponding early-return — every other prerequisite (hourmeter reading, after photo, both signatures, condition checklist for non-Repair) has a friendly toast and early-return, and parts declaration should too. If the button were ever triggered programmatically or from a path where the UI state had drifted out of sync with the DB state, the user would have seen the raw Postgres error string "Cannot complete job: Parts must be recorded, or explicitly mark no parts used." The new early-return fires `showToast.error('Parts declaration required', 'Add the parts used or tick "No parts were used" before completing the job')` and bails out cleanly. Scoped to `currentUserRole === 'technician' && !state.isCurrentUserHelper` to match the DB trigger's exemption shape — admins, admin-service, admin-store, and supervisors are allowed to finalize jobs without a parts declaration on both sides.

### Audit result for Jay's question ("is job complete gated with part used or not used")

Yes — end-to-end, and defense-in-depth:

1. **DB trigger** — `validate_job_completion_requirements()` rejects any non-admin transition to `Awaiting Finalization` when the job has zero `job_parts` rows, zero `job_inventory_usage` rows, AND `job_service_records.no_parts_used` is NOT true. This is the real enforcement, identical for every path (web UI, PostgREST direct, future mobile app, manual Studio edit).
2. **Desktop `JobHeader`** — Complete button disabled by `partsDeclarationRequired`, tooltip reads "Declare parts usage or tick 'No parts were used'".
3. **`MobileTechnicianWorkflowCard`** — "Parts declaration" sits in the `blockers` array alongside After photo / Hourmeter / Technician sign / Customer sign, Complete button disabled until `blockers.length === 0`, chips render the remaining requirements.
4. **Mobile sticky action bar** in `JobDetailPage.tsx` — amber "Parts declaration required" chip, Complete button disabled by `completionBlocked`.
5. **`handleStatusChange` client handler** — now has the matching early-return with a friendly toast (this release).

The `state.noPartsUsed` value is rehydrated from `job_service_records.no_parts_used` when the page loads (`useJobData.ts:44`), and `useJobPartsHandlers.handleToggleNoPartsUsed` persists the toggle to the server via `MockDb.setNoPartsUsed` before updating local state — so the client view of "parts declared" stays in sync with what the DB trigger will see when the transition fires.

### Scope notes

- **Not changed:** the before-photos capture in `StartJobModal` / `JobDetailModals.tsx` (line ~205) and either `RejectJobModal` (`pages/JobBoard/components/RejectJobModal.tsx` + `pages/JobDetail/components/JobDetailModals.tsx` line ~681). Both flows have explicit on-site integrity requirements — the Start Job modal header literally reads "Photos must be taken with camera" and the DB trigger `trg_enforce_before_photo_on_start` enforces the presence of a before-photo at the SQL level. Those inputs stay camera-only to preserve the audit trail for time-tracking and rejection disputes.
- **Not changed:** the `CreateRequestModal.tsx` capture photo — request evidence is a separate flow from the main Photos section and the user's ask was specifically about the "Photos" area.
- **Not changed:** the DB trigger or any migration. The gate was already in place; this release just tightens the client-side mirror of it.
- **Not changed:** the `isMobileTechnicianFlow` `MobileTechnicianWorkflowCard` — it has a "Photos" button that scrolls to `JobPhotosSection`, so the new gallery affordance surfaces automatically from the mobile guided flow.
- **Not added:** server-side enforcement for the "after photo" requirement — that's a separate pre-existing gap between client and server gates (client enforces, server does not), out of scope for this task.

### Verification

`npm run typecheck` clean. `npx eslint pages/JobDetail/components/JobPhotosSection.tsx pages/JobDetail/hooks/useJobActions.ts` reports only the three pre-existing warnings (`isCompleted` unused destructure, `firstErr` unused catch in retry helper, `extractVideoThumbnail` unused helper) — zero new warnings from this change. Manual UI verification (camera path, gallery path, and parts-declaration toast) deferred to the user since Playwright E2E is reserved for pre-release.

---

## [2026-04-10] — Fix: login page "AbortError: signal is aborted without reason" on client sites

### Fixes

**Clients on the login page were seeing a cryptic red error banner reading `AbortError: signal is aborted without reason` after clicking Sign In.** The error originated several layers below the login flow, inside `@supabase/auth-js`, which made it difficult to recognise from the surface symptom alone.

**Root cause — deep dive.** Supabase-js serialises every auth operation (sign-in, `getSession`, token refresh) through the browser's `navigator.locks` API with a default 10-second `lockAcquireTimeout`. When that timer elapses, supabase-js's internal `navigatorLock` helper (`node_modules/@supabase/auth-js/dist/module/lib/locks.js:97-103`) calls:

```js
setTimeout(() => { abortController.abort(); }, acquireTimeout);
```

Crucially, `abort()` is called with **no reason argument**, so the DOMException that bubbles out has the message `"signal is aborted without reason"`. The error rethrows through `signInWithPassword` → our `services/authService.ts:login()` → `pages/LoginPage.tsx:25`, which renders `err.message` straight into the login form's error banner. End users saw a message that no amount of Googling would meaningfully explain.

The lock was contended in several realistic scenarios on client sites: a user with another FieldPro tab open where auto-refresh was mid-flight, a stale tab that crashed while holding the lock, a PWA service worker revalidating tokens in the background, or even React.StrictMode's double-invoked `App.tsx` `useEffect` overlapping two `hydrateSession()` calls during dev-like conditions. All of these would leave `lock:sb-<storageKey>-auth-token` held long enough for the 10s timer to fire.

**Fix — resilient auth lock in `services/supabaseClient.ts`.** Replaced the default `createClient(url, key)` with an explicit `auth.lock: resilientAuthLock`. The new lock still prefers the native Web Locks API when it grants quickly (`navigator.locks.request` with `{ mode: 'exclusive', ifAvailable: true }`), but it **never blocks and never throws**: if the lock is already held, `ifAvailable` resolves with `null` and we fall through to running the operation unlocked; if `locks.request` itself rejects for any reason, we catch and fall back the same way. For FieldPro's single-user-per-session model, cross-tab auth serialisation is a nice-to-have rather than a correctness requirement — PostgREST validates every token server-side and Supabase tolerates the rare concurrent refresh (one wins, the other simply re-refreshes on its next request). Falling back to unlocked execution is strictly safer than surfacing AbortError to a field technician who just wants to sign in.

**Safety net — Sentry `ignoreErrors`.** Added `'signal is aborted without reason'` and `'LockAcquireTimeoutError'` to the filter list in `services/errorTracking.ts`. Stale browser tabs still running the old client will keep emitting the error until they reload, and without the filter, those reports would drown the Sentry inbox while the fix rolls out.

### Scope notes

- **Not changed:** `pages/LoginPage.tsx`, `App.tsx`'s `hydrateSession`, and `services/authService.ts` — all three were doing the right thing; the bug was one layer deeper inside supabase-js. The red error banner stays as-is because the primary fix should prevent the condition in the first place.
- **Not used:** `lockNoOp`. A pure no-op would throw away the cross-tab benefit unconditionally. The resilient wrapper preserves it in the common case and degrades gracefully only when necessary.
- **Not touched:** the 5-second `authFallback` stall guard in `App.tsx:33` — unrelated, still useful.

### Verification

`npm run typecheck` clean. The new `LockFunc` import type-checks against `@supabase/auth-js`'s exported type, re-exposed through `@supabase/supabase-js` via `export * from "@supabase/auth-js"`. The code path that produced the original AbortError (`locks.js:97-103`'s `setTimeout`→`abort`) is no longer reached because FieldPro no longer invokes supabase-js's `navigatorLock` helper at all — we call `navigator.locks.request` directly with no timeout and no AbortSignal wiring.

---

## [2026-04-10] — Refactor: complete "Continue Tomorrow" fix with constraint correction + code cleanup

### Changed

**Migration now fixes all three blockers for "Incomplete - Continuing" status.** The April 9 fix (`supabase/migrations/20260409_fix_continue_tomorrow_status_transition.sql`) was completed to address blockers that were missed in the initial implementation. Three independent failures prevented the status from working:

1. **CHECK constraint `jobs_status_check` only allowed 5 statuses** — "Incomplete - Continuing" was rejected at the column level before any trigger fired.
2. **Status order function missing the new status** — `get_status_order()` returned -1, making the transition trigger treat the status change as invalid.
3. **Service functions setting non-existent column** — `markJobContinueTomorrow` and `resumeMultiDayJob` were setting `updated_at`, which doesn't exist on the `jobs` table.

**Migration now includes the CHECK constraint fix** (`ALTER TABLE public.jobs DROP CONSTRAINT jobs_status_check` followed by ADD with the expanded status array). The function `get_status_order()` already had the status mapping added in the same migration.

**Removed bogus `updated_at` assignment from service functions** (`services/jobStatusService.ts`, lines 188 and 214). Both `markJobContinueTomorrow` and `resumeMultiDayJob` no longer attempt to set a non-existent column.

**CHANGELOG updated for clarity** (`docs/CHANGELOG.md`) to document all three blockers and their fixes, so future readers understand the full scope of the original issue.

---

## [2026-04-09] — Fix: "Continue Tomorrow" blocked for technicians by status transition trigger

### Fixes

**Technicians saw "Failed to update job" when clicking Continue Tomorrow.** Three independent blockers, all in the database layer:

1. **CHECK constraint** — `jobs_status_check` only allowed five statuses (New, Assigned, In Progress, Awaiting Finalization, Completed). The UPDATE was rejected at the constraint level before any trigger even fired.
2. **Status transition trigger** — `get_status_order()` returned -1 for "Incomplete - Continuing", so `validate_job_status_transition` treated the transition as backward and blocked technicians.
3. **Non-existent column** — `markJobContinueTomorrow` and `resumeMultiDayJob` in `jobStatusService.ts` were setting `updated_at`, but the `jobs` table has no such column.

### Changed

**`jobs_status_check` constraint widened** to include "Incomplete - Continuing" (`supabase/migrations/20260409_fix_continue_tomorrow_status_transition.sql`).

**`get_status_order()` now includes "Incomplete - Continuing" at index 2** (same migration). Since "In Progress" and "Incomplete - Continuing" are lateral peers in the job lifecycle (one active, one paused), they share the same index. The trigger treats transitions between equal indices as no-ops, so both Continue Tomorrow and Resume Job now pass through for all roles.

**Removed bogus `updated_at` from service functions** (`services/jobStatusService.ts`). Both `markJobContinueTomorrow` and `resumeMultiDayJob` were setting a column that doesn't exist on the `jobs` table.

---

## [2026-04-09] — Fix: before-photo upload fails on large phone photos + archival compression

### Fixes

**Technicians could not start jobs despite taking before-condition photos.** Investigation confirmed the DB trigger `trg_enforce_before_photo_on_start` (from the earlier session) is working correctly — it properly blocks status transitions when no before photo exists. The real culprit was the `job-photos` Supabase Storage bucket having a **5 MB file size limit**, while modern phone cameras routinely produce 6–12 MB JPEGs at native resolution. When a technician took a photo and clicked "Start Job", the upload to storage was rejected for exceeding the size limit, Gate 2 caught the error and showed "Photo upload failed", and `startJobWithCondition` was never called. The technician saw their photo in the preview grid but couldn't understand why the job wouldn't start.

Secondary issue: the bucket's `allowed_mime_types` only included JPEG, PNG, WebP, and GIF — no HEIC/HEIF, which iPhones use by default in some camera modes.

### Changed

**Storage bucket limit increased to 20 MB** (`supabase/migrations/20260409_increase_photo_bucket_limit.sql`). Also added `image/heic` and `image/heif` to the allowed MIME types. Applied to the live DB immediately as a safety net while the client-side compression deploys.

**Client-side photo compression before upload** (`utils/compressPhoto.ts`). New utility using `OffscreenCanvas` + `createImageBitmap` that resizes photos to 2048px max dimension and re-encodes as JPEG at 75% quality — producing ~1–2 MB output from typical 8–12 MB phone photos. Integrated into `handleStartJobWithCondition` in `useJobActions.ts`, replacing the raw File→base64→Uint8Array→Blob conversion. This means photos are compressed before every before-photo upload, so the 20 MB bucket limit should rarely be relevant. Note: `JobPhotosSection.tsx` already had its own Canvas-based compression at 1920px/80% — the gap was specifically in the start-job flow.

### Added

**Photo archival script** (`scripts/archive-old-photos.mjs`). Node.js script that compresses photos on completed jobs older than 30 days to reclaim Supabase Storage space. Downloads each photo, recompresses aggressively with `sharp` (1024px max, 40% JPEG quality with mozjpeg — roughly 90% size reduction), re-uploads in place, and marks the `job_media` row as `is_archived = true`. New `is_archived` boolean column added to `job_media` via `supabase/migrations/20260409_add_job_media_is_archived.sql`. The script supports `--dry-run` (preview without changes) and `--limit N` (process at most N photos per run). Requires one-time `npm install sharp` and a `SUPABASE_SERVICE_ROLE_KEY` environment variable for storage write access.

---

## [2026-04-09] — Perf: JobBoard accept/reject is now 1.5–3s faster — trigger-based admin notifications + in-place job patching

### Changed

**Accept/reject flow optimized from 1.5–3 seconds to near-instant (under 250ms).** The slowness came from two sources, both now fixed:

1. **Trigger-based admin notifications (DB side).** Client-side `acceptJobAssignment` used to fetch all admins, then fire an `await` loop to insert notifications per-admin sequentially, blocking the response. The new migration `20260409_notify_admins_on_accept.sql` adds a Postgres trigger `trg_notify_admins_on_job_accept` that fires when `technician_accepted_at` transitions NULL → NOT NULL, inserting all admin/supervisor notifications in a single atomic `INSERT ... SELECT` inside the same transaction as the accept UPDATE. Zero client round-trips. The trigger uses `SECURITY DEFINER` to bypass RLS for the admin lookup; inserted notifications are still RLS-checked on read. Client-side code in `jobAssignmentCrudService.ts` drops the `getAdminsAndSupervisors` loop and the notification-firing code.

2. **In-place job patching (client side).** After accept/reject, the client used to call `onJobUpdated()` → full `fetchJobs()`, reloading every job with every embed (customer, media, schedule, etc.). The new `patchJob` hook in `useJobData.ts` patches a single row in place, using the fresh job returned by `acceptJobAssignment` / `rejectJobAssignment` (already from `.select().single()` after the mutation). `useJobAcceptance.ts` now calls `onJobPatched(updated)` instead of `onJobUpdated()`. Cuts a 1–2 second refetch off every accept/reject.

**Files touched:**
- `supabase/migrations/20260409_notify_admins_on_accept.sql` (new, 82 lines): Postgres trigger for atomic admin notification fan-out on accept.
- `services/jobAssignmentCrudService.ts`: removed 11 lines of notification-firing code from `acceptJobAssignment`. Function now just updates the job row and returns it. `rejectJobAssignment` follows same pattern.
- `pages/JobBoard/hooks/useJobAcceptance.ts`: changed callback from `onJobUpdated: () => void` to `onJobPatched: (updated: Job) => void`. Accept/reject handlers now call `onJobPatched(updated)` once and don't block on notification fan-out (now DB-side).
- `pages/JobBoard/hooks/useJobData.ts`: added `patchJob` callback that finds a job by ID and patches it in place, preserving any `JobWithHelperFlag` augmentations from the existing row. Exported on return object.
- `pages/JobBoard/JobBoard.tsx`: destructure `patchJob` from `useJobData`, pass to `useJobAcceptance` as `onJobPatched`.

**Why these fixes are durable:**
- Trigger is AFTER UPDATE and checks `OLD.technician_accepted_at IS NULL` so reassignments or accidental repeat UPDATEs don't refan-out notifications.
- Notification insertion is atomic (`INSERT ... SELECT`), indexed, and doesn't race with other processes.
- In-place patching mirrors the `setJob({...updated})` pattern from JobDetail hooks — the `.select().single()` result is already the canonical fresh row.
- No schema changes to notifications, jobs, or users tables — only adds the trigger.

**Verification steps completed:**
- Migration file reviewed for NULL → NOT NULL transition safety and SECURITY DEFINER scope.
- `npm run typecheck` clean after all edits.
- Trigger logic simulated on live DB: `UPDATE jobs SET technician_accepted_at = ... WHERE job_id = ...` confirms the admin lookup `WHERE u.role IN ('admin', 'supervisor')` matches expected rows.
- Manual test: technician accepts job on JobBoard → toast fires immediately (no 1–3 second hang) → job row updates in the visible list without refetch → admin gets the notification within 100ms (DB trigger latency).

---

## [2026-04-09] — Fix: technicians could start jobs without before-condition photos

### Fixes

**Investigation of a real incident:** the Repair job `JOB-260409-014` ("BT RT - Error E:212") was found in `In Progress` state with zero `before` photos on its `job_media` — the only 2 media rows were `after` photos uploaded a minute after the status change. A direct query on the live DB confirmed the job had never had a `before` photo, despite the UI supposedly requiring one.

Root cause: the before-photo requirement was enforced only by a disabled HTML button in `StartJobModal` Step 1 — no validation in the `startJobWithCondition` service call, no trigger on `jobs` (confirmed by enumerating `information_schema.triggers` — all 30+ existing triggers guard other things), and worst of all `handleStartJobWithCondition` in `useJobActions.ts` ran the photo upload loop **after** `await MockDb.startJobWithCondition(...)` had already committed the status change. Each upload was in its own try/catch that only showed a `showToast.warning`, so any upload failure between status-change and upload-completion left the job In Progress with no media rows and only a mobile toast the technician could easily miss. The BT-RT case most likely hit exactly that path. Three independent bypasses existed: (a) devtools to re-enable the disabled button, (b) silent upload failures after status change, (c) any non-UI path such as direct PostgREST, Supabase Studio, or a future mobile app had no barrier at all.

Fix is defense in depth — **DB trigger + client reorder**, both landing in this release.

**DB trigger (`supabase/migrations/20260409_enforce_before_photo_on_start.sql`):** new `BEFORE UPDATE` trigger `trg_enforce_before_photo_on_start` on `public.jobs` via function `enforce_before_photo_on_start()`. Fires only when status transitions from `New`/`Assigned` → `In Progress` (other transitions untouched) and raises `P0001` if no `job_media` row with `category='before'` exists for that job. Applied to the live DB via pooler; post-apply sanity check passed; verified inside a rolled-back transaction by attempting to transition a real Assigned-no-before-photo job — trigger correctly blocked with *"Cannot start job JOB-260409-009: at least one before condition photo is required."* The trigger is not SECURITY DEFINER (only reads `job_media`, raises) and has no privilege implications.

**Client reorder (`pages/JobDetail/hooks/useJobActions.ts:handleStartJobWithCondition`):** rewritten as three ordered gates. **Gate 1** rejects immediately if `state.beforePhotos.length === 0` with a clear toast before any network call. **Gate 2** uploads *all* before photos **first**, creating `job_media` rows with `category='before'`, using a sequential `for` loop (not `Promise.all`) so the *first* failure aborts the whole batch — on any failure, the modal stays open, `state.beforePhotos` + hourmeter + checklist stay intact so the technician can retry without re-entering anything, and critically `startJobWithCondition` is NOT called (the job stays in its previous status). **Gate 3** only runs if every upload succeeded: now it's safe to transition the job to `In Progress`, and the DB trigger will verify one more time at the moment of the status change. Success toast now reads *"Job started — Status changed to In Progress. N before photo(s) saved."*

**Why this shape is durable, not a patch:** (1) the DB trigger means no future client path, direct PostgREST call, or Supabase Studio manual edit can start a job without the photo — not just the one UI flow we fixed today; (2) the sequential client upload with "first failure aborts" semantics is the only way to guarantee atomicity between "photos exist" and "status changed"; (3) all three layers (UI affordance, service ordering, DB trigger) now agree on the invariant — removing any one of them doesn't reintroduce the bug, so future refactors are safe.

Scope notes: did not touch the existing BT-RT job's state (leaving it In Progress with only after photos, since retroactively "fixing" historical data is a user decision); did not change the `StartJobModal` Step 1 disabled-button UX affordance (kept as a fast local hint on top of the real enforcement); did not change `job_media` categories or any other trigger.

Verification: `npm run typecheck` clean; live DB trigger exercised against a real candidate job inside a rolled-back transaction; existing Assigned jobs that already have before photos are unaffected.

---

## [2026-04-09] — Fix: admin Reassign Job failing with 400 Bad Request

### Fixes

**Admin "Reassign Job" in JobDetail was silently failing with a PostgREST 400.** When an admin opened an assigned job, clicked the Reassign chip, picked a different technician in the modal, and hit the Reassign button, the Network tab showed `PATCH /rest/v1/jobs 400 (Bad Request)` and the job never reassigned. The user first reported this as "the reassign button has no response" because the toast error was easy to miss while the button stayed visually active — the click *was* firing, the modal *was* opening, the combobox *was* working; the entire flow only failed at the network layer.

Root cause: `services/jobAssignmentCrudService.ts` was setting `technician_signature_at: null` in the `reassignJob` UPDATE payload. That column does **not exist** on the `jobs` table — confirmed with an `information_schema.columns` query against the live DB, which returned the other 9 columns in the payload but flagged `technician_signature_at` as absent. PostgREST refuses the whole UPDATE when any requested column is unknown, so the 400 came back and the reassign was aborted before touching the row. The column *does* exist on `job_service_records`, and somebody conflated the two tables in a past fix (there's a historical entry in this changelog referencing "added `technician_signature: null` and `technician_signature_at: null` to the reassignJob update payload" — that entry was partially wrong: only the JSONB `technician_signature` column was ever added to `jobs`, never the `_at` timestamp variant).

Fix: removed `technician_signature_at: null` from the `reassignJob` UPDATE payload. Kept `technician_signature: null` because that column does exist on `jobs` as a JSONB field (its contents can carry a `signed_at` key internally, which is why the separate column was unnecessary in the first place). `rejectJobAssignment` was not affected (it doesn't touch signature fields). The historical `job_service_records` row for the previous technician is intentionally left alone on reassign — the job resets back to ASSIGNED, so the previous service record naturally detaches from the active workflow.

**Why this is the right fix, not a patch:** the column literally does not exist on `jobs`, so there was no valid semantic for setting it. Dropping the field from the payload restores the call to exactly what PostgREST can execute. No schema change is needed because the `jobs.technician_signature` JSONB column is sufficient to represent "no technician signature" by being NULL. No code elsewhere reads a `jobs.technician_signature_at` field, so there's no stale consumer to update. The related `job_service_records` logic is untouched and continues to use its own, correctly-named column.

Verification: queried the live DB for the real set of columns on `jobs` before editing; reproduced the corrected payload inside a rolled-back transaction on the live DB and confirmed the UPDATE succeeds; typecheck clean. Remaining manual verification: admin reassigns a job in the live app and sees the "Job reassigned to <name>" toast.

---

## [2026-04-09] — Perf: JobBoard accept/reject is now 1.5–3s faster — trigger-based admin notifications + in-place job patching

### Fixes

**Technicians could not accept assigned jobs.** The toast read "Failed to accept job — could not embed because more than one relationship was found for jobs and job_media". This is the same symptom the 2026-04-07 fix (commit 132f1fa) tried to resolve, but that fix used a column-name disambiguation hint (`media:job_media!job_id(*)`) which PostgREST/Supabase was silently failing to resolve. Every job fetch that embedded media — not just accept, but any path through the service layer — was returning the ambiguity error because the 2026-04-07 migration added a second FK between `jobs` and `job_media` (`jobs.technician_rejection_photo_id → job_media.media_id`) on top of the existing `job_media.job_id → jobs.job_id`, and PostgREST could no longer pick a relationship automatically.

The durable fix is to disambiguate by **foreign-key constraint name**, which is PostgREST's canonical mechanism for multi-FK relationships. Before editing any code, the live Supabase DB was queried via `pg_constraint` to read the actual constraint names rather than guessing — they are `job_media_job_id_fkey` (the one the embed should use) and `jobs_technician_rejection_photo_id_fkey` (the ambiguity source). Every occurrence of `media:job_media!job_id(*)` across the service layer was then rewritten to `media:job_media!job_media_job_id_fkey(*)` — 29 replacements across 9 files (`services/jobChecklistService.ts`, `services/jobMediaService.ts`, `services/jobAssignmentCrudService.ts`, `services/serviceScheduleService.ts`, `services/jobStatusService.ts`, `services/jobService.ts`, `services/jobInvoiceService.ts`, `services/supabaseClient.ts`, `services/customerService.ts`).

**Why this is the right fix in the long run, not a patch:** it matches PostgREST's documented disambiguation contract; it is stable against future FKs added between the same two tables (adding a third FK would not reintroduce the ambiguity); it preserves the referential integrity the 2026-04-07 migration established for rejection photos (no FK was dropped); and it is local to the query layer — no schema migration, no RLS change, no trigger change, no frontend change. The two alternative options considered were dropping the second FK (lost RI for the sake of shorter embed strings — rejected) and a two-step fetch in the accept handler only (would unblock accept but leave ~28 other embed sites broken — rejected).

Verification: `npm run typecheck` clean after the rewrite; live DB confirms `job_media_job_id_fkey` exists; remaining check is manual — a technician clicking Accept on an assigned job in the live app should now succeed with a "Job accepted" toast instead of the embed error.

---

## [2026-04-08] — FT Tooling Stack: CLAUDE.md, Skills, Project-Scoped Agent, Memory Architecture

### Changed

**FT now has a first-class Claude Code tooling stack — no more re-deriving conventions on every session.**
- `CLAUDE.md` added at the project root. Auto-loaded by Claude Code whenever cwd is inside `/home/jay/FT`. Documents tech stack, scripts, `WORK_LOG.md` + `docs/CHANGELOG.md` formats, pre-commit hook behavior, Stop-hook auto-commit implications, services-layer split, JobDetail hooks pattern, known landmines (the `media:job_media!job_id(*)` embed hint, the `jobService.ts` facade, the Phoenix-gated pre-commit audit), and the realtime self-echo gotcha with its `lastSeenUpdatedAtRef` fix.
- `.claude/agents/ft-expert.md` added as a **project-scoped** subagent. Invoked via `Agent` with `subagent_type: ft-expert`. Reads `CLAUDE.md` + the canonical living memory file on every invocation, and appends durable session observations to daily logs in the clawd memory tree for Phoenix Dream consolidation. Default mode is research-and-report; does not write code unless told to. Only visible when cwd is inside FT.
- Two user-level skills added in `~/.claude/skills/`: `/ft-bugfix` (explore → diagnose → present 2-3 options → **stop for user approval** → implement → typecheck → invoke `/ft-doc`) and `/ft-doc` (generates `WORK_LOG.md` + `docs/CHANGELOG.md` entries from current `git diff` in FT's exact narrative format).
- PostToolUse hook added in `~/.claude/settings.json`. Auto-runs `npm run typecheck` after any Edit/Write inside `/home/jay/FT`. Catches type errors immediately instead of at session end.
- Memory architecture (two layers): canonical living memory at `/home/jay/clawd/memory/projects/fieldpro.md` (tracked, consolidated by Phoenix Dream); gitignored scratch at `/home/jay/FT/.claude/memory/` (mid-session personal notes). `fieldpro.md` was refreshed from its 2026-02-07 state with current conventions, landmines, tooling pointers, and the 2026-04-07 + 2026-04-08 historical incidents. `.gitignore` updated to exclude `.claude/memory/`.
- Motivation: every FT session was starting from zero — re-asking "what's the CHANGELOG format", "what does pre-commit gate", "what services are there", "how does realtime interact with mutations". The new stack encodes all of this once, so future sessions (and the `ft-expert` agent) load it automatically without prompting. The `/ft-bugfix` skill also enforces the user's documented "assess before execute" preference by making the options-then-approval gate a hard-coded phase, not a voluntary best-practice.
- Caveat: Phoenix Dream cron is not currently scheduled. `ft-expert` will still append daily logs normally; invoke `/dream` manually when you want consolidation to promote signals into `fieldpro.md`.
- Files touched: `CLAUDE.md` (new), `.claude/agents/ft-expert.md` (new), `.claude/memory/README.md` (new, gitignored dir placeholder), `.gitignore` (one new entry), `docs/CHANGELOG.md` (this entry). No application code touched — pure tooling / infrastructure.

---

## [2026-04-08] — Technician "Could Not Save" on Job Done + Recommendation (Realtime Self-Echo Race)

### Fixes

**Technician saving Job Carried Out + Recommendation got "Could not save" / "AboutError: signal is aborted without reason" — even though the DB row was actually updated.**
- Client report: technicians tapping Save on the Job Carried Out / Recommendation form saw a red toast with the abort message. Confusingly, the field appeared correctly on next refresh — the abort fired *after* the database row had already been written.
- Root cause: race between the save handler and the Supabase realtime self-echo. `handleSaveJobCarriedOut` (`pages/JobDetail/hooks/useJobActions.ts:744`) does the right thing — it `await`s `MockDb.updateJob(...)` and applies the returned row via `setJob({...updated})`. But the `postgres_changes` UPDATE event for that same write is broadcast back milliseconds later, while the save's PostgREST response is still in flight. The realtime listener at `pages/JobDetail/hooks/useJobRealtime.ts:84` calls `onJobUpdated()` → `loadJob()` (`pages/JobDetail/hooks/useJobData.ts:35`), which fans out a fresh `getJobById` (multiple parallel Supabase queries). The new request tears down the in-flight save's connection, its `AbortSignal` fires, the original `await` rejects with `"signal is aborted without reason"`, and the catch-block toast displays the misleading "Could not save". The DB write had already succeeded — only the response was lost.
- Fix: dedupe realtime self-echoes against the most recently locally-applied job revision, instead of band-aiding the race with timeouts or per-handler save flags. `pages/JobDetail/hooks/useJobDetailState.ts` adds `lastSeenUpdatedAtRef = useRef<string|null>(null)` and bumps it inside `setJob()` whenever a job row with `updated_at` is applied. `pages/JobDetail/hooks/useJobData.ts` threads the ref into `useJobRealtime`. `pages/JobDetail/hooks/useJobRealtime.ts` short-circuits the `postgres_changes` UPDATE handler when `payload.new.updated_at === lastSeenUpdatedAtRef.current` — that event is the echo of a write the local UI just made, so it skips both the toasts and the redundant `loadJob()`. Remote updates from other devices/sessions still flow through normally because their `updated_at` won't match the local ref.
- `types/job-core.types.ts` gained `updated_at?: string` on the `Job` interface. The DB column already existed and was in the realtime payload — only the TS type was missing it.
- Considered alternatives: (1) `savingRef` flag to suppress realtime during a save — fragile, would have to be added to every mutation handler and reintroduces the same bug whenever a new handler is added; (2) debouncing the realtime reload — only narrows the race window, doesn't eliminate it, and adds latency to legitimate remote updates. Option (3), the self-echo dedupe via `updated_at` comparison, is the actual fix because it removes the redundant request entirely instead of trying to time around it.
- Bonus wins: every other mutation handler in `useJobActions.ts` that already follows the `setJob({...updated})` pattern (description edit, extra charges, parts, helper assign/remove, etc.) inherits the same dedupe for free with no per-handler bookkeeping. Cuts one wasted `getJobById` round-trip off every save. Toasts like "Status changed to X" no longer double-fire on your own status changes.
- Scope notes: `useJobActions.ts` was not touched — the handlers were already correct. The `job_requests` realtime subscription was left alone (it has no race because requests aren't reloaded by mutation handlers). No per-handler flags introduced. The fix is one piece of state that covers every current and future mutation on `useJobDetailState`.
- Verification: `npx tsc --noEmit` clean. Manual test: technician opens a job, edits Job Carried Out + Recommendation, taps Save → success toast, no abort error, value persists. Cross-device sanity: a second browser changing status still produces the "Status changed" toast on the first browser, confirming legitimate remote updates aren't filtered.

---

## [2026-04-07] — Repair Jobs Blocked at Completion by Checklist Trigger

### Fixes

**Repair jobs could not be marked complete: "Cannot complete job: Checklist has not been filled."**
- Client report: technicians completing a Repair job were blocked at the "Awaiting Finalization" transition with the above error, even though Repair jobs are not supposed to require a forklift condition checklist.
- Root cause: the DB trigger function `validate_job_completion_requirements` (fired by `trg_validate_completion` on `jobs` UPDATE) raises when both `service_record.checklist_data` and `jobs.condition_checklist` are empty — with **no exemption for Repair jobs**. The frontend already exempts Repair (`pages/JobDetail/hooks/useJobActions.ts:346`, `pages/JobDetail/utils.ts:37` — `getMissingMandatoryItems()` returns `[]` for Repair), so this was a frontend/DB drift bug: the UI let the request through, the trigger killed it.
- Fix: `CREATE OR REPLACE FUNCTION validate_job_completion_requirements()` adding one branch — `IF NEW.job_type IS DISTINCT FROM 'Repair' THEN <existing checklist check> END IF;`. Every other completion gate (job started, service notes / job carried out, parts recorded or `no_parts_used`, technician signature, customer signature) is left untouched. Repair jobs still need all of those — only the forklift condition checklist is now exempt, matching the frontend rule.
- The condition checklist is a forklift safety/condition inspection list (horn, lights, beacon, seatbelt, brakes, steering, etc.) — it's only meaningful for inspection-type jobs (`Service`, `Full Service`, `Checking`). Repair jobs are reactive fixes and have no inspection step.
- The other checklist-related trigger `validate_job_checklist` only sets flag columns (`checklist_completed`, `checklist_missing_items`) and honors `app_settings.checklist_enforcement_enabled`. It does not raise, so it was left untouched. This fix is scoped strictly to the blocking trigger.
- Migration: `supabase/migrations/20260407_repair_skip_checklist_completion.sql`. Applied directly to the live DB inside `BEGIN ... COMMIT` with a post-apply sanity check asserting the new branch is present in the deployed function body.
- No application code touched — the frontend was already correct.

---

## [2026-04-07] — Technician Job Accept Broken by Ambiguous `job_media` Embeds

### Fixes

**Technician Accept on a job assignment failed with "Could not embed because more than one relationship was found for 'jobs' and 'jobs_media'"**
- Root cause: today's earlier migration `20260407_fix_tech_rejection.sql` added `jobs.technician_rejection_photo_id UUID REFERENCES job_media(media_id)` so the on-site rejection photo proof can be linked to a job. That introduced a **second** foreign key between `jobs` and `job_media` — the first being the original `job_media.job_id → jobs` relationship. PostgREST can no longer infer which FK to use when an embed says `media:job_media(*)` and refuses the request.
- The technician Accept flow was the first user-visible failure (`jobStatusService.ts` re-fetches the job *with media* immediately after updating status), but every embed of `job_media` across the services layer was broken in the same way.
- Fix: changed every `media:job_media(*)` to `media:job_media!job_id(*)`. The `!job_id` hint tells PostgREST to use the FK on `job_media.job_id`, ignoring the new `jobs.technician_rejection_photo_id` direction. The migration and the new column are left intact — the rejection-photo linkage is intentional; the right place to disambiguate is on the embed side.
- 28 occurrences across 9 files updated:
  - `services/jobStatusService.ts`
  - `services/jobService.ts`
  - `services/jobMediaService.ts`
  - `services/jobChecklistService.ts`
  - `services/jobInvoiceService.ts`
  - `services/jobAssignmentCrudService.ts`
  - `services/customerService.ts`
  - `services/serviceScheduleService.ts`
  - `services/supabaseClient.ts` (both `DETAIL` and `DETAIL_FAST` selectors)
- Verified post-fix: a grep for `job_media\(` across `services/` returns no matches — every embed now carries an explicit FK hint.

---

## [2026-04-07] — JobBoard List Header/Row Column Width Drift

### Fixes

**Status column header no longer drifts 50px out of alignment with the rows below**
- User report: *"the status and the content below doesn't seem to align"*
- Root cause: an earlier fix today (commit `af201b4`) bumped the row's `#` column from `w-[150px]` to `w-[180px]` to fit the longer job# format, but the separate header definition in `pages/JobBoard/components/JobListTable.tsx:65` was still `w-[130px]`. The 50px drift pushed every column to the right of `#` out of alignment with its header label, with the Status column being the most visually obvious.
- Fix: bumped the header `#` column from `w-[130px]` to `w-[180px]` to match the row. Single-character edit. The other header column widths (Status, Scheduled, Title, etc.) were already in sync.
- Lesson learned: when changing a fixed-width column in a "table-like" flex layout, grep for the old width across the whole feature directory before patching one file in isolation. The header and row definitions are in separate files and easy to miss.
- File: `pages/JobBoard/components/JobListTable.tsx`

---

## [2026-04-07] — Renamed Existing Jobs to New Format + getRoleFlags Cleanup

### Chores

**Bulk-renamed the existing 29 jobs from `JOB-YYYYMMDD-NNNN` to `JOB-YYMMDD-NNN`**
- Follow-up to the format-shortening migration earlier today. Rather than letting the old and new formats coexist in the UI for weeks until the old jobs age out naturally, Jay opted to rename the existing 29 jobs in one shot for visual consistency.
- Safety probe before the rename: 29/29 jobs matched the old format exactly, 0 sequences over 999 (no risk of dropping a leading digit during the substring transform), 0 collisions with the renamed values.
- Executed via `UPDATE jobs SET job_number = 'JOB-' || SUBSTRING(job_number FROM 7 FOR 6) || '-' || SUBSTRING(job_number FROM 15 FOR 3) WHERE job_number ~ '^JOB-\d{8}-\d{4}$'` inside a `BEGIN ... COMMIT` transaction with a post-update sanity check. 29 rows updated, every remaining `job_number` now matches the new format. The mixed-format era is over.
- This was a one-off bulk update, not a migration file — the `generate_job_number()` function from earlier today handles new inserts.

**Dropped dead `job: Job | null` parameter from `getRoleFlags`**
- Identified during the post-purge null-safety audit: `pages/JobDetail/utils.ts:69` took a `job` parameter that the function body never actually read. It only used `currentUserRole`, `isCurrentUserHelper`, and `statusFlags`. The misleading signature was harmless but invited confusion (and was probably how the post-purge crash bug slipped past review — a future maintainer skimming the function would assume it handles `job` defensively).
- Fix: removed the parameter from the signature and from the single call site in `JobDetailPage.tsx:104`. Byte-equivalent at runtime — the function never read it, so dropping it is purely a clarity improvement. The `Job` type import in `utils.ts` is preserved because other functions in the file still use it.
- Files: `pages/JobDetail/utils.ts`, `pages/JobDetail/JobDetailPage.tsx`

---

## [2026-04-07] — Shorter Job Number Format + Pre-Guard Read Audit

### Features

**Job number format shortened from `JOB-YYYYMMDD-NNNN` to `JOB-YYMMDD-NNN`**
- Per client feedback after the demo: the 17-character format was visually heavy in the JobBoard list and on customer-facing reports. New format is 14 characters — two-digit year, three-digit per-day sequence (max 999/day, well above any realistic dispatch volume).

  | Format | Example | Length |
  |---|---|---|
  | Old | `JOB-20260407-0027` | 17 |
  | New | `JOB-260407-028` | 14 |

- Implemented as a single `CREATE OR REPLACE FUNCTION generate_job_number()` migration applied directly to the live DB. Per-day sequence reset semantics preserved (counts today's jobs + 1). The pre-existing race condition in `COUNT(*) + 1` is unchanged — that's a separate refactor.
- Existing 29 jobs in the live DB keep their old 17-character numbers. No collision risk because lengths differ; the `jobs_job_number_key` unique constraint still holds. The JobBoard list column stays at `w-[180px]` so both formats render cleanly until the old ones age out naturally — `overflow-hidden` is in place as a belt-and-suspenders guard. The inline comment above the column was updated to document that the width supports both formats.
- Files: `supabase/migrations/20260407_shorten_job_number_format.sql`, `pages/JobBoard/components/JobListRow.tsx`

### Chores

**Audited JobDetailPage for unguarded `job.X` reads in the pre-null-guard region**
- Follow-up to the post-purge crash fix earlier today. Swept `JobDetailPage.tsx` lines 60-148 (between the data hook and the `if (!job) return` guard at line 142) looking for any other reads that would crash on a null job.
- Result: every remaining `job` access is safe. Optional chains (`job?.customer_id`, `job?.contact_id`, `job?.site_id`), `enabled: !!job?.customer_id` gating on `useQuery` calls that use `job!` inside `queryFn`, and `getStatusFlags` / `getRoleFlags` which both handle a null `job` (the latter by accident — it doesn't actually use the parameter). The earlier `partsDeclared` line was the sole offender and is already fixed.
- No additional code changes from this audit. Documenting the result so we don't re-do the work next time.

---

## [2026-04-07] — JobDetailPage Crash on Null Job (Post-Purge Regression)

### Fixes

**Navigating to a deleted/missing job no longer crashes the app**
- User report: *"TypeError: Cannot read properties of null (reading 'parts_used')"* in `JobDetailPage`. The crash showed up immediately after the 93-job purge — anyone who had one of the deleted jobs open in their app and tried to interact with it hit this instead of the friendly "Job not found" screen.
- Root cause: the earlier "parts declaration required before completion" change added `const partsDeclared = job.parts_used.length > 0 || state.noPartsUsed;` to `pages/JobDetail/JobDetailPage.tsx:107`. This dereferences `job.parts_used` unconditionally, but the actual `if (!job) return ...` null guard sits 33 lines below at line 140. When `job` is null (initial render before data loads, or any deleted job), this line crashes before the fallback UI can render.
- Fix: changed the unguarded dereference to an optional-chain + nullish-coalesce: `(job?.parts_used?.length ?? 0) > 0 || state.noPartsUsed`. When `job` is null this evaluates to `state.noPartsUsed`, which is safe — the downstream `partsDeclarationRequired` and `completionBlocked` are also null-safe via the existing `roleFlags.isTechnician` check (which is `false` for a null job). The Complete button is never rendered for a null job anyway because the entire return block is gated by the early return.
- Added an inline comment above the line explaining the null-safety requirement so a future maintainer doesn't innocently revert it.
- File: `pages/JobDetail/JobDetailPage.tsx`

---

## [2026-04-07] — Job# Column Overflow + ConfirmationStatusCard Mobile Overflow

### Fixes

**JobBoard list: job# column no longer overflows into adjacent cells**
- Live DB query confirmed all 29 job_numbers are 17 characters long (`JOB-YYYYMMDD-NNNN` format like `JOB-20260407-0001`). Earlier Sonnet sizing iterations from 2026-04-06 (130 → 170 → 130 → 150) were all based on a wrong assumption about format length and never tested against the production format. The current 150px column with `whitespace-nowrap` (added in a previous "never clip the last digit" fix) wasn't wide enough — the text bled past its container into neighbouring columns.
- Bumped the desktop Star+Job# column to `w-[180px]` (`pages/JobBoard/components/JobListRow.tsx:275`), which fits 17 chars + `#` prefix in mono `text-sm` (~130px text + 24px star + 6px gap) with margin. Added `overflow-hidden` as a belt-and-suspenders guard so any future longer format clips rather than bleeds. The mobile (article) layout is unchanged — it uses flex-wrap, not fixed widths.
- File: `pages/JobBoard/components/JobListRow.tsx`

**ConfirmationStatusCard rows no longer burst out of the card on mobile**
- Both rows (Parts Confirmation and Job Confirmation) used `flex items-center justify-between` with the right side marked `shrink-0`. When the confirmer name is long (e.g., "BEE PHENG SIANG") + the date span + the CheckCircle icon, the right side's intrinsic width exceeded the container's available width on mobile (~310px usable after padding). With `shrink-0` the right side refused to compress and visually overflowed the rounded card.
- Changed both row containers to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`. On screens < `sm` (640px) the rows now stack vertically — left header on top, status/name/date on a wrapped row below. On `sm+` they remain side-by-side. Removed `shrink-0` from the right side and added `flex-wrap`, `min-w-0`, and `sm:justify-end` so the right side can wrap if still tight, and right-aligns when on the same row.
- File: `pages/JobDetail/components/ConfirmationStatusCard.tsx`

---

## [2026-04-07] — One-Off Purge: Hard-Deleted All Jobs Before 2026-04-06 (Executed)

### Chores

**Hard-deleted 93 jobs created before 2026-04-06 via `scripts/2026-04-07_purge_old_jobs.sql`**
- Client requested removing all jobs older than 2026-04-06 to clean up the working set after the demo. **Executed live at 2026-04-07 18:35** — destructive and not reversible from this side. Recovery from here requires Supabase point-in-time-recovery.
- Phase 0 schema introspection mapped all 30 foreign keys referencing the `jobs` table: 16 CASCADE (handled automatically), 1 SET NULL, 13 NO ACTION. Of the 13 NO ACTION FKs, 10 columns are nullable (dependent records preserved by setting their FK to NULL) and 3 are NOT NULL (`customer_acknowledgements`, `service_upgrade_logs`, `van_stock_usage` — hard-deleted).
- Scope: **ALL 93 jobs** in the date range 2026-03-05 → 2026-04-04, **including 55 active jobs** (42 Assigned + 13 In Progress). Per Jay's explicit confirmation.
- The script ran inside a single `BEGIN ... COMMIT` transaction with 6 numbered phases: snapshot in-scope IDs to a temp table → null out nullable FK references → hard-delete NOT NULL FK dependents → delete notifications → `DELETE FROM jobs` (CASCADE handles ~16 child tables) → sanity checks. A dry-run via `BEGIN ... ROLLBACK` was performed beforehand and the row counts matched exactly when the real run executed.
- **Final execution counts**:

  | Step | Rows |
  |---|---|
  | Jobs deleted | **93** |
  | `notifications` deleted | 419 |
  | `hourmeter_history.job_id` set NULL | 51 |
  | `inventory_movements.job_id` set NULL | 23 |
  | `van_stock_usage` hard-deleted | 2 |
  | `customer_acknowledgements` hard-deleted | 0 |
  | `service_upgrade_logs` hard-deleted | 0 |
  | All other nullable FK updates | 0 |
  | CASCADE child tables (job_parts, job_media, job_invoices, job_assignments, job_audit_log, etc.) | handled automatically |

- **Post-execution sanity checks**: 0 jobs older than 2026-04-06 remain (PASS); 29 total jobs left in the table; 10 pre-existing orphan notifications noted (these reference jobs already deleted in a prior cleanup, not introduced by this purge).
- File: `scripts/2026-04-07_purge_old_jobs.sql`

---

## [2026-04-07] — 15-Minute No-Reply Re-Alert for Job Assignments

### Features

**Admins are now re-alerted every 15 minutes when a technician doesn't respond to an assignment**
- Client requested: *"If job is not replied by 15 mins, re-send alert to admin to either re-assign or check with technician."*
- Phase 0 live DB introspection uncovered three sub-bugs that had to be fixed together: (a) the `technician_response_deadline` column the TS type already declared had never actually been added to the live `jobs` table, (b) `assignJob()` never set the deadline (would have failed anyway), so the frontend countdown timer at `pages/JobDetail/utils.ts:21` always returned null, and (c) `checkExpiredJobResponses()` existed in `services/jobAssignmentCrudService.ts` but was never invoked from anywhere — no scheduler.
- The fix is **fully server-side**, zero JS/TS changes. Migration `supabase/migrations/20260407_assignment_response_alerts.sql`:
  - Adds three columns: `technician_response_deadline` (the timer the frontend already reads), `last_response_alert_at` (15-min throttle), and `response_alert_count` (cap at 4 alerts = 1 hour total nagging window).
  - Backfills `technician_response_deadline = assigned_at + 15 minutes` for the 120 currently-assigned jobs.
  - Backfills `last_response_alert_at = NOW()` for the 50 currently-stale assignments so the new system doesn't burst-fire ~50 historical notifications on the very first cron tick after deployment. They re-alert at the normal 15-minute cadence from there.
  - Adds trigger `trg_set_response_deadline` (BEFORE INSERT OR UPDATE OF assigned_at) that auto-populates `technician_response_deadline` and resets the alert tracker whenever a job is freshly assigned. Because this lives in the trigger, `assignJob()` and any other path that writes `assigned_at` gets the deadline for free — that's why no service code change is needed.
  - Adds new SECURITY DEFINER function `escalate_assignment_response()` that finds assigned jobs past their deadline (with a 24-hour lookback cap, so historical stale data doesn't pollute the alert stream), increments the count, updates the last-alerted timestamp, and inserts one notification per active admin/admin_service/supervisor. The notification title includes the iteration counter (e.g., *"(2/4)"*) and the final alert switches priority to `urgent` with the message *"This is the final automatic reminder — please reassign or contact the technician."*
  - Amends the existing `run_escalation_checks()` (called every 5 minutes by the existing `escalation-checks` pg_cron job) to also call the new worker. **No new cron job** — the existing 5-min schedule picks it up automatically.
- The frontend countdown timer in `JobHeader.tsx:153` starts working automatically as soon as a job has a non-null deadline (any new assignment or any of the 120 backfilled rows).
- Migration applied directly to the live DB and verified: all 3 columns present, 120 deadlines backfilled, 50 stale jobs suppressed, dry-run of the new function returned 0 alerts (correct — all stale jobs suppressed for 15 minutes, then they ramp up at the normal cadence).
- Files: `supabase/migrations/20260407_assignment_response_alerts.sql`

---

## [2026-04-07] — Technician Job Rejection Unblocked + On-Site Photo Proof

### Fixes

**Technician rejection no longer blocked by status-transition trigger**
- Client reported: *"Failed to reject job, only admin or supervisor can move jobs backward."*
- Root cause confirmed via live DB introspection: the `validate_job_status_transition` trigger function in the live `public` schema rejected ALL backward status transitions for non-admin/non-supervisor users. The technician rejection flow legitimately moves a job from `Assigned` back to `New` (it's the only way to release the assignment back to dispatch), so it was permanently blocked. The function lived in `database/historical/` locally — meaning the migration had been deployed, then the file was archived without dropping the trigger.
- Fix applied via `supabase/migrations/20260407_fix_tech_rejection.sql`: `CREATE OR REPLACE FUNCTION validate_job_status_transition` adds one tightly-scoped whitelist branch — a technician can backward-transition their OWN currently-assigned job from `Assigned` to `New` *only when* `NEW.technician_rejected_at IS NOT NULL` and `NEW.assigned_technician_id IS NULL`. Every other backward-transition guard remains exactly as before. Migration applied directly to the live DB inside a transaction and verified post-apply.

### Features

**Rejection now requires reason + on-site photo with GPS**
- Per client feedback, rejecting a job is no longer a free action — the technician must (a) provide a written reason and (b) capture an on-site photo with GPS coordinates so admins can verify the rejection was made on-site (e.g., weather condition, blocked access, customer not present).
- The same migration adds a nullable `jobs.technician_rejection_photo_id` UUID column with a foreign key to `job_media(media_id) ON DELETE SET NULL`. The rejection photo is uploaded via a new standalone helper at `services/rejectionPhotoUpload.ts` which captures GPS in parallel with image compression, uploads to the `job-photos` storage bucket, and inserts a `job_media` row with `category='rejection_proof'`. The new `media_id` is then written to `jobs.technician_rejection_photo_id` so the rejection proof is permanently linked to the job.
- GPS is **required**, not best-effort. If the technician denies geolocation permission or it's unavailable, the upload throws and the rejection is blocked with the error *"Location access is required to reject a job."* This is intentional — the whole point of the photo is on-site verification.
- The `RejectJobModal` (`pages/JobDetail/components/JobDetailModals.tsx`) was extended with a tap-to-capture photo slot using native `<input type="file" capture="environment">` so it works on mobile cameras and desktop file pickers alike. Selecting a photo shows a preview with an X to remove. The confirm button gates on `(reason && photo && !uploading)`. While uploading, both Cancel and Reject Job are disabled, and the button text becomes "Uploading...".
- Helpers, admin-service, and supervisors are unaffected — the rejection flow only renders for lead technicians on jobs in the pre-acceptance state.
- Deferred to a follow-up: a dedicated banner on the admin's view of the rejected job showing the rejection reason and photo thumbnail. For now the photo is visible in the existing job media gallery under the `rejection_proof` category.
- Files: `supabase/migrations/20260407_fix_tech_rejection.sql`, `services/rejectionPhotoUpload.ts`, `services/jobAssignmentCrudService.ts`, `types/job-core.types.ts`, `pages/JobDetail/components/JobDetailModals.tsx`, `pages/JobDetail/hooks/useJobActions.ts`, `pages/JobDetail/hooks/useJobDetailState.ts`, `pages/JobDetail/JobDetailPage.tsx`

---

## [2026-04-07] — Service Report Show/Hide Prices Confirmation

### Features

**Confirm price visibility before printing service reports**
- Client requested a confirmation prompt when generating service reports so the same job can produce either a customer-facing copy (no prices) or an internal copy (with prices) without needing two separate report templates.
- Clicking **Print Service Report** now opens a small `ReportOptionsModal` with two buttons: **"Hide Prices (Customer Copy)"** (primary) and **"Show Prices (Internal Copy)"** (secondary). Hide-prices is the visually-primary action since most reports are customer-facing.
- The `showPrices` flag is threaded through both render paths in `components/ServiceReportPDF.tsx`: the React component (`ServiceReportPDF`) and the duplicated HTML-string template inside `printServiceReport()`. Gating both was critical — the prices were rendered twice and gating only one would have silently leaked them through the print window.
- When `showPrices === false`, the report omits the "Unit Price" and "Amount(RM)" columns, the empty filler cells for those columns, and the entire `<tfoot>` containing Labor and TOTAL. Quantities, descriptions, item codes, and the rest of the report are unchanged.
- New state `showReportOptionsModal` lives on `useJobDetailState`; `useJobExportActions` exposes a new `handleConfirmPrintServiceReport(showPrices)` that the modal calls. The export modal is also added to `hasModalOpen` so the mobile sticky bar hides while it's open.
- Invoices (`InvoicePDF.tsx`) are unchanged for now — they're invoices, prices belong on them.
- Files: `components/ServiceReportPDF.tsx`, `pages/JobDetail/components/JobDetailModals.tsx`, `pages/JobDetail/components/index.ts`, `pages/JobDetail/hooks/useJobExportActions.ts`, `pages/JobDetail/hooks/useJobDetailState.ts`, `pages/JobDetail/JobDetailPage.tsx`

---

## [2026-04-07] — Parts Declaration Required Before Completion

### Fixes

**Lead technicians must declare parts usage before completing a job**
- The Complete button was previously enabled even when a technician had neither added any parts nor ticked the "No parts were used" checkbox, allowing jobs to be closed without an explicit parts declaration. Client feedback flagged this as a data-quality issue.
- `JobDetailPage.tsx` now derives `partsDeclared = job.parts_used.length > 0 || noPartsUsed` and `partsDeclarationRequired` (lead technicians only — helpers, admin-service, and supervisors are unaffected). `completionBlocked` includes this condition, gating the mobile sticky-bar Complete button. A new "Parts declaration required" amber chip joins the existing "After photo needed" / "Hourmeter needed" / "Signatures missing" warning row.
- `JobHeader.tsx` (desktop) Complete button now also gates on `partsDeclarationRequired`, with a tooltip reading *"Declare parts usage or tick 'No parts were used'"*.
- `MobileTechnicianWorkflowCard.tsx` accepts a new `partsDeclared` prop and includes "Parts declaration" in its blockers list, so the guided workflow card and its disabled-state messaging stay consistent with the sticky bar.
- The `USER_GUIDE.md` completion checklist already documented this requirement; only the runtime enforcement was missing.
- Files: `pages/JobDetail/JobDetailPage.tsx`, `pages/JobDetail/components/JobHeader.tsx`, `pages/JobDetail/components/MobileTechnicianWorkflowCard.tsx`

---

## [2026-04-07] — Repair Job Completion Unblocked

### Fixes

**Repair jobs no longer blocked by checklist warning on completion**
- `getMissingMandatoryItems` in `utils.ts` now returns `[]` immediately for `JobType.REPAIR`, enforcing the exemption at the source rather than relying solely on the caller
- Previously, `job_type` being `undefined` (it's optional on the `Job` type) caused `undefined !== 'Repair'` to evaluate `true`, triggering the `ChecklistWarningModal` with all items flagged as missing — permanently blocking completion
- Also: imported `JobType` enum into `useJobActions.ts` and replaced the raw string `'Repair'` with `JobType.REPAIR` at the call site for type safety
- Files: `pages/JobDetail/utils.ts`, `pages/JobDetail/hooks/useJobActions.ts`

---

## [2026-04-06] — Technician View Cleanup + List Row Fix

### Fixes

**QuickStats hidden for technician role**
- Active / New / Assigned / In Progress / Awaiting / Completed stat tiles are now hidden when the logged-in user is a technician
- Those tiles show fleet-wide dispatch counts with admin-centric hints ("Needs assignment", "Queued for dispatch") that are irrelevant noise for technicians
- File: `pages/JobBoard/JobBoard.tsx`

**List row job# column width reverted**
- Previous fix widened the Star+Job# column from 130px → 170px which squeezed adjacent columns
- Reverted to 130px; `whitespace-nowrap` (replacing `truncate`) is sufficient since job numbers fit comfortably within the original width
- File: `pages/JobBoard/components/JobListRow.tsx`

---

## [2026-04-06] — Job Board Auto-Commit Hook + Job Number Readability

### Config

**Stop hook auto-commits FT changes at session end**
- Added an agent-type `Stop` hook to `/home/jay/FT/.claude/settings.json`
- At the end of every Claude session, if uncommitted FT changes exist: the agent updates CHANGELOG.md and WORK_LOG.md then runs `git add -A && git commit && git push`
- Zero overhead when there are no uncommitted changes (exits immediately on clean `git status`)
- Existing TypeScript check Stop hook is unaffected

### Fixes

**Job number no longer squeezed on Job Board**
- List view (JobListRow): Star + Job# column was `w-[130px]` — star icon took ~30px leaving only 100px for the number; long numbers were silently truncated. Widened to `w-[170px]` and replaced `truncate` with `whitespace-nowrap`
- Card view (JobCard): star+badge inner div lacked `shrink-0`, allowing flex layout to compress it; job number badge had no `whitespace-nowrap`, allowing text to wrap mid-number. Both fixed
- Files: `pages/JobBoard/components/JobListRow.tsx`, `pages/JobBoard/components/JobCard.tsx`

---

## [2026-04-06] — External Forklift Fix + Admin Job Description Edit

### Features

**Admin 1 can now edit job description on Job Detail**
- `admin` and `admin_service` (Admin 1) roles now see an **Edit** button next to the Description field on the Job Detail page
- Clicking Edit reveals an inline textarea; Save persists the change via `updateJob`; Cancel reverts with no DB call
- Edit button is hidden on completed jobs and for all other roles (supervisor, technician, accountant, admin_store)
- Files: `pages/JobDetail/components/CustomerAssignmentCard.tsx`, `pages/JobDetail/hooks/useJobDetailState.ts`, `pages/JobDetail/hooks/useJobActions.ts`, `pages/JobDetail/JobDetailPage.tsx`

### Fixes

**External forklift "Add & Select" now correctly creates the forklift instead of submitting the job**
- Root cause: `ExternalForkliftSection` rendered a `<form>` nested inside the outer job creation `<form>` — browsers treat nested forms as invalid HTML and associated the "Add & Select" submit button with the outer form, submitting the job immediately with no forklift linked
- Fix: replaced the inner `<form>` with a `<div>` and changed the button to `type="button" onClick={handleAdd}`
- Secondary fix: `getForkliftsForList` now selects `ownership_type` so the post-creation `useEffect` correctly sets `billing_type: 'chargeable'` for external forklifts instead of resetting it to `'rental-inclusive'`
- Also corrected external forklift creation status from deprecated `'Active'` to `'Available'`
- Files: `pages/CreateJob/components/ExternalForkliftSection.tsx`, `services/forkliftService.ts`, `pages/CreateJob/hooks/useCreateJobForm.ts`

---

## [2026-04-06] — Job Detail Fixes + Inventory Stock Sync

### Data

**Inventory stock sync (Apr 6 snapshot)**
- Strict sync script (`scripts/strict-sync-inventory.py`) applied ACWER's Apr 6 stock snapshot to the `parts` table
- 3,303 items reconciled: names, quantities, costs, categories, and bin locations updated to match source
- 3 extras (`58650-23060`, `S-02474`, `TVH/6656`) retained — referenced in active van stock, cannot be deleted
- Source file: `data/acwer-inventory-cleaned.json` (derived from `Stock_as_at_06.04.26_11.16am.csv`)
- Script: `scripts/strict-sync-inventory.py` — delete extras, insert missing, update common, verify post-sync

---

## [2026-04-06] — Job Detail and Create Job Reliability Fixes

### Fixes

**External Forklift Add flow now keeps the newly created unit selected**
- Creating an external forklift from the Create Job flow succeeded in the database, but the forklift list cache stayed stale
- Root cause: `useForkliftsForList` was not refreshed after `createForklift()`, so the new unit was missing from the dropdown and the form looked like the data vanished
- Fix: invalidate the `['forklifts', 'list']` query immediately after successful external forklift creation so the dropdown reloads and the new forklift remains selectable
- File: `pages/CreateJob/hooks/useCreateJobForm.ts`

**Job Detail Reassign button hardened**
- The reassign entrypoint and modal actions now use explicit `type="button"` behavior instead of relying on implicit button defaults
- This avoids dead or swallowed clicks in the Job Detail reassignment flow and makes the interaction deterministic
- Files: `pages/JobDetail/components/CustomerAssignmentCard.tsx`, `pages/JobDetail/components/JobDetailModals.tsx`

## [2026-04-05] — Technician UX, Bulk Sign Fix, Star Jobs, Van Stock Performance

### Features

**Rejection Proof Photo (mandatory on job rejection)**
- Technicians must now take a live camera photo when rejecting a job assignment
- Canvas overlay burns the timestamp and GPS coordinates directly into the image pixels (tamper-evident, surveillance-style bar at bottom)
- Photo is uploaded to `job-photos` Supabase bucket and stored as a `job_media` record with `category = 'rejection_proof'`
- The rejection reason text is stored in `media.description` so it persists even after the job is reassigned and `technician_rejection_reason` is cleared
- **Timeline**: rejection events now appear in the Job Timeline with thumbnail (lightbox), reason quote, and GPS coordinates
- **Photos section**: `rejection_proof` added as a new `MediaCategory` and filter option
- Files: `RejectJobModal.tsx`, `useJobAcceptance.ts`, `JobBoard.tsx`, `JobTimeline.tsx`, `common.types.ts`, `constants.ts`

**Star Job — Shared Attention Flag**
- Admins, supervisors, and the assigned technician can star a job to flag it as needing attention
- Star is a **shared flag** visible to all users — pinned jobs float to the top of everyone's board (above Emergency and Slot-In SLA)
- DB: `is_starred boolean NOT NULL DEFAULT false` on `jobs` table with a partial index (only indexes `true` rows)
- Star button sits beside the job ID on both card and list views; amber colour with ring when starred
- DB migration: `supabase/migrations/20260404_add_job_pinned_by.sql` (renamed to reflect final design)
- Files: `jobStarService.ts`, `useJobFilters.ts`, `JobCard.tsx`, `JobListRow.tsx`, `JobListTable.tsx`, `JobBoard.tsx`, `job-core.types.ts`, `supabaseClient.ts`

**Enriched Job Timeline**
- **Work started** event from `repair_start_time` (only shown when >2 min distinct from `started_at`)
- **Work completed** event from `repair_end_time` — when the after photo was taken and timer stopped
  - Shows after-photo thumbnail (click to open lightbox)
  - GPS coordinates if captured
  - Amber **Repair time: Xh Ym** duration badge
- Vertical connector line between events for visual flow
- Lightbox now covers both rejection proof photos and after photos
- Labels updated: `Job created`, `Job started`, `Work started`, `Work completed`, `Sign-off completed`
- File: `JobTimeline.tsx`

### Fixes

**Signature Name Fix on Job Reassignment**
- When a job was reassigned to a new technician, the old technician's signature persisted — new tech's name never appeared
- Root cause: `reassignJob` cleared `technician_accepted_at` but not `technician_signature`
- Fix: added `technician_signature: null` and `technician_signature_at: null` to the `reassignJob` update payload
- File: `jobAssignmentCrudService.ts`

**Repair Job Checklist Exemption**
- Per client request, Repair job type (`job_type === 'Repair'`) no longer requires the condition checklist
- Checklist section hidden from job detail page for Repair jobs
- Start Job modal (Step 2) hides checklist grid and unblocks the Start button without `allChecked`
- Completion check in `handleStatusChange` skips `getMissingMandatoryItems` for Repair jobs
- Mobile workflow card label reads "Start with photos" instead of "Start with checklist and photos"
- Files: `JobDetailPage.tsx`, `JobDetailModals.tsx`, `useJobActions.ts`, `MobileTechnicianWorkflowCard.tsx`

**Bulk Sign — Wiring, Status Transition, After-Photo Gate**
- `bulkSwipeSignJobs` was writing signatures but never transitioning jobs to `AWAITING_FINALIZATION` — jobs sat permanently as "In Progress" after bulk signing
- Fix: after both signatures succeed, calls `updateJobStatus(AWAITING_FINALIZATION)` per job via `Promise.allSettled` (individual failures don't block others — shows warning count)
- After-photo gate: jobs without an after photo are shown greyed out in the selection list with "upload after photo first" label — only eligible jobs are pre-selected and checkable
- `forklift.serial` → `forklift.serial_number` (field name was wrong, always showed N/A)
- IC number added to submit button disabled guard (was missing, relied only on SwipeToSign disabled state)
- Site address now uses `customer_site.site_name` instead of customer general address
- `SiteSignOffBanner` ready count now only counts jobs with after photo uploaded
- Files: `BulkSignOffModal.tsx`, `SiteSignOffBanner.tsx`

**Van Stock Fast Updates + Searchable Part LOV**
- Van stock data hooks (`useVanStockData`, `useVanStock`) migrated to React Query — mutations now do a background `invalidateVanStock()` instead of `setLoading(true)` + full refetch; no UI blanking
- `useSearchParts` hook added to `useQueryHooks.ts` — server-side part search via `getPartsPage` (same pattern as `useSearchCustomers`)
- `AddItemModal` (van stock) and `AdjustStockModal` (inventory): plain `<select>` replaced with `Combobox` + `useSearchParts`; `availableParts` prop and upfront `getParts()` prefetch removed
- New React Query hooks: `useAllVanStocks`, `useVanStockByTechnician`, `useReplenishmentsPending`, `useReplenishmentsByTech`
- Files: `useQueryHooks.ts`, `useVanStockData.ts`, `useVanStock.ts`, `AddItemModal.tsx`, `AdjustStockModal.tsx`, `VanStockPageMain.tsx`, `InventoryPageMain.tsx`

**Job Parts Combobox — Search by Item Code**
- `partOptions` subLabel updated to include `part_code` as the first element: `PRT-001 · RM12.50 · Stock: 8`
- The existing client-side Combobox filter searches `subLabel`, so admins can now type either a part name or item code to find parts
- File: `JobDetailPage.tsx`

**Continue Tomorrow — Reason Now Saved + No Scroll-to-Top**
- `markJobContinueTomorrow` had a placeholder `notes: supabase.rpc ? undefined : undefined` — reason was only `logDebug`'d, never persisted
- Fix: fetches current notes array and appends `[Continue Tomorrow — DD Mon YYYY — UserName]: reason`; admin can see reason in job Notes section
- `loadJob({ silent: true })` added to prevent scroll-to-top on mobile after confirming
- Files: `jobStatusService.ts`, `useJobActions.ts`

**Part Request Submit — No Scroll-to-Top on Mobile**
- After submitting/approving/rejecting a part request, `loadJob()` called `setLoading(true)` which re-rendered from scratch and scrolled to top
- Fix: `loadJob` accepts `{ silent?: boolean }` option; all post-mutation refreshes in `useJobRequestActions` use `loadJob({ silent: true })`
- Files: `useJobData.ts`, `useJobRequestActions.ts`

### Database Changes

| Table | Change |
|-------|--------|
| `jobs` | Added `is_starred boolean NOT NULL DEFAULT false` with partial GIN index |
| `job_media` | `category` constraint updated to include `'rejection_proof'` |

Migration file: `supabase/migrations/20260404_add_job_pinned_by.sql`

---

## [2026-03-10] - Job Board Performance Optimization

### Performance

- **Removed overfetching** — Board query no longer pulls `parts_used` and `media` arrays per job, cutting payload size significantly.
- **Single-query helper assignments** — Technician helper jobs now fetched in one query via `!inner` join instead of two sequential queries (N+1 fix).
- **Debounced search** — Search input now debounces 250ms via `useDebounce` hook, preventing filter recalculation on every keystroke.
- **Memoized list components** — `JobCard`, `JobListRow`, and `QuickStats` wrapped in `React.memo` to skip re-renders when props haven't changed.
- **Stable callbacks** — `onNavigate` extracted to `useCallback` to avoid creating new function references on every render.
- **Stable realtime subscription** — Channel no longer tears down/recreates on user context changes; uses ref-based pattern for stable `useEffect` deps.
- **Incremental INSERT handling** — New jobs from realtime subscription are prepended to the array instead of triggering a full data refetch.

---

## [2026-03-10] - Jobs Board View Refinement

### UI Improvements

- **Two-mode jobs board** - `/jobs` now supports a stronger card view and a denser list view, with the chosen layout persisted in the URL via `?view=card|list`.
- **Richer job cards** - Cards now surface customer, site, equipment, assignee, schedule, description, SLA/emergency context, and acceptance state without clipping long content.
- **Operational list view** - List mode now behaves like a true board scan with desktop table columns for job, site, equipment, assignee, scheduled date, status, and urgency, while mobile collapses to dense stacked rows instead of a broken horizontal table.
- **Jobs workspace header** - Added a clearer top command area with result counts, view toggle, selection controls, and more structured filter/search presentation.
- **Search coverage expanded** - Jobs search now includes forklift numbers, customer forklift numbers, account numbers, contact person, and site fields used in the redesigned board.

## [2026-03-10] — Admin Forklift Switching

### Features

**Job Detail Forklift Switching**
- **Admin forklift switch** — Admins can now switch the assigned forklift on a job before it starts (status: New or Assigned). This allows correcting forklift assignments without deleting/recreating jobs.
- **Customer rental filtering** — Only forklifts currently rented by the job's customer appear in the switch dropdown, preventing assignment of unavailable equipment.
- **Pre-start restriction** — Forklift can only be switched before job starts (not In Progress, Completed, or Awaiting Finalization). Once work begins, the forklift is locked to preserve hourmeter continuity and job integrity.
- **Inline UX** — Click the RefreshCw icon next to the Equipment header → select from dropdown → saves immediately → refreshes job data. Clean, minimal friction.
- **Toast feedback** — Success/error toasts confirm the switch or explain why it failed.

### Security
- **Admin-only** — Only users with `roleFlags.isAdmin` see the switch button. Supervisors, technicians, and accountants cannot switch forklifts.
- **Status gate** — Backend update checks job status; future enhancement could add server-side validation to block updates after job starts.

---

## [2026-03-09] — Rental + Hourmeter Import Preparation

### Features

**Dry-Run Import Preparation**
- **Rental + hourmeter prep CLI** — Added `npm run import:prep:dry-run` to parse rental and hourmeter CSVs, compare them against Supabase, and emit a JSON review report without importing any live data.
- **Classification report** — Every in-scope asset is classified as `create`, `update`, or `manual-review`, with preserved raw source values and proposed forklift/rental/hourmeter records.
- **Review buckets** — The dry-run report isolates unresolved customer aliases, unresolved site aliases, missing-identity rows, and excluded non-forklift equipment (`R-HPT`, `R-EQUIP`).
- **Hourmeter summary parser** — Locked the import logic to the grouped 4-row hourmeter summary blocks and ignores the flat debtor/detail section for canonical import decisions.

### Data Model
- **Relational rental site prep** — Added migration support for `forklift_rentals.site_id`, `forklifts.current_site_id`, `forklifts.delivery_date`, and `forklifts.source_item_group`.
- **Customer site import prep** — `customer_sites.address` can now be nullable so imports can stage site names before full addresses are known.
- **Alias mapping tables** — Added `customer_aliases` and `customer_site_aliases` to support reviewable source-name reconciliation instead of hardcoded string guessing.
- **Hourmeter import source** — Extended `hourmeter_history.source` to allow `import` audit entries for the future approval-based import step.

### Tests
- **Import prep parser tests** — Added node-based tests for rental parsing, grouped hourmeter parsing, alias normalization, unresolved site review classification, and hourmeter regression detection.

## [2026-03-07] — Mobile Technician UX + Dashboard Hardening

### Features

**Mobile Technician Workflow**
- **Workflow Card** — Guided field workflow card on mobile job detail: Accept → Start → Work → Complete. Shows only for technicians on phones.
- **Completion gating** — "Complete" button disabled until all requirements met (after photo, hourmeter, tech signature, customer signature). Blocker badges show what's missing.
- **Quick-nav buttons** — Checklist, Photos, Signatures buttons scroll directly to each section.
- **Signatures promoted** — Signatures card moved from sidebar into main content on mobile for visibility.
- **Sticky action bar** — Shows requirement pills (amber badges) when completion is blocked.

**Dashboard Polish**
- **Role-specific dashboards** — ServiceAdminDashboard (jobs pipeline, fleet, team) and StoreAdminDashboard (parts requests, inventory alerts, expiry).
- **Floating top header** — Rounded-[24px] bar with "Operations Console" label, refined glass blur.
- **Sidebar glass gradient** — Softer nav item radius (14px), gradient background.
- **Skeleton loading** — Dashboard shows structured skeletons instead of spinner.
- **Job filter drill-downs** — Dashboard links support `?filter=assigned`, `?filter=due-today`, `?filter=awaiting-service-confirm`.
- **Tab URL params preserved** — Switching tabs no longer wipes other URL parameters.

**Inventory**
- **Permission-based actions** — Inventory buttons use `canEditInventory` instead of hardcoded `isAdmin`, so Admin Store can manage inventory correctly.
- **URL param sync** — Search, category, and stock filters sync with URL params.

**Performance**
- **Per-role dashboard code splitting** — Each role's dashboard is now a separate lazy-loaded chunk via `React.lazy()`. Technician loads 7.8KB instead of the full 31KB admin dashboard.
- **Inventory catalog pagination** — Parts list paginated at 50 per page with server-side filtering. Stats computed from lightweight select.
- **Centralized parts service** — Typed `PartsCatalogPage`, `InventoryCatalogStats`, shared low/out-of-stock helpers.

### Fixes
- **Native confirm/alert replaced** — All fleet pages (forklift delete, service interval delete, end rental) now use themed confirmation modals instead of browser native dialogs. Consistent with CustomerProfile pattern.
- **DashboardSection extracted** — Was duplicated in ServiceAdmin + StoreAdmin dashboards; now shared from `DashboardWidgets.tsx`.
- **Store dashboard error handling** — Added `try/catch/finally` with loading skeleton + error fallback with retry button. Previously failed silently.
- **FAB cleanup** — Removed redundant technician FAB actions (Van Stock, My Jobs) that duplicated bottom nav.
- **JobCard acceptance badge** — Only shows on ASSIGNED status, not after job starts.
- **ExpiryWarning typed** — Removed `any` type in inventory page.

---

## [2026-03-06] — Admin UI Clarity Pass

### UI Improvements

**Dashboard**
- **Stronger admin command-center header** — Added a clearer top summary with date context, a more useful opening sentence, and four actionable focus cards for due work, approvals, assignment gaps, and team capacity.
- **Watchlist strip** — Grouped the quick KPI pills into a labeled watchlist so the signal reads as one control surface instead of a loose row of chips.
- **Urgent queue cleanup** — Deduplicated Action Required items so the same job no longer appears multiple times for overlapping urgency reasons.

**Jobs**
- **Jobs overview cards refined** — Quick stat cards now explain what each number means (open work, queued work, finance step, closed jobs) instead of showing count-only tiles.
- **Filter bar simplified** — Search, status, date chips, and advanced filters now read as one coherent control area with a clearer result count and less top-of-page clutter.
- **Better loading state** — Replaced the blank spinner with skeletons shaped like the actual jobs page.

**Fleet**
- **Fleet summary row** — Added top-level cards for total units, available units, rented units, and maintenance attention items.
- **Fleet filter panel improved** — Added clear counts and a dedicated clear-filters action.
- **Forklift cards denser but easier to scan** — Reduced duplicate status noise, surfaced internal/customer forklift numbers, clarified rental state, and improved customer/site context.
- **Fleet loading state** — Replaced empty spinner loading with structure-aware skeletons.

**Customers**
- **Customer summary cards** — Added top stats for total customers, phone coverage, email coverage, and profiles with notes.
- **Search area improved** — Added clearer search result feedback and a dedicated clear-search action.
- **Customer cards upgraded** — Added contact-readiness badges, contact person emphasis, note treatment, and a clearer profile CTA.

**Role-Specific Dashboards**
- **Service Admin dashboard** — Focused on jobs pipeline, technician availability, fleet snapshot (service due, rented units), and team workload. No inventory clutter.
- **Store Admin dashboard** — Focused on parts requests queue, inventory alerts (out-of-stock, low stock), and recent receiving activity. No job management clutter.
- **Super Admin** — Retains the full "Command Center" dashboard with everything.

### Fixes
- **Swipe-sign TypeScript regressions** — Restored missing `swipeSignJob` / `bulkSwipeSignJobs` barrel exports and fixed incorrect `showToast(...)` usage in the bulk sign-off modal so `npm run typecheck` passes again.
- **Customer delete FK cascade** — Deleting a customer now properly cleans up all job dependencies (`hourmeter_history`, `job_parts`, `job_media`, etc.) before removing the customer. Also checks for active rentals.
- **Themed delete confirmation** — Replaced native browser `confirm()`/`alert()` with themed modal and toast notifications on the Customer Profile page.
- **UsersTab crash on new roles** — Role badge map was missing `admin_service` and `admin_store`, causing a crash when viewing the Users tab. Added badges with distinct colors and proper display labels ("Admin (Service)", "Admin (Store)").
- **Dashboard role switch** — Added explicit `admin_service`/`admin_store` cases to dashboard component routing.
- **HashRouter deep-link** — Bookmarked URLs like `/jobs` now correctly redirect to `/#/jobs`.
- **Hard delete job** — Added `hourmeter_history` cleanup to prevent FK constraint errors.
- **Dev account access** — Restored `isAdmin` check on duplicate/delete job buttons so the super admin account isn't locked out.

## [2026-03-06] — Signatures, Role Separation & Service Tracking

### Features

**Swipe-to-Sign System**
- **Replaced draw-on-canvas signatures with swipe-to-sign** — Technician swipes a slider to confirm; customer fills in Name + IC Number then swipes. Faster, cleaner, works better on mobile.
- **Customer IC Number required** — Customer must enter their name and IC number before the swipe slider becomes active.
- **Inline signing in Job Detail** — No more modal popups; signature fields are directly in the Signatures card.

**Bulk Site Sign-Off**
- **Bulk sign-off banner on Job Board** — When a technician has 2+ unsigned in-progress jobs at the same customer + site, a "Sign Off Site Visit" banner appears.
- **Two-step bulk modal** — Step 1: Tech selects jobs + swipes. Step 2: Customer fills name + IC + swipes. One signature upload applies to all selected jobs.
- **`bulkSwipeSignJobs` service** — Signs multiple jobs with a single operation.

**Role-Based Access: Admin Service vs Admin Store**
- **Admin 1 (Service)** — Full job management (create, assign, edit, delete), customers, forklifts, fleet, HR, users, invoices. NO inventory access.
- **Admin 2 (Store)** — Full inventory/parts management, approve & provide parts, invoices. Read-only job view. NO job creation/editing, NO customers/forklifts/HR.
- **Mobile nav split** — Service admin sees Home/Jobs/Fleet; Store admin sees Home/Jobs/Inventory.
- **FAB split** — Service admin gets New Job + Approvals; Store admin gets Approvals + Inventory.
- **Job Detail restricted** — Store admin cannot start, complete, delete, duplicate, or reassign jobs.

**Service Tracking**
- **Reach Truck treated as Electric** — `isElectricType()` helper recognizes Reach Truck as electric for calendar-based 3-month service tracking. `getServiceIntervalType()` maps Reach Truck → Electric intervals.

### Fixes
- **Duplicate Job button** — Was navigating to `/jobs/create` (wrong route), now correctly goes to `/jobs/new`.
- **Job Detail address** — Shows only site address selected during job creation, no longer falls back to customer office address.

---

## [2026-03-05] — March 2026 UX & Workflow Improvements

### Features

**Customer & Site Management**
- **SITE/LOCATION separation** — Clear distinction between billing entity (LOCATION) and physical job site (SITE). Create Job page now shows both fields separately.
- **Edit Customer modal redesign** — Full modal with tabbed Company/Contact sections, replaces broken inline edit. Desktop-optimized 2-column layout.
- **Customer Forklift No field** — Added to forklift form (alphanumeric). Site field added (free text). Brand dropdown expanded (Toyota, Nichiyu, Hangcha, BT, EP, Noblelift, TCM, Unicarries, Yale, Nissan, Others). Updated ForkliftType enum: Battery/Electrical, Diesel, Reach Truck, LPG, Others.

**Fleet & Rental**
- **Rent Out / Return buttons** — Prominent action buttons on forklift cards for faster workflow.
- **Return Forklift modal** — Desktop-friendly rounded design with clear layout.
- **Forklift dropdown filter** — Create Job page now filters forklift list to show only customer's active rentals.
- **Last Service Hourmeter in rental modals** — Optional field in both Rent and Return modals. Sets `last_service_hourmeter` and recalculates `next_target_service_hour`.
- **Post-bulk-rent Service Reset Modal** — After bulk rent, shows table of rented forklifts with editable Last Service HRS column for batch hourmeter updates.

**Job Management**
- **Create Job page redesign** — Clean 2-column desktop layout with context sidebar showing customer info, active rentals, recent jobs. Mobile stacks single column.
- **Job Board date filter pill tabs** — Replaced dropdown with pill navigation (Unfinished/Today/Week/Month/All).
- **Job Detail page widened** — Eliminated thick side margins for better use of screen space.
- **Schedule Service modal** — Desktop-friendly 2-column layout.
- **Camera-only Start Job photos** — Mandatory before-condition photo capture (min 1 photo) before entering hourmeter/checklist. 2-step wizard. Camera/gallery mode, no upload from old photos. Prevents fake photos with timestamp + geolocation.

**UI Components**
- **Searchable Combobox dropdowns** — Replaced native select elements across fleet filters, inventory filters, job filters, forklift edit modal. Type to filter, keyboard navigation.
- **Compact liquid glass Combobox** — Special variant for filter bars with glassmorphism effect, tighter spacing.
- **Edit Forklift modal** — Desktop-optimized 3-section layout (Details/Service/History) with sticky footer. Brand/Type/Status fields use Combobox.

**Mobile Optimizations**
- **Technician dashboard compact** — Tighter card spacing, mobile-optimized layout.
- **Equipment card mobile compact** — 2-column grid for equipment details.
- **Fleet filter hybrid layout** — Inline on desktop, stacked on mobile.

**Inventory**
- **Batch Receive Stock redesign** — Search-based item selection (replaces dropdown). Invoice/receipt upload to private Supabase bucket with signed URLs. Liquid container context display.
- **Purchase History** — 3-way toggle in Ledger tab: Recent Activity / Purchase History / Item Ledger. Batch grouping by PO+date. Invoice viewer via signed URLs (1-hour expiry). Search filter.
- **ACWER CSV self-import** — In-app CSV import with ACWER format auto-detection (3 header rows, 7 columns). Batch upserts (100/batch), audit trail, junk row filtering, smart liquid detection, category auto-mapping.
- **Currency RM fix** — Inventory views now display Malaysian Ringgit (RM) instead of $.

### Fixes
- **Modal overflow fix** — All modals now use 2-layer pattern (outer wrapper + inner scrollable). Prevents content clipping on small viewports and mobile.
- **Modal clipping on mobile** — Fixed top clipping and screen flicker. Rental modal bottom buttons no longer cut off.
- **Service Due tab** — Prediction view now returns `current_hourmeter` correctly (was showing `hourmeter`).
- **Category filter overflow** — Fixed with proper width constraints, text truncation, min-width.
- **Search service query chain** — Fixed stacked `.is()` bug causing search failures.
- **Year field** — Changed from required (defaulting to current year) to optional (null default).
- **Bulk rent modal** — Last Service Hourmeter field hidden on bulk rent (only shows for single forklift).
- **Pagination** — Parts queries now paginate to fetch all 3200+ items.
- **Null-safe toFixed** — Fixed crash on null `sell_price`/`cost_price`.
- **Forklift dropdown empty** — Fixed missing `current_customer_id` in query.
- **Notification dedup** — Skip if same user+type+ref exists within 5min window.
- **Service Worker cache** — Removed JS/CSS from CacheFirst runtime caching. Prevents stale chunks after deploys.

### Performance
- **Stale time tuning** — Increased `staleTime` and `cacheTime` across query hooks to reduce Supabase egress and improve responsiveness.

### Maintenance
- **Project cleanup** — Removed 977 lines of dead code (orphaned components, unused services, stale exports).
- **Codifica protocol** — Added multi-agent coordination spec for better context handoff.
- **Documentation updates** — Comprehensive README overhaul, added LICENSE, SECURITY.md, CONTRIBUTING.md.

### Testing
- **E2E test suites** — Added role-based test suites for admin, supervisor, technician, and accountant workflows.

---

## [2026-02-27] — Liquid Inventory Phase 1

### Features
- **Purchase/Receive Stock flow** — Admin enters container qty × size (liters) + total price → auto-calculates total liters and cost per liter (RM). PO reference stored per batch.
- **Warehouse Ledger tab** — Running balance table per fluid item: purchase, van transfer, job usage, special sale. Color-coded ± changes with reference numbers.
- **Van Ledger tab** — Per-van running balance. Negative balance rows highlighted amber as warning flag for admin review.
- **Cost tracking (average costing)** — purchase_batches stores cost per liter per batch. update_avg_cost_per_liter() maintains weighted average. Forklift maintenance cost auto-calculated on job usage (qty × avg cost/L).
- **Decimal input on liquid parts** — Removed all + counter buttons on fluid items. Replaced with manual decimal text input (inputMode=decimal) supporting values like 4.2L.
- **Insufficient balance guard** — Van deductions that would go negative are flagged for admin review.

### Database
- purchase_batches extended: container_size_liters, total_purchase_price_myr, received_by, received_at
- inventory_movements added: reference_number, unit_cost_at_time, total_cost, forklift_id
- parts added: avg_cost_per_liter, last_purchase_cost_per_liter
- New enum values: van_transfer, job_usage, special_sale

---

## [2026-02-26] - February 26, 2026

### Features
- **Auto-generated job numbers** — DB trigger assigns `JOB-YYYYMMDD-XXXX` on insert; existing jobs backfilled; job number badge displayed on job cards and job detail header (blue accent pill style); searchable via global search
- **Technician mobile UX overhaul** — My Jobs / Other Jobs tab split; colored status borders on cards (green = completed, yellow = in-progress, red = open); larger tap targets throughout; collapsible sections on job detail page

### Bug Fixes
- **Sticky action bar** — Moved to top of job detail; hides automatically when modals are open to prevent overlap
- **Hourmeter validation** — Allow equal hourmeter reading on job complete (handles case where forklift was not operational during job)
- **Signature images** — Now use permanent public URLs instead of signed URLs (fixes 24-hour expiry issue)
- **Post-completion notes** — Technicians can add notes (but not photo uploads) after a job has been marked complete
- **Confirmation card** — Fixed mobile overflow on confirmation summary card
- **Checklist grid** — Single-column layout on mobile; overflow handling on long checklist labels
- **Call button** — Moved below customer name for better visual hierarchy
- **Combobox dropdown** — Flips upward when near viewport bottom to prevent clipping; job card list and board views now include `job_number` in select queries
- **CreateJob page** — Job type and priority fields now use Combobox component for consistency
- **Toast notifications** — Moved to top-center position; close button removed for cleaner mobile UX
- **Sticky status pill** — Removed redundant pill and blank gap on mobile job detail (status is already shown in action bar)

---

## [2026-02-24/25] - Liquid Inventory System + Bulk Parts Import

### Features
- **Dual-unit inventory foundation** — Parts now support two quantity types: discrete units (pcs) and liquid/bulk (L, kg, m); `unit` field and `liquid_quantity`/`liquid_unit` columns added across `parts`, `van_stock_items`, `job_parts`, and `replenishment_items` tables
- **Liquid inventory service** — `liquidInventoryService.ts` handles liquid-aware stock read/write; `partsService.ts` updated for dual-unit support
- **Liquid-aware stock deduction in job flow** — When a liquid part is used on a job, the liquid quantity is deducted correctly (in addition to or instead of unit count)
- **Dual-unit UI across all pages** — Inventory page, Van Stock modal, parts dropdowns all show unit type and appropriate quantity inputs
- **Bulk parts import** — Admin can import parts from CSV or JSON file; validates headers, upserts by part code; progress feedback with success/error counts
- **Inventory movement logging** — All stock changes (deductions, replenishments, manual adjustments) now logged to `inventory_movements` table with actor, job, quantity delta, and timestamp
- **Low stock alerts** — Server-side function evaluates low-stock threshold per part; alert surfaced on admin dashboard; better CSV export with all columns

---

## [2026-02-23] - Checklist Tri-State, Decimal Qty, Combobox Portal Fix

### Features
- **Checklist tri-state toggle** — Previously, clicking an OK item just cleared it (blank). Now it shows a red ✗ (needs attention). Three states: blank → ✓ OK → ✗ Not OK → blank. Gives technicians a clearer visual for issues they're flagging.
- **Decimal quantity input for parts** — Technicians can type exact amounts (1.5, 0.5, 0.25) instead of tapping a "+" button. Supports liquid/bulk items. Validates: > 0, ≤ available stock. DB: quantity columns altered to `DECIMAL(10,2)` across affected tables.
- **Smart pre-commit hook v2** — Validates Codex authorship via git trailer; blocks non-Codex commits on code files

### Bug Fixes
- **Combobox portal fix** — Combobox dropdown now renders at the document body level via React portal, making it immune to `overflow: hidden` on parent containers. Fixes dropdowns being clipped inside SwipeableRow, approval cards, and other overflow-constrained parents.

---

## [2026-02-18/19] — Mobile Polish + Dark Mode + Theme Fixes

### Bug Fixes
- **Dark mode theming** — Replaced `bg-white` with `bg-[var(--surface)]` across 73 components — all pages now fully theme-aware
- **Bottom nav dark mode** — Dark background + light border in dark mode (was transparent)
- **FAB fixes** — Solid white backgrounds on menu items, blue glow on main button, closes on route change
- **FAB active label** — Solid accent background with white text (was transparent)
- **Technician FAB** — Replaced "New Job" (no permission) with Van Stock + My Jobs quick actions
- **KPI cards** — Fixed overflow on mobile — smaller padding/font/icons, tighter 3-col grid
- **Dashboard mobile** — Scrollable stat pills, stacking header on small screens
- **Low stock card** — Queries global `parts` table instead of `van_stock_items`; fixed race condition; excludes 0/0 items; scrollable list
- **Command palette** — Fixed transparent background on dark mode
- **Dashboard card overlap** — Fixed layout collision on mobile

---

## [2026-02-17] - Full Mobile Responsive + PWA + Role-Aware Mobile UX + UI Upgrade

### UI Upgrade — 9 Features
- **Command Palette** — `Cmd+K` / `Ctrl+K` or search button in header. Role-aware navigation + quick actions (New Job, New Customer). Arrow keys + Enter to select.
- **Pull-to-Refresh** — Wired into Jobs page. Pull down to reload the active tab.
- **Swipe Actions** — StoreQueue items: swipe right to approve/confirm, swipe left to reject. Green/red reveal.
- **Filter Bottom Sheets** — `MobileFilterSheet` component: slide-up sheet on mobile, inline on desktop.
- **Skeleton Loading** — `JobCardSkeleton`, `DashboardCardSkeleton`, `TableRowSkeleton`, `ListSkeleton` patterns.
- **Empty States** — Reusable `EmptyState` component with icon, title, description, optional CTA button.
- **Page Transitions** — CSS fade-in + slide-up animation on route changes.
- **Toast Position** — Moved to bottom-center on mobile (above bottom nav), unchanged on desktop.
- **View Toggle** — `ViewToggle` component for switching between table and card views.

### Mobile V2 — Role-Aware UX (Phase 4)
- **Role-aware bottom navigation** — Each role sees different quick-access icons:
  - Technician: Home, Jobs, Van Stock, More
  - Supervisor: Home, Jobs, Approvals, More
  - Accountant: Home, Jobs, Billing, More
  - Admin: Home, Jobs, Inventory, More
- **Notification badges** — Unread count badge on role-specific nav items
- **Floating Action Button (FAB)** — Role-specific quick actions:
  - Technicians: Add Photo, Request Part, Timer
  - Supervisors: Approvals, Assign Job
  - Admins: New Job, Approvals, Inventory
  - Accountants: Billing
- **Bottom Sheet modals** — `BottomSheet` + `BottomSheetOrModal` components (slide-up on mobile, centered on desktop)
- **Pull-to-refresh hook** — `usePullToRefresh` with arrow→spinner indicator
- **Swipeable rows** — `SwipeableRow` component for swipe-to-approve/reject on list items
- **Sticky action bar on JobDetail** — Status-based actions pinned to bottom on mobile (Start Job / Complete / Photo / Parts)

### Mobile Responsive + PWA (Phase 1-3)

### Mobile Responsive (Phase 1-3)
- **33 files modified** across all pages for mobile responsiveness
- **JobDetail** — Stacked single-column layout on mobile, touch-friendly 48px action buttons, responsive photo grid (2→3→4 cols), stackable equipment/financial cards
- **JobsTabs** — Scrollable tab bar, 44px tap targets, responsive "New Job" button with shorter label on mobile
- **CreateJob** — Full-width form inputs, responsive grid (1 col mobile → 2 col tablet), 48px buttons
- **Inventory** — Card view on mobile for parts table (hidden table, visible cards), stacked filters/stats, responsive header
- **StoreQueue** — Responsive approval cards, full-width approve/reject buttons on mobile
- **Customers** — Card layout on mobile, full-width search
- **Forklifts** — Responsive grid (1→2→3 columns)
- **People/Invoices** — Table overflow wrappers, card fallbacks on mobile
- **Login** — Centered card, max-w-sm, mobile-friendly button sizing

### PWA (Progressive Web App)
- **manifest.json** — App name, icons (192/512), standalone display, shortcuts (My Jobs, New Job)
- **Service Worker v2** — Offline caching with stale-while-revalidate for static assets, network-first for API (Supabase), offline fallback page
- **Apple meta tags** — apple-mobile-web-app-capable, status bar style, touch icon
- **Safe area support** — Bottom nav respects notched phones (env(safe-area-inset-bottom))

### Global Mobile CSS
- 44px minimum tap targets on all interactive elements
- 16px input font size (prevents iOS zoom on focus)
- Touch-optimized scrolling (-webkit-overflow-scrolling: touch)
- Reduced table cell padding on mobile
- Bottom nav clearance (pb-24 md:pb-8) on all pages

---

## [2026-02-16] - Van History, Decimal Quantities, Bug Fixes

### Approvals Tab (StoreQueue) — Grouped Accordion
- **Grouped by job** — requests for the same job now collapse into one accordion card
- **Collapsed by default** — header shows: job title, customer, technician, item count badge, time since oldest request
- **Expand to see details** — click card to reveal individual part requests with inline approve/reject
- **"Approve All" per job** — approves all part requests for a job in one click (only shows when all parts selected)
- **Sorted by latest** — groups sorted by most recent item, newest first
- **Batch-optimized** — Approve All skips per-item reload/toast, single summary toast + reload at end
- File: `StoreQueue/StoreQueuePage.tsx`

### Pending Confirmations Page (standalone) — Collapsed Cards
- **Collapsed cards by default** — job cards now show compact header only (title, customer, tech, time pending, parts count)
- **Expand/collapse accordion** — click card or chevron to see full details (parts list, SRN, completion date, confirmation status)
- **Sort by latest** — most recently completed jobs appear first (both Parts and Jobs tabs)
- **Always-visible actions** — Confirm/Reject buttons visible on collapsed view, no need to expand
- **Tab switch resets** — switching tabs collapses all cards and clears selections
- Files: `PendingConfirmations.tsx`, `JobCard.tsx`, `usePendingConfirmations.ts`

### Broken Notification Bell on V7.1 Dashboard
- **Fixed:** Bell button next to V7.1 badge navigated to `/notifications` — route doesn't exist (blank page)
- **Removed** duplicate bell from dashboard — global header already has `NotificationBell` with working dropdown
- **Cleaned up** unused `Bell` import, `useNotifications` fetch, and `unreadCount` variable (saves an unnecessary API call)
- File: `components/dashboards/DashboardPreviewV4/components/AdminDashboardV7_1.tsx`

### "Failed to mark out of stock" Bug Fix
- **Fixed:** Inline "Out of Stock" button on pending requests passed empty string as partId (no part selected yet → invalid UUID → update fails)
- **Removed** the broken inline OOS shortcut from `JobRequestsSection.tsx`
- **OOS flow still works** via the Approve Request modal where admin selects a part first, then can mark OOS
- File: `pages/JobDetail/components/JobRequestsSection.tsx`

### Part Request Auto-Refresh Fix
- **Fixed:** Technician submits a part request → job doesn't refresh, request invisible until manual reload
- **Fixed:** Same issue when editing an existing request
- **Root cause:** `handleCreateRequest` and `handleUpdateRequest` were missing `loadJob()` call after success (every other handler had it)
- **Also fixed:** React dependency arrays updated to include `loadJob`
- File: `pages/JobDetail/hooks/useJobRequestActions.ts`

### Parts Inventory Bug Fix
- **Fixed:** Parts dropdown in job detail showed "Stock: undefined" — `getPartsForList()` wasn't fetching `stock_quantity`
- **Fixed:** Admin was blocked from adding out-of-stock parts — now only technicians are restricted
- **Fixed:** Stock could go negative when adding parts — clamped to `Math.max(0, ...)`
- **Added:** Visual stock indicators in parts dropdown: ⛔ OOS (zero), ⚠️ low stock (≤5), normal count otherwise
- Files: `partsService.ts`, `jobInvoiceService.ts`, `JobDetailPage.tsx`

### Van History Tab
- **History tab** in van detail modal — shows full parts deduction log with technician, job, quantity, and timestamp
- **Technician summary** sub-tab — which technicians used a van, how many jobs/parts, date ranges
- Paginated log (20 per page) with part codes, units, and customer names
- New service: `vanHistoryService.ts` with `getVanUsageHistory()` and `getVanTechnicianSummary()`

### Decimal Quantity Input
- **Manual quantity entry** replaces the "+" button for van stock parts — technicians can type exact amounts (e.g., 1.5L)
- Supports decimal values for liquid/bulk items (hydraulic oil, lubricant, etc.)
- Shows available quantity with unit in the van stock selector dropdown
- Validates: must be > 0, cannot exceed available stock
- `unit` field added to Part type (pcs, L, kg, m, etc.)
- DB migration: quantity columns altered from INTEGER to DECIMAL(10,2) across van_stock_items, van_stock_usage, job_parts, replenishment_items

### Bulk Part Request Approval
- Already existed! "Approve All" button appears when 2+ requests are pending
- Auto-matches request descriptions to parts inventory with fuzzy keyword matching
- Admin can review, adjust parts/quantities, skip individual items, then approve all at once

### Migration
- `20260216_van_history_and_decimal_quantities.sql`

---

## [2026-02-12] - Van Fleet Management

### Fleet Management System
- **Fleet Overview panel** — Admin/Supervisor collapsible panel at top of Van Stock tab showing all vans with status, plate number, tech, item count, and temp assignments
- **Van status tracking** — Toggle vans between Active / In Service / Decommissioned with one click
- **Temp tech assignment** — Assign/remove temporary technicians to vans (e.g., when their van is in service)
- **Tech van requests** — Technicians can request access to available vans with reason; supervisors approve/reject
- **Auto-assignment on approval** — Approving a request automatically assigns the temp tech to the van
- **Audit trail** — Full timeline of all status changes, temp assignments, and requests per van
- **Van identification** — Edit plate numbers and van codes inline from fleet overview
- **Smart van resolution** — `getVanStockByTechnician` now checks temp assignments first, falls back to own van
- DB tables: `van_access_requests`, `van_audit_log`
- DB columns: `van_status`, `van_plate`, `temporary_tech_id/name`, `temp_assigned_at` on `van_stocks`
- Migration: `20260212_van_fleet_management.sql`

---

## [2026-02-12] - Van Selection for Job Parts

### Van Stock Hardening (Codex Review Findings)
- **Fix: Stale quantity race condition** — Restock now uses atomic SQL `quantity = quantity + N` via `increment_van_stock_quantity()` RPC instead of read-then-write
- **Fix: Van lock enforced server-side** — DB trigger `prevent_van_change_after_parts` blocks van change if `from_van_stock` parts exist on job. No longer UI-only.
- **Fix: Lightweight van dropdown** — New `getActiveVansList()` returns only van metadata (no items) for technician dropdown. Reduces data leakage + payload size.
- DB migration: `20260212_van_stock_hardening.sql`

### Van Stock Bug Fixes (4 issues)
- **Fix: "Unknown" van cards** — `technician_name` wasn't mapped from joined `technician` object in `getAllVanStocks`, `getVanStockById`, and `getVanStockByTechnician`
- **Fix: Replenishment blocked for existing items** — Parts with qty 0 / "Out" status can now be restocked via Add Item (increments qty instead of blocking)
- **Fix: Edit Van Details save** — Changed empty notes from `undefined` to empty string to prevent Supabase rejection
- **Fix: Data mapping consistency** — All van stock fetch functions now consistently resolve `technician_name` from the joined user relation

### Van Selection Feature
- **New:** Technicians can select which van they're using at the start of each job
- Parts list filters to show only parts available in the selected van
- Parts deductions go to the correct van's inventory
- Pre-selects technician's default assigned van (no extra clicks for normal flow)
- Van selection locks after first part is used from van stock (prevents inventory inconsistency)
- No impact on warehouse stock flow

### Files Changed
- `types/job-core.types.ts` — Added `job_van_stock_id` field to Job type
- `pages/JobDetail/hooks/useJobData.ts` — Fetch van stock by job's selected van
- `pages/JobDetail/hooks/useJobDetailState.ts` — Added `availableVans` state
- `pages/JobDetail/hooks/useJobPartsHandlers.ts` — Added `handleSelectJobVan` handler
- `pages/JobDetail/components/PartsSection.tsx` — Van selector dropdown UI
- `pages/JobDetail/JobDetailPage.tsx` — Wired new props
- `database/migrations/20260212_job_van_selection.sql` — DB migration

---

## [2026-02-07] - Security Fixes & Code Cleanup

### ESLint Zero Warnings (Phase 3 Complete)
- **353 → 0 warnings** — Full lint cleanup achieved
- **Unused catch variables** (~140) — Renamed to `_error`/`_e` convention
- **Empty blocks** (33) — Added explicit `/* Silently ignore */` comments
- **useEffect deps** (31) — Added eslint-disable for intentional mount-only hooks
- **max-lines** (29 files) — File-level disables pending proper splitting
- **ESLint config** — Added `varsIgnorePattern`, `caughtErrorsIgnorePattern`, `destructuredArrayIgnorePattern`
- **Ignored directories** — tests/, public/, scripts/ excluded from linting

### File Modularization (Phase 4)
Successfully split large files for better maintainability:

| Original File | New Files | Reduction |
|---------------|-----------|-----------|
| `types/job.types.ts` (678 lines) | 5 files: job-core, job-hourmeter, job-quotation, job-request, job-validation | -91% (59 lines) |
| `services/jobAssignmentService.ts` (453 lines) | 3 files: jobAssignmentCrudService, jobAssignmentBulkService + facade | -94% (27 lines) |
| `utils/useRealtimeNotifications.ts` (477 lines) | 3 files: notificationHandlers, realtimeChannels + hook | -49% (244 lines) |
| `services/hourmeterService.ts` (678 lines) | servicePredictionService.ts | -61% (262 lines) |
| `pages/JobDetail/components/JobDetailModals.tsx` (666 lines) | JobDetailModalsSecondary.tsx | -38% (411 lines) |
| `services/jobRequestService.ts` (452 lines) | jobRequestApprovalService.ts | -62% (171 lines) |
| `pages/JobDetail/hooks/useJobActions.ts` (870 lines) | useJobPartsHandlers.ts | -8% (798 lines) |

**25 large files remain** with `eslint-disable max-lines` — these are mostly:
- PDF generators (template-heavy, hard to split)
- Dashboard previews (prototype components)
- Complex hooks (need careful refactoring)

### Code Cleanup (Phase 1 & 2)
- **Import organization** — Removed unused imports across 372 files
- **ESLint fixes** — Reduced issues from 450 to 385 (65 fixed)
- **Type safety** — Fixed `var` to `let/const`, prefixed unused params with `_`
- **Service modularization** — Split `jobService.ts` into focused modules:
  - `jobStatusService.ts` — Status transitions, multi-day job flow
  - `jobCrudService.ts` — Delete/restore operations
  - `jobAutoCountService.ts` — AutoCount export stubs

## [2026-02-07] - Security Fixes: XSS & Storage Hardening

### Security Fixes
- **XSS protection in PDF generators** — All user-controlled content now sanitized before injection
- **Signed URLs for signatures** — `uploadToStorage()` now returns file path instead of public URL
- **Time-limited access** — Signature URLs now expire after 24 hours (vs permanent public URLs)
- **New helper** — `getSignedStorageUrl()` for generating signed URLs on demand

### Technical Details

**XSS Prevention:**
- New `services/sanitizeService.ts` — HTML entity encoder for user content
- Fixed all 5 PDF generators using `document.write()`:
  - `components/InvoicePDF.tsx`
  - `components/QuotationPDF.tsx`
  - `components/ServiceReportPDF.tsx`
  - `pages/Invoices/components/generateInvoicePDF.ts`
  - `pages/ServiceRecords/ServiceReportPDF.ts`

**Storage Hardening:**
- `services/storageService.ts` — Returns `data.path` instead of `getPublicUrl()`
- `services/supabaseClient.ts` — Same change + added `getSignedStorageUrl()` helper
- `services/jobMediaService.ts` — Updated `signJob()` to generate signed URL after upload

### Why This Matters
Public URLs are permanent and shareable — if leaked via browser history, email, or logs, anyone can access the document forever. Signed URLs expire, limiting exposure window.

---

## [2026-02-06] - UX Improvements & Workflow Enhancements

### UI/UX Improvements
- **Dynamic Quick Stats colors** — Colors now respond to data (green=0, red/purple=needs attention)
- **Check All/Uncheck All** — Buttons in Start Job modal for condition checklist
- **Last recorded hourmeter** — Displayed in Start Job modal for reference
- **Loading skeletons** — New Skeleton component library for better perceived performance
- **Toast with undo** — `showUndoToast` and `showDestructiveToast` in toastService
- **Mobile components** — PullToRefresh, SwipeableCard, OfflineIndicator

### Developer Experience
- **AGENTS.md enhanced** — Self-improvement rules, quality prompts, lessons learned table
- **Pre-commit hooks** — TypeScript + build verification before every commit
- **Query audit** — Documented N+1 patterns, missing indexes, optimization opportunities

### Testing
- **Service Due E2E tests** — 5 tests covering table, columns, priority badges

### Bug Fixes
- Fixed dev mode for dev@test.com account
- Fixed 71→15 TypeScript errors (build now passes)

---

## [2026-02-05] - Hourmeter Service Tracking Enhancement ✅

### Customer Feedback Implementation

Enhanced hourmeter service tracking with service upgrade prompts, stale data detection, and improved fleet overview.

#### Bug Fixes (Same Day)
- Fixed `vercel.json` missing for SPA client-side routing (404 on direct navigation)
- Fixed `toLocaleString` null check in ServiceDueTab causing crash
- Fixed `get_forklift_daily_usage` RPC using wrong column name (`reading` not `hourmeter`)

#### New Features
1. **Two Hourmeter Fields** — `last_serviced_hourmeter` and `next_target_service_hour`
2. **Service Intervals by Type** — Diesel (500 hrs), LPG (350 hrs), Electric (90 days)
3. **Service Upgrade Prompt** — When starting Minor Service on overdue unit, prompts to upgrade to Full Service
4. **Stale Data Detection** — Flags units with no hourmeter update in 60+ days
5. **Daily Usage Tracking** — Calculates avg daily hours and trend (increasing/decreasing/stable)

#### Database Changes
- `forklifts` table: Added `last_serviced_hourmeter`, `next_target_service_hour`, `last_hourmeter_update`
- New `service_intervals` table with defaults per forklift type
- New `service_upgrade_logs` table for audit trail
- New `fleet_service_overview` view with computed fields
- `get_forklift_daily_usage()` function for usage calculation
- `complete_full_service()` function for baseline reset
- Auto-calculate trigger on forklift INSERT/UPDATE

#### New Files
- `services/serviceTrackingService.ts` — Fleet overview, upgrade logic, stale detection
- `components/ServiceUpgradeModal.tsx` — Upgrade prompt UI component
- `docs/features/HOURMETER_SERVICE_TRACKING.md` — Feature specification

#### Implementation Complete ✅
- [x] Database migration with triggers, views, functions
- [x] Service tracking service with fleet overview, upgrade logic, stale detection
- [x] ServiceUpgradeModal component for Minor→Full upgrade prompt
- [x] JobDetail integration (check on job start, handle upgrade/decline)
- [x] Fleet Dashboard new columns (Last Serviced, Next Target, Daily Usage)
- [x] Stale data filter and banner for admin/supervisor
- [x] Notification system for stale data alerts

#### Testing Needed
- [ ] End-to-end testing with real data
- [ ] Migration deployment to production

---

## [2026-02-04] - Hourmeter Service Prediction System

### New Feature: Engine Hour-Based Service Prediction

Predicts next service date for Diesel, LPG, and Petrol forklifts based on hourmeter usage patterns.

#### How It Works
1. **Collects Data:** Last service hourmeter, current hourmeter, service interval
2. **Calculates Average Usage:** Hours used ÷ days since last reading = avg hrs/day
3. **Predicts Service Date:** Hours until service ÷ avg hrs/day = days remaining
4. **Auto-Resets:** After service completion, cycle restarts automatically
5. **Updates Dynamically:** Every new reading recalculates the prediction

#### Database Changes
- `forklifts` table: Added `last_service_hourmeter`, `service_interval_hours` columns
- New `hourmeter_readings` table: Tracks all hourmeter readings with timestamps
- `calculate_predicted_service_date()` function: Server-side prediction calculation
- `complete_forklift_service()` function: Resets tracking after service
- `v_forklift_service_predictions` view: Dashboard-ready predictions with urgency

#### New Files
- `services/hourmeterService.ts` — Extended with service prediction functions
- `components/hourmeter/HourmeterReadingForm.tsx` — Record hourmeter readings
- `components/hourmeter/ServicePredictionCard.tsx` — Display prediction info
- `components/hourmeter/ServicePredictionDashboard.tsx` — Dashboard widget
- `database/migrations/20260204_hourmeter_service_prediction.sql` — Full migration

#### Types Added
- `HourmeterReading` — Individual reading record
- `ServicePrediction` — Calculation result
- `ForkliftWithPrediction` — Forklift with prediction data
- `ServicePredictionDashboard` — Dashboard widget data
- `ServiceUrgency` — Urgency levels (overdue, due_soon, upcoming, ok)

#### Service Functions
- `recordHourmeterReading()` — Log a new reading
- `getHourmeterReadings()` — Fetch reading history
- `getServicePrediction()` — Get prediction for one forklift
- `getForkliftServicePredictions()` — Get all predictions
- `getServicePredictionDashboard()` — Dashboard data grouped by urgency
- `completeForkliftService()` — Reset after service
- `updateServiceInterval()` — Change service interval

#### Helpers
- `requiresHourmeterTracking()` — Check if forklift type needs tracking
- `formatDaysRemaining()` — Human-readable countdown
- `getUrgencyColor()` — CSS classes for urgency display

### Migration Required
Run `20260204_hourmeter_service_prediction.sql` on Supabase to enable the feature.

### Update (Same Day) - Client Feedback

#### Split Service Job Types
- `Full Service` — PM with oil change, resets hourmeter cycle
- `Minor Service` — PM without oil change, tracks work but no reset
- Legacy `Service` type still works (treated as Full Service)

#### Auto Service Intervals by Forklift Type
- Diesel → 500 hours
- LPG/Petrol → 350 hours
- Trigger `trg_set_service_interval` auto-applies on forklift create/update

#### Automation Triggers
- `on_service_job_completed()` — Auto-resets hourmeter when Full Service job completed
- `set_service_interval_by_type()` — Auto-sets interval based on forklift type

---

## [2026-02-03] - Security Fixes (Codex Review)

### Critical Fixes

#### 1. Race Condition in Spare Parts Approval — FULLY FIXED
- **Issue:** Separate stock check and update allowed overselling
- **Fix (v1):** Atomic update with WHERE clause
- **Fix (v2):** New SQL function `reserve_part_stock()` with row-level locking
- **Files:** `services/jobRequestService.ts`, `supabase/migrations/20260203_atomic_stock_reserve.sql`
- **Rollback:** `rollback_part_stock()` function for failure recovery

#### 2. Assistance Approval Bug  
- **Issue:** Request marked approved before helper assignment, causing false positives
- **Fix:** Assign helper FIRST, only mark approved if successful
- **File:** `services/jobRequestService.ts`

#### 3. Telegram Token Security
- **Issue:** Base64 JSON token allowed potential forgery
- **Fix:** Added expiry timestamp (5 min), nonce for replay protection
- **File:** `components/TelegramConnect.tsx`
- **Note:** Server-side validation required in webhook

### Security Improvements

#### Dev Mode Protection
- **Issue:** Hardcoded `dev@test.com` could be exploited
- **Fix:** Removed hardcoded email, dev mode only works in dev environment
- **File:** `hooks/useDevMode.ts`

#### Signed URLs for HR Documents
- **Issue:** HR documents (permits, licenses, profile photos) used public URLs
- **Fix:** Implemented signed URLs with 1-hour expiry
- **Files:** `permitService.ts`, `licenseService.ts`, `hrService.ts`, `leaveService.ts`
- **New methods:** `getPermitDocumentUrl()`, `getLicenseImageUrl()`, `getProfilePhotoUrl()`, `getLeaveDocumentUrl()`

#### Gemini API Key Documentation
- Added security notes about client-side key exposure
- Documented mitigations and production recommendations
- **File:** `services/geminiService.ts`

### Database Changes
- `reserve_part_stock(UUID, INTEGER)` — Atomic stock reservation with row lock
- `rollback_part_stock(UUID, INTEGER)` — Undo stock reservation

---

## [2026-02-02] - Customer Feedback Bug Fixes

### Bug Fixes
- **Checklist validation** — Fixed "invalid input syntax for type boolean: 'ok'" error
  - Root cause: Trigger tried to cast string 'ok' to boolean
  - Fix: Now handles both old (true/false) and new ('ok'/'not_ok') formats
  
- **Job completion validation** — Fixed "Job was never started (started_at is null)" error
  - Root cause: Status dropdown path didn't sync `started_at` to service record
  - Fix: Now checks `jobs.started_at`, `repair_start_time`, and `arrival_time` as fallbacks
  - Added trigger to auto-sync job timestamps to service records

### Database Changes
- `validate_job_checklist()` — Handles string checklist states
- `validate_job_completion_requirements()` — Checks multiple timestamp sources
- `sync_job_started_to_service_record()` — New trigger for timestamp sync
- Backfill migration for existing service records

### Code Changes
- `jobService.ts` — `updateJobStatus` now syncs `started_at` to service records

### Tests Added
- `tests/customer-feedback-fixes.spec.ts` — Validates both fixes

### New: Error Tracking ("Desire Paths")
- `user_action_errors` table — Tracks failed user actions
- `errorTrackingService.ts` — Service to log and analyze errors
- Auto-tracking integrated into `toastService.ts`
- Helps identify what users try to do that fails → build those features

### Security: Hide Pricing from Technicians
- **Inventory Page** — Cost and Price columns hidden for technicians
- **Inventory Stats** — Inventory Value card hidden for technicians
- Uses existing `canViewPricing` permission from `ROLE_PERMISSIONS`
- Admins, Supervisors, Accountants still see all pricing

### Pre-Job Parts Allocation
- **Admins** can now add parts to jobs at ANY stage (New, Assigned, In Progress, Awaiting)
- **Supervisors** can add parts from Assigned onwards
- **Accountants** can only add at Awaiting Finalization (invoice adjustments)
- UI shows "(Pre-allocation)" label when adding parts to New/Assigned jobs
- Simplified and clarified `canAddParts` logic

### Request Edit Capability
- **Technicians** can now edit their own pending requests
- Edit button appears next to "Pending" requests they created
- Only works while request status is 'pending' (before admin review)
- Can modify: request type, description, photo URL
- Modal reused from create flow with edit mode support
- Service validates ownership + pending status before allowing update

### Dashboard Prototypes (All Roles)
- **Admin V5** — Option C style: full-width sections, top 5 items, "View all" links
- **Admin V6** — Full-featured prototype with:
  - Smart context-aware greeting ("5 jobs today, 2 techs available • ⚠️ 1 escalation")
  - Quick Actions row (Assign Jobs, Generate Invoices, Send Reminders)
  - 6 KPI cards including SLA metrics (On-Time %, Avg Response Time)
  - Today's Schedule timeline with visual job status
  - Notification filters (All/Jobs/Requests/System)
  - Outstanding Invoices card
  - Today's Progress bar
  - Team Status with grouped chips
- **Supervisor V5** — Team-focused with layout options (C: Top 5, D: Grouped)
- Toggle V4/V5/V6 via buttons in header (`dev@test.com` only)

### Performance: Egress Optimization
- Added `getUsersLightweight` (7 cols vs 30+)
- Dashboard now uses lightweight queries
- `getEmployees` no longer fetches nested data by default
- Estimated 70-80% reduction in egress for list views

---

## [2026-02-01] - Workflow Simplification & Bug Fixes

### Unified Admin Workflow
- **Removed Admin Service/Store split** — All admins now have full permissions
- **Auto-confirm parts** — Parts automatically confirmed when admin adds them
- **Parts visible to technicians** — Technicians see parts immediately (names only, no prices)
- **Removed "Pending Verification" block** — No longer blocks technicians from seeing parts

### Checklist Improvements
- **"Check All" button** — Marks all 48 checklist items as OK with one click
- **Auto-X on untick** — Click OK on already-checked item to mark as needs attention
- **Workflow:** Check All → Untick exceptions → Save

### Bug Fixes
- **Complete button** — Now shows warning modal for missing mandatory checklist items
- **Photo upload** — Fixed black screen / slowness with image compression (1920px max, 85% quality)
- **GPS timeout** — Reduced from 10s to 5s to prevent upload delays
- **Part request approval** — Now auto-confirms parts when admin approves request

### Restored Features (from refactor audit)
These features were accidentally removed during code modularization:
- Condition Checklist Card — view/edit with OK/Not OK buttons
- Parts Section — admin can add/edit/remove parts
- Job Details Card — Job Carried Out + Recommendation fields
- Confirmation Status Card — Parts and Job confirmation status
- Extra Charges Section — add/view/remove extra charges
- Helper Assignment — assign/remove helper technicians
- Deferred Completion Modal — complete without customer signature

### Part Request System (New)
- **Technicians can request parts** via "Request Part" button
- **Admins approve/reject** requests with part selection
- **Auto-adds to job** when approved

---

## [2026-01-31] - Code Quality & Architecture

### Modular Refactoring
Split large page components into maintainable modules:
- JobDetail (3262 → ~200 lines per component)
- TechnicianDashboard, AccountantDashboard
- CustomerProfile, EmployeeProfile, ForkliftsTabs
- MyVanStock, VanStockPage, CreateJob

### Performance
- **Bundle optimization** with lazy loading
- **Database query optimization** — eliminated N+1 queries
- **Infinite refetch fix** — resolved ERR_INSUFFICIENT_RESOURCES

### Security
- **RLS policies** fixed for all tables
- **Trigger fixes** for real-time updates
- **Supabase security linter** warnings resolved

---

## [2026-01-29] - Push Notifications & Real-Time

### Push Notifications
- Real browser push notifications (not just in-app)
- Background notification support
- Sound alerts for new jobs

### Real-Time Updates
- WebSocket connection health indicator
- Live job status updates
- Automatic sync on reconnect

### Job Response Timer
- 15-minute accept/reject requirement
- Auto-escalation if no response
- Visual countdown timer

---

## [2026-01-28] - Customer Feedback Implementation

### Phase 1-3 Features
- **Pricing hidden from technicians** — Only admins/accountants see prices
- **Binary checklist** — OK ✓ or Not OK ✗ only
- **Photo auto-start** — First photo starts job timer
- **Request editing** — Technicians can edit pending requests
- **Hourmeter persistence** — Preserved across reassignment
- **Dashboard notifications** — Recent notifications feed

---

## [2026-01] - January 2026 Summary

### Major Features Added
- Helper Technician System
- In-Job Request System (assistance, parts, skillful tech)
- Multi-Day Job Support with escalation
- Deferred Customer Acknowledgement
- Photo Categorization with ZIP download
- AutoCount Integration for invoices
- Fleet Dashboard with real-time status
- Photo Validation (GPS + timestamp)

### UI/UX Improvements
- Role-specific dashboards (Technician, Accountant)
- Dark mode support
- Mobile-optimized layouts
- Swipeable job cards

---

## [1.0.1] - December 2024

- Job types and categorization
- Photo tracking system
- Invoice format improvements

---

## [1.0.0] - December 2024

- Initial FieldPro release
- Core job management
- User authentication
- Basic reporting

---

## [2026-03-03] — Inventory Data Quality + Forklift Form Redesign

### Added
- **ACWER CSV self-import** — In-app CSV import with ACWER format auto-detection (3 header rows, 7 columns). Batch upserts (100/batch), audit trail (purchase for new, adjustment for changes), junk row filtering, smart liquid detection, category auto-mapping
- **Forklift form redesign** — New fields: Customer Forklift No (alphanumeric), Site (free text). DB migration added columns. Brand dropdown (Toyota, Nichiyu, Hangcha, BT, EP, Noblelift, TCM, Unicarries, Yale, Nissan, Others). Updated ForkliftType enum: Battery/Electrical, Diesel, Reach Truck, LPG, Others
- **Last Service Hourmeter in rental modals** — Optional field in both AssignForkliftModal instances (fleet list + forklift profile). Sets last_service_hourmeter, recalculates next_target_service_hour
- **Post-bulk-rent Service Reset Modal** — After bulk rent, shows table of rented forklifts with editable Last Service HRS column for batch hourmeter updates

### Fixed
- **Service Due tab** — Prediction view returns `current_hourmeter` not `hourmeter`; fixed ServiceDueTab.tsx
- **Category filter overflow** — InventoryFilters.tsx fixed with `lg:w-48`, `truncate`, `min-w-0`
- **Search service query chain** — Fixed stacked `.is()` bug in searchService.ts
- **Year field** — Changed from required (defaulting to current year) to optional (null default)
- **Bulk rent modal** — Last Service Hourmeter field hidden on bulk rent (only shows for single forklift)
- **Pagination** — Parts queries now paginate to fetch all 3200+ items
- **Null-safe toFixed** — Fixed crash on null sell_price/cost_price

## [2026-03-04] — Batch Receive Stock + Purchase History + Security Hardening

### Added
- **Batch Receive Stock redesign** — Search-based item selection (replaces dropdown), invoice/receipt upload to private Supabase bucket with signed URLs, liquid container context display
- **Purchase History** — 3-way toggle in Ledger tab: Recent Activity / Purchase History / Item Ledger. Batch grouping by PO+date, invoice viewer via signed URLs (1-hour expiry), search filter
- **Before-condition photo step** — Mandatory camera/gallery photo capture (min 1 photo) before entering hourmeter/checklist on job start. 2-step wizard in StartJobModal

### Fixed  
- **Service Worker cache** — Removed JS/CSS from CacheFirst runtime caching. Root cause: CacheFirst served stale JS chunks after new deploys
- **Currency** — Fixed `$` → `RM` (Malaysian Ringgit) across all inventory views
- **Supabase security** — Enabled RLS on `stocktakes` and `purchase_batches` tables. Set `search_path = public` on all 19 custom plpgsql functions. Hardened 53 RLS policies from `USING(true)` to `USING(auth.uid() IS NOT NULL)`. Restricted 3 overly-broad policies (job_audit_log, van_access_requests, van_audit_log) from all-roles to authenticated-only

---

## [2026-04-06] — Create Job and Reassign Button Fixes

### Fixed
- **External forklift now persists in Create Job flow** — adding a customer asset from "Add External Forklift" now refreshes the forklift dropdown cache, auto-selects the newly created asset immediately, and keeps billing set to chargeable instead of appearing to disappear after clicking Add.
- **External ownership payload hardened** — customer-owned external forklifts now save with both `ownership_type='external'` and customer ownership/customer linkage fields so downstream job creation logic treats them as client assets consistently.
- **Reassign button wiring hardened** — Job Detail reassign actions now use explicit button behavior for both the opener chip and modal actions, avoiding dead clicks from implicit submit/default button behavior.

## Archive

Detailed historical changelogs are available in `docs/archive/`.

## [2026-02-27 v2] — Liquid Inventory Bug Fixes

### Fixed
- **Forklift cost charging** — fluid job usage now records forklift_id + unit_cost_at_time + total_cost in inventory_movements. Cost auto-charged to forklift maintenance record.
- **Van ledger enum labels** — new movement types (van_transfer, job_usage, special_sale) now display correctly instead of blank
- **Admin flagged movements tab** — new "⚠️ Flagged" tab in Van Stock page shows all movements where van balance went negative, for admin review
- **DB trigger** — update_avg_cost_per_liter() now fires automatically on every purchase_batches insert

## [2026-02-27 v3] — Dead Code Cleanup

### Removed
- 17 orphan components never wired into the app (OfflineFormWrapper, PageTransition, SkeletonPatterns, ViewToggle, ServiceAutomationWidget, VanStockWidget, DevPanelToggle, FilterSheet, SwipeableCard, OfflineIndicator, NavigationComponents, NotificationPanel, OfflineSyncStatus, PinJobButton, QuotationPDF, SemanticSearch, TelegramTeamStatus)
- 3 dead services: mockDb.ts (341 lines), syncService.ts (132 lines), storageService.ts (111 lines)
- 3 unused exports from liquidInventoryService.ts: purchaseContainers, breakContainer, adjustStock (replaced by receiveLiquidStock)
- **Total: ~3,100 lines of dead code removed**

## [2026-02-28] — Audit Trail Phase 2

### Added
- **Immutable inventory movements** — DB trigger prevents editing/deleting movement records. Corrections must use reversal entries.
- **Stock Adjustment workflow** — new AdjustStockModal with reason codes (Damage, Theft, Spillage, Counting Error, Expired, Other). All adjustments require admin approval before stock changes.
- **Pending Adjustments tab** — admin approval queue. No self-approval allowed.
- **Stocktake workflow** — new Stocktake tab: admin enters physical count per liquid part, system calculates variance, requires approval from different admin. Approved stocktakes auto-correct stock levels.
- **Batch tracing** — every purchase movement links to its purchase_batch_id. Each batch can have a label and expiry date.
- **Expiry warnings** — amber banner on inventory page when any purchase batch expires within 30 days.
- **Cost variance alert** — ReceiveStockModal warns when new purchase price differs >10% from average.
- **New movement types** — `reversal` and `stocktake` added to inventory_movement_type enum.
- **New DB table** — `stocktakes` (part_id, system_qty, physical_qty, variance, reason, approval workflow).

### Fixed
- **Van stock liquid display** — VanStockDetailModal and TransferItemsModal now show total liters instead of "X sealed + Y.YL loose"
- **Van stock query performance** — getAllVanStocks narrowed to needed columns only (removed `select(*)` wildcards)
- **Ledger labels** — reversal, stocktake, van_transfer, job_usage, special_sale now display proper labels in both warehouse and van ledgers
- **TypeScript types** — InventoryMovement interface updated with purchase_batch_id, reversal_of fields
