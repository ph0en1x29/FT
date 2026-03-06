# FieldPro Client Demo Script

**Duration:** ~15 minutes
**Prerequisites:** App running at localhost:3000

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | dev@test.com | Dev123! |
| Technician | tech1@example.com | Tech123! |
| Supervisor | super1234@gmail.com | Super123! |

---

## Part 1: Admin Overview (3 min)

### 1.1 Login as Admin
1. Open app → Login page
2. Enter: `dev@test.com` / `Dev123!`
3. **Show:** Dashboard with KPI widgets and action items

### 1.2 Quick Tour
- **Dashboard:** "Here's the command center - open jobs, pending actions, fleet status"
- **Sidebar:** "Easy navigation to all modules"

---

## Part 2: Job Management (4 min)

### 2.1 View Jobs List
1. Click **Jobs** in sidebar
2. **Show:** List of all jobs with status badges
3. **Demo:** Use search to find a job
4. **Demo:** Filter by status (Open, In Progress, Completed)

### 2.2 Create New Job
1. Click **Create Job** button
2. Fill in:
   - Customer: Select from dropdown
   - Forklift: Select asset
   - Job Type: SERVICE
   - Priority: MEDIUM
   - Description: "Routine service check"
3. Click **Save**
4. **Show:** Job created, appears in list

### 2.3 Job Details
1. Click on a job to view details
2. **Show:** Full job info, hourmeter reading, history
3. **Mention:** "Technicians can update status from their mobile"

---

## Part 3: Fleet Management (2 min)

### 3.1 Forklifts
1. Click **Forklifts** in sidebar
2. **Show:** Complete fleet inventory
3. **Demo:** Click on a forklift to see profile
4. **Show:** Hourmeter history, service records, assigned customer

### 3.2 Customers
1. Click **Customers** in sidebar
2. **Show:** Customer list with contact info
3. **Demo:** Click to see customer profile with their assets

---

## Part 4: Technician Experience (3 min)

### 4.1 Switch to Technician View
1. Logout from Admin
2. Login as: `tech1@example.com` / `Tech123!`

### 4.2 Technician Dashboard
1. **Show:** "Technicians see only their assigned jobs"
2. **Show:** My Van Stock link in sidebar
3. **Mention:** "Limited access - no admin features visible"

### 4.3 My Van Stock
1. Click **My Van Stock**
2. **Show:** Parts inventory assigned to technician
3. **Demo:** "When running low, they click Request Replenishment"

---

## Part 5: Supervisor Features (2 min)

### 5.1 Switch to Supervisor
1. Logout, login as: `super1234@gmail.com` / `Super123!`

### 5.2 Hourmeter Review
1. Click **Hourmeter Review**
2. **Show:** "Supervisors approve amendment requests"
3. **Mention:** "Prevents fraudulent readings, maintains accuracy"

---

## Part 6: Reporting (1 min)

### 6.1 Back to Admin
1. Logout, login as Admin

### 6.2 Reports
1. Click **Reports** in sidebar
2. **Show:** Export options
3. **Mention:** "Generate PDF service reports, export data"

---

## Key Selling Points to Highlight

1. **Role-Based Access** - "Each user sees only what they need"
2. **Real-Time Updates** - "All data syncs instantly"
3. **Mobile-Friendly** - "Works on any device"
4. **Audit Trail** - "Every change is tracked"
5. **Hourmeter Accuracy** - "Amendment workflow prevents fraud"

---

## Common Questions & Answers

**Q: Can it work offline?**
A: Data syncs when connected. Core viewing works offline.

**Q: How secure is it?**
A: Supabase backend with row-level security. Each user only accesses their data.

**Q: Can we customize fields?**
A: Yes, job types, priorities, and custom fields can be configured.

**Q: What about integrations?**
A: API available. AutoCount integration for invoicing is in progress.

---

## If Something Goes Wrong

- **Login fails:** Check internet connection, try refresh
- **Data not loading:** Wait 2-3 seconds, data loads from cloud
- **Feature missing:** May be role-restricted, switch to Admin

---

## Post-Demo Actions

1. Send client login credentials for their own testing
2. Schedule follow-up for feedback
3. Prepare UAT environment if they proceed
