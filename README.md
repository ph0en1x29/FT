# FieldPro

![Status](https://img.shields.io/badge/Status-v1.2%20Active%20Development-green)
![Client](https://img.shields.io/badge/Client-ACWER%20Industrial-blue)
![Last Updated](https://img.shields.io/badge/Updated-February%202026-lightgrey)

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
- Customer signature capture + deferred acknowledgement
- 48-item condition checklist
- Invoice, Service Report & Quotation PDF generation
- Fleet (forklift) management + hourmeter tracking
- Real-time notification system with sound alerts
- Light/Dark theme (auto system preference)

### v1.2 — February 2026
- **📱 Full Mobile Responsive + PWA** — All pages optimized for mobile, installable as app
- **🧭 Role-Aware Mobile Navigation** — Bottom nav with role-specific tabs and badge counts
- **⚡ Floating Action Button (FAB)** — Role-specific quick actions in one tap
- **⌨️ Command Palette** — Cmd+K global search and navigation
- **↕️ Pull-to-Refresh** — Native-feel refresh on Jobs page
- **👆 Swipe Actions** — Swipe to approve/reject on StoreQueue items
- **💀 Skeleton Loading** — Smooth loading states across all pages
- **📊 Van Stock History Tab** — Full parts deduction log with timestamps
- **🔢 Decimal Quantities** — Liquid/bulk parts support (e.g. 1.5L)
- **🌗 Global Dark Mode** — Theme-aware across all 73+ components

### v1.1 — January 2026
- Helper Technician System, In-Job Request System, Multi-Day Jobs
- KPI Dashboard, Enhanced Escalation, Van Stock System
- AutoCount accounting export, Push Notifications
- Bundle optimization (1.5MB → 290KB initial load)
- Comprehensive RLS security hardening

---

## 🚀 Release Notes

### v1.2 (February 2026)
Full mobile + PWA overhaul, command palette, role-aware UX — [View details →](./docs/CHANGELOG.md)

### v1.1 (January 2026)
ACWER Industrial workflow implementation — [View details →](./docs/CHANGELOG.md)

### v1.0
- Initial release with full FSM capabilities

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd FT

# Install dependencies
npm install

# Set up environment
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### Test Accounts
See [User Guide → Test Accounts](./docs/USER_GUIDE.md#test-accounts)

---

## 🤝 Contributing

Before making changes, please read:

1. **[Development Process](./docs/DEVELOPMENT_PROCESS.md)** — Golden rules and checklists
2. **[Changelog](./docs/CHANGELOG.md)** — Current status and decisions

### Key Principle

> **Before starting any changes or implementing new things, be sure to have a thorough discussion and confirm the client needs. Recheck before making new changes so things can run more smoothly.**

---

## 🔗 Links

- **Live Demo:** https://ft-kappa.vercel.app/
- **AI Studio:** https://ai.studio/apps/drive/1myzJ8ssh9kCG1wrt_2wQD9OMNOuWkWKW

---

## 📄 License

Proprietary — All rights reserved.
