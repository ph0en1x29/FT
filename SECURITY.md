# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.4.x   | ✅ Active |
| < 1.4   | ❌ No     |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

- **Email:** security@athenixtech.com
- **Do NOT** open a public GitHub issue for security vulnerabilities

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Security Measures

- **Row Level Security (RLS)** — All database tables protected with Supabase RLS policies
- **Authentication** — Supabase Auth with email/password; all API calls require valid JWT
- **Role-based Access** — Four roles (Admin, Supervisor, Technician, Accountant) with app-layer enforcement
- **Immutable Audit Trail** — DB trigger prevents editing/deleting inventory movement records
- **Private Storage** — Invoice uploads use private Supabase Storage buckets with signed URLs (1-hour expiry)
- **HTTPS Only** — All traffic encrypted in transit via Vercel + Supabase
- **No Client-Side Secrets** — Only the Supabase anon key (safe for client) is exposed; service role keys are server-only
