# FieldPro Development Process

## Golden Rule

> **Before starting any changes or implementing new things, be sure to have a thorough discussion and confirm the client needs. Recheck before making new changes so things can run more smoothly.**

---

## Pre-Implementation Checklist

### ✅ Before Writing Any Code

- [ ] **Client requirements documented** — Written specification exists
- [ ] **Ambiguities resolved** — All questions answered in writing
- [ ] **Edge cases discussed** — What happens when X fails?
- [ ] **Client has confirmed** — Written approval or sign-off
- [ ] **Existing system reviewed** — Understand what's already built
- [ ] **Impact assessment done** — What else might this affect?

### ❌ Do NOT Start If

- Requirements are verbal only
- "I think they want..." (assumptions)
- Edge cases unclear
- Conflicting requirements unresolved
- No written confirmation from client

---

## Client Communication Workflow

### Step 1: Receive Request

When client sends new requirements:

1. **Read thoroughly** — Don't skim
2. **Cross-reference** — Check against existing system and previous docs
3. **List unknowns** — What's not explicitly stated?
4. **Identify conflicts** — Does this contradict earlier decisions?

### Step 2: Clarify

Create structured questions for client:

```markdown
## Question Format

**Question:** [Clear, specific question]

**Options:**
- A) [First option with implications]
- B) [Second option with implications]
- C) [Third option with implications]

**Our Recommendation:** [Your suggestion with reasoning]

**Your Choice:** ☐ A  ☐ B  ☐ C
```

**Good questions:**
- Specific scenarios ("If job assigned Monday 4pm, when does alert trigger?")
- Multiple choice when possible
- Include your recommendation

**Bad questions:**
- Vague ("How should this work?")
- Yes/No when more detail needed
- Technical jargon client won't understand

### Step 3: Document Answers

When client responds:

1. **Summarize** their answers in your own words
2. **Confirm** you understood correctly
3. **Update** specification document
4. **Log** in CHANGELOG.md

### Step 4: Build

Only after written confirmation:

1. Update WORKFLOW_SPECIFICATION.md with final decisions
2. Create database migration scripts
3. Implement feature
4. Test against documented requirements
5. Update CHANGELOG.md

---

## Specification Documents

### Required Files

| File | Purpose | When to Update |
|------|---------|----------------|
| `CHANGELOG.md` | Track all decisions and changes | Every client confirmation |
| `WORKFLOW_SPECIFICATION.md` | Technical spec for engineers | When requirements finalized |
| `DEVELOPMENT_PROCESS.md` | This file — process guidelines | When process improves |

### Document Standards

**CHANGELOG.md:**
- Date every entry
- Reference client communication
- Mark status (Confirmed / Pending / TBD)

**WORKFLOW_SPECIFICATION.md:**
- Include code examples
- Show data schemas
- Document edge cases
- Version history at bottom

---

## Quick Reference: Decision Status

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ Confirmed | Client approved requirements in writing | Can begin implementation |
| ⏳ Pending | Awaiting client response | Do NOT implement |
| 🟡 In Discussion | Questions sent, no response yet | Do NOT implement |
| ❓ TBD | Not yet discussed with client | Raise before implementing |
| ⚠️ Assumption | Our best guess, not confirmed | Must confirm before implementing |

## Quick Reference: Build Status

| Status | Meaning |
|--------|---------|
| ❌ Not started | Requirements may be confirmed, but code not written |
| 🔨 In development | Currently being built |
| 🧪 Testing | Built, undergoing testing |
| ✔️ Completed | Implemented, tested, deployed |

### Important Distinction

**"Ready to build" ≠ "Built"**

- **Ready to build** = Requirements confirmed, CAN start coding
- **Built** = Code written and deployed

Always check BOTH requirement status AND build status before making changes.

---

## Handoff Guidelines

When another engineer or AI model picks up this project:

### They Should Read (In Order)
1. `DEVELOPMENT_PROCESS.md` — This file (understand the workflow)
2. `CHANGELOG.md` — What's been decided
3. `WORKFLOW_SPECIFICATION.md` — Technical details

### They Should Know
- Current status of each feature
- Pending decisions awaiting client
- Any technical constraints or decisions made

### They Should NOT
- Make assumptions about undocumented requirements
- Implement features marked as "Pending" or "TBD"
- Change confirmed decisions without client approval

---

## Template: Client Clarification Document

Use this when creating questions for client:

```markdown
# [Project Name] Clarification Questions

## Context
[Brief description of what we're building]

## Questions

### 1. [Topic]
**Question:** [Specific question]

**Options:**
- A) [Option with implications]
- B) [Option with implications]

**Our Recommendation:** [Suggestion with reasoning]

**Your Choice:** ☐ A  ☐ B

---

## Additional Notes
[Space for client comments]

## Confirmation
Confirmed by: _________________ Date: _________
```

---

## Revision History

| Date | Change |
|------|--------|
| Jan 2026 | Initial process documentation |
