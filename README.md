# FieldPro

![Status](https://img.shields.io/badge/Status-v1.4.0-green)
![Client](https://img.shields.io/badge/Client-ACWER%20Industrial-blue)
![Last Updated](https://img.shields.io/badge/Updated-March%202026-lightgrey)

**Field Service Management Platform** for equipment service operations.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [User Guide](./docs/USER_GUIDE.md) | How to use FieldPro — roles, workflows, features |
| [Changelog](./docs/CHANGELOG.md) | Latest release notes and version history |
| [Documentation Index](./docs/README.md) | Full docs navigation |

### For Developers
| Document | Description |
|----------|-------------|
| [Workflow Specification](./docs/WORKFLOW_SPECIFICATION.md) | Technical spec for ACWER implementation |
| [Changelog](./docs/CHANGELOG.md) | Decision log & implementation status |
| [Development Process](./docs/DEVELOPMENT_PROCESS.md) | Guidelines for making changes |

---

## ✨ Features

### Core Platform
- Role-based permissions (Admin, Supervisor, Technician, Accountant)
- Job lifecycle management with full audit trails
- Auto-generated job numbers (`JOB-YYYYMMDD-XXXX`) with DB trigger
- Customer signature capture + deferred acknowledgement
- Before-condition photo capture on job start (mandatory step before checklist)
- 48-item tri-state condition checklist (OK / Not OK / blank)
- Invoice, Service Report & Quotation PDF generation
- Fleet (forklift) management + hourmeter tracking
- **Forklift form redesign** — Customer Forklift No, Site field, Brand dropdown (Toyota, Nichiyu, etc.)
- **Service reset modal** — Post-bulk-rent hourmeter updates for batch service tracking
- Helper Technician system + multi-day job support
- Real-time notification system with sound alerts
- Light/Dark theme (auto system preference)

### Inventory Management
- **Dual-unit inventory** — Parts tracked in discrete units AND liquid/bulk (L, kg, m)
- **Liquid inventory service** — Liquid-aware stock deduction in job flow
- **Bulk parts import** — CSV/JSON upload with upsert by part code
- **ACWER CSV self-import** — In-app CSV import with ACWER format auto-detection, batch upserts, audit trail
- **Purchase history** — Batch tracking with invoice viewer and signed URLs (1-hour expiry)
- **Batch receive stock** — Search-based item selection with invoice upload to private Supabase bucket
- **Inventory movement logging** — Full audit trail for all stock changes
- **Audit trail** — Immutable movements, stocktake workflow, adjustments with approval
- **Low stock alerts** — Threshold-based alerts on admin dashboard
- **Van Stock** — Per-technician van inventory with history tab and decimal quantity input

### Mobile & PWA
- **📱 Full Mobile Responsive** — All pages optimized; 44px minimum tap targets
- **📲 PWA** — Installable as standalone app; offline caching (service worker)
- **🧭 Role-Aware Bottom Navigation** — Tabs and badge counts by role
- **⚡ FAB** — Role-specific quick actions in one tap
- **⌨️ Command Palette** — `Cmd+K` global search and navigation
- **↕️ Pull-to-Refresh** + **👆 Swipe Actions** on key lists

### Search & Testing
- **🔍 Semantic Search** — pgvector (Supabase gte-small, 384d) on jobs and customers
- **🧪 E2E Test Suite** — Playwright critical-path tests (login, job create, job complete, parts approval)
- **⚙️ CI/CD** — GitHub Actions build + smoke test pipeline

### v1.1 — January 2026
- Helper Technician System, In-Job Request System, Multi-Day Jobs
- KPI Dashboard, Enhanced Escalation, Van Stock System
- AutoCount accounting export, Push Notifications
- Bundle optimization (1.5MB → 290KB initial load)
- Comprehensive RLS security hardening

---

## 🚀 Releases

### [v1.4.0](https://github.com/ph0en1x29/FT/releases/tag/v1.4.0) — March 4, 2026
Inventory overhaul (ACWER CSV import, purchase history, batch receive), forklift form redesign, before-photo job start, 53 RLS policies hardened — [View details →](https://github.com/ph0en1x29/FT/releases/tag/v1.4.0)

### v1.3 — February 26, 2026
Job numbers, liquid inventory, bulk parts import, checklist tri-state, semantic search, E2E tests, mobile UX overhaul — [View details →](./docs/CHANGELOG.md)

### v1.2 — February 17, 2026
Full mobile + PWA overhaul, command palette, role-aware navigation, FAB, dark mode — [View details →](./docs/CHANGELOG.md)

### v1.1 — January 2026
ACWER Industrial workflow implementation — [View details →](./docs/CHANGELOG.md)

### v1.0 — December 2025
Initial release with full FSM capabilities

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ (20 recommended)
- npm 9+
- Supabase project ([supabase.com](https://supabase.com))

### Installation

```bash
git clone https://github.com/ph0en1x29/FT.git
cd FT
npm install
cp .env.example .env.local   # Edit with your Supabase credentials
npm run dev                   # http://localhost:5173
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Vite HMR) |
| `npm run build` | Production build + PWA service worker |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint + TypeScript checks |
| `npm test` | Run Playwright E2E tests |
| `npm run test:ui` | Playwright interactive UI mode |

### Test Accounts
See [User Guide → Test Accounts](./docs/USER_GUIDE.md#test-accounts)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (invoices, job photos) |
| Search | pgvector (gte-small 384d embeddings) |
| PWA | Workbox (vite-plugin-pwa) |
| Testing | Playwright E2E |
| CI/CD | GitHub Actions → Vercel auto-deploy |
| Charts | Recharts |
| Icons | Lucide React |
| Error Tracking | Sentry |

### Deployment

- **Hosting:** [Vercel](https://vercel.com) — auto-deploys from `main` branch
- **Live URL:** [ft-kappa.vercel.app](https://ft-kappa.vercel.app)
- **Database:** Supabase (managed PostgreSQL)
- **CI:** GitHub Actions runs build + smoke tests on every push/PR

---

## 🤝 Contributing

Before making changes, please read:

1. **[Development Process](./docs/DEVELOPMENT_PROCESS.md)** — Golden rules and checklists
2. **[Changelog](./docs/CHANGELOG.md)** — Current status and decisions

### Key Principle

> **Before starting any changes or implementing new things, be sure to have a thorough discussion and confirm the client needs. Recheck before making new changes so things can run more smoothly.**

---

## 📁 Project Structure

```
FT/
├── src/
│   ├── components/       # Shared UI components
│   ├── contexts/         # React contexts (auth, theme, notifications)
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Page components (route-based)
│   │   ├── Dashboard/
│   │   ├── JobDetail/
│   │   ├── ForkliftsTabs/
│   │   ├── ForkliftProfile/
│   │   ├── Inventory/
│   │   └── ...
│   ├── services/         # Supabase service layer
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── docs/                 # Project documentation
├── tests/                # Playwright E2E tests
├── .github/workflows/    # CI pipeline
└── public/               # Static assets + PWA manifest
```

## 🔗 Links

| | |
|---|---|
| **Live** | [ft-kappa.vercel.app](https://ft-kappa.vercel.app) |
| **Repo** | [github.com/ph0en1x29/FT](https://github.com/ph0en1x29/FT) |
| **Docs** | [docs/](./docs/) |
| **Releases** | [GitHub Releases](https://github.com/ph0en1x29/FT/releases) |

---

## 📄 License

Proprietary — All rights reserved. © 2025-2026 Athenix Technologies.
