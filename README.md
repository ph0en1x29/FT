# FieldPro

![Status](https://img.shields.io/badge/Status-v1.1%20In%20Development-yellow)
![Client](https://img.shields.io/badge/Client-ACWER%20Industrial-blue)

**Field Service Management Platform** for equipment service operations.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [User Guide](./docs/USER_GUIDE.md) | How to use FieldPro — roles, workflows, features |
| [What's New in v1.1](./docs/User_Manual_v1.1.md) | Latest release notes |
| [Documentation Index](./docs/README.md) | Full docs navigation |

### For Developers
| Document | Description |
|----------|-------------|
| [Workflow Specification](./docs/WORKFLOW_SPECIFICATION.md) | Technical spec for ACWER implementation |
| [Changelog](./docs/CHANGELOG.md) | Decision log & implementation status |
| [Development Process](./docs/DEVELOPMENT_PROCESS.md) | Guidelines for making changes |

---

## ✨ Features

### Current (v1.0)
- Role-based permissions (Admin, Supervisor, Technician, Accountant)
- Job lifecycle management with audit trails
- Customer signature capture
- Condition checklist (48 inspection items)
- Invoice & Service Report PDF generation
- Forklift rental tracking
- Light/Dark theme

### Coming in v1.1 (ACWER Workflow)

| Feature | Status |
|---------|--------|
| ✅ Service Intervals Config | Completed |
| ✅ Hourmeter Prediction + Dashboard | Completed |
| ✅ Photo Categorization + ZIP Download | Completed |
| 🔨 Helper Technician support | In Progress |
| ⏳ In-Job Request System (Assistance, Spare Parts) | Planned |
| ⏳ Multi-Day Jobs with escalation | Planned |
| ⏳ Deferred Customer Acknowledgement | Planned |
| ⏳ Job Reassignment (Full) | Planned |

---

## 🚀 Release Notes

### v1.1 (In Development)
ACWER Industrial workflow implementation — [View details →](./docs/User_Manual_v1.1.md)

### v1.0.1
- Job Type Classification (Service/Repair/Checking/Accident)
- Photo timestamps and uploader tracking
- Professional invoice format

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
