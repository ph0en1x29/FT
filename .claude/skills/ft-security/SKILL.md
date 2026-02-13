---
name: ft-security
description: Security audit for FieldPro code — RLS, auth, injection, credential exposure, Supabase patterns
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
---

# FT Security Audit

Audit the specified file(s) or directory for security issues.

## Checklist

1. **Credential exposure** — API keys, tokens, passwords in code or logs
2. **Supabase RLS** — Tables with RLS enabled must have policies; queries must respect row-level security
3. **Input sanitization** — User inputs used in queries, URLs, or rendered HTML
4. **Auth checks** — Role-based access enforced (admin/supervisor/technician/accountant)
5. **SQL injection** — Raw SQL or string interpolation in queries (use parameterized)
6. **XSS** — Unsafe dangerouslySetInnerHTML or unescaped user content
7. **IDOR** — Direct object references without ownership validation
8. **Sensitive data in client** — Passwords, tokens, PII exposed to frontend
9. **Error messages** — Stack traces or internal details leaked to users
10. **CORS/CSP** — Overly permissive cross-origin settings

## Output
```
[CRITICAL/HIGH/MEDIUM/LOW] filename:line — description
  → Fix: remediation
```
