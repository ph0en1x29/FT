# FieldPro Documentation Index

> **Quick Navigation:** Find the right document for your needs.

---

## For End Users

| Document | Description |
|----------|-------------|
| [USER_GUIDE.md](./USER_GUIDE.md) | How to use FieldPro — roles, features, workflows |
| [User_Manual_v1.1.md](./User_Manual_v1.1.md) | What's new in version 1.1 |

---

## For Engineers & Developers

| Document | Description |
|----------|-------------|
| [DB_SCHEMA.md](./DB_SCHEMA.md) | **Database structure** — tables, columns, relationships, enums |
| [WORKFLOW_SPECIFICATION.md](./WORKFLOW_SPECIFICATION.md) | Technical spec for ACWER implementation — schemas, APIs, logic |
| [SERVICE_AUTOMATION_SPEC.md](./SERVICE_AUTOMATION_SPEC.md) | Service due automation specification |
| [CHANGELOG.md](./CHANGELOG.md) | Decision log, client confirmations, implementation status |
| [DEVELOPMENT_PROCESS.md](./DEVELOPMENT_PROCESS.md) | How to implement changes — golden rules, checklists, templates |
| [SECURITY.md](./SECURITY.md) | Credential handling, Supabase security checklist |
| [.env.example](../.env.example) | Environment variable template |

---

## Recent Documentation Updates

- DB schema docs synced to current Supabase schema (2026-01-02 00:16:45 CST, author: Codex)

---

## For Project Managers

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Track what's confirmed vs pending vs built |
| [DEVELOPMENT_PROCESS.md](./DEVELOPMENT_PROCESS.md) | Client communication workflow, question templates |

---

## Document Purposes

### DB_SCHEMA.md
- **Audience:** Engineers, AI assistants
- **Content:** All database tables, columns, types, constraints, relationships, enums
- **Update when:** Schema changes, new tables added, columns modified

### USER_GUIDE.md
- **Audience:** End users (Admin, Technicians, Supervisors, Accountants)
- **Content:** Step-by-step instructions, role permissions, troubleshooting
- **Update when:** UI changes, new features released

### User_Manual_v1.1.md
- **Audience:** End users
- **Content:** Release notes for v1.1 features
- **Update when:** New version released (create new file: User_Manual_v1.2.md, etc.)

### WORKFLOW_SPECIFICATION.md
- **Audience:** Engineers, AI assistants
- **Content:** Database schemas, API endpoints, business logic, edge cases
- **Update when:** Requirements change, technical decisions made

### CHANGELOG.md
- **Audience:** Engineers, PMs, AI assistants
- **Content:** Client decisions, implementation status, version history
- **Update when:** Client confirms requirements, features built, releases made

### DEVELOPMENT_PROCESS.md
- **Audience:** Engineers, AI assistants
- **Content:** Golden rules, pre-implementation checklist, communication templates
- **Update when:** Process improves, lessons learned

### SECURITY.md
- **Audience:** Engineers, DevOps
- **Content:** Credential handling, Supabase security checklist, rotation schedule
- **Update when:** Before go-live, security practices change, credentials rotated

---

## Quick Links

- 🏠 [Back to Main README](../README.md)
- 📋 [Current Status](./CHANGELOG.md#implementation-status) — What's built vs pending
- 🔐 [Test Accounts](./USER_GUIDE.md#test-accounts) — Demo credentials

---

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.0 | Dec 2024 | Initial FieldPro release |
| 1.0.1 | Dec 2024 | Job types, photo tracking, invoice format |
| 1.1 | Jan 2026 | ACWER workflow (in development) |
