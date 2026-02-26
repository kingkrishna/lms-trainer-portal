# API Contracts – LMS + Trainer Marketplace + Job Portal

**Base URL:** `{API_BASE_URL}` (e.g. `/api/v1`)  
**Auth:** JWT in HTTP-only cookie `lms_token` + optional `Authorization: Bearer <token>`  
**Content-Type:** `application/json`

---

## 1. Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register (body: role, email, password, profile payload) | No |
| POST | `/auth/login` | Login (email, password) → sets cookie | No |
| POST | `/auth/logout` | Logout (clear cookie) | Yes |
| GET | `/auth/me` | Current user + role profile | Yes |
| POST | `/auth/refresh` | Refresh JWT (if using refresh token) | Cookie |

**Register body (student):** `{ "email", "password", "role": "student", "full_name", "phone?" }`  
**Register body (trainer):** `{ "email", "password", "role": "trainer", "full_name", "bio?" }`  
**Register body (recruiter):** `{ "email", "password", "role": "recruiter", "company_name", "contact_person?" }`  
**Login body:** `{ "email", "password" }`

**Rules:** Frontend never receives or sends price; backend is sole authority for roles and session.

---

## 2. Users & Profiles

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| GET | `/users/me` | Current user profile (student/trainer/recruiter) | All |
| PATCH | `/users/me` | Update own profile | All |
| GET | `/admin/users` | List users (paginated, filter by role) | super_admin |
| PATCH | `/admin/users/:id` | Activate/deactivate user | super_admin |

---

## 3. Courses (Admin)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| POST | `/admin/courses` | Create course (title, slug, description, **price**) | super_admin |
| GET | `/admin/courses` | List all courses | super_admin |
| GET | `/admin/courses/:id` | Course detail | super_admin |
| PATCH | `/admin/courses/:id` | Update course (**price** change logged) | super_admin |
| DELETE | `/admin/courses/:id` | Deactivate/soft-delete | super_admin |

**Price is only accepted from Super Admin; stored and enforced server-side.**

---

## 4. Courses (Public / Catalog)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| GET | `/courses` | List active courses (no prices if not needed for display; or price from server only) | Any |
| GET | `/courses/:slug` | Course detail **with price from server** (frontend must not send or compute price) | Any |

---

## 5. Trainers & Marketplace

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| GET | `/trainers` | List approved trainers (optional: by course) | Any |
| GET | `/trainers/:id` | Trainer profile + courses they teach | Any |
| POST | `/trainers/me/courses` | Trainer: add course to teach (courseId only; no price) | trainer |
| DELETE | `/trainers/me/courses/:courseId` | Trainer: remove course | trainer |
| PATCH | `/trainers/me` | Update trainer profile | trainer |
| GET | `/admin/trainers` | List trainers (pending/approved) | super_admin |
| POST | `/admin/trainers/:id/approve` | Approve trainer | super_admin |

---

## 6. Payments & Enrollment (Critical – Server Authority)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| POST | `/payments/create-order` | Create payment order. **Body:** `{ "courseId", "trainerId" }`. Backend fetches **fixed price from DB**, creates gateway order, returns order id + amount (for display only). | student |
| POST | `/payments/verify` | Verify payment (webhook or redirect). Backend verifies signature & amount; creates enrollment. | student (or webhook) |
| GET | `/payments/my` | List my payments | student, recruiter |
| GET | `/enrollments/my` | List my enrollments (only after verified payment) | student |
| GET | `/enrollments/:id` | Enrollment detail (ownership check) | student, trainer |
| GET | `/admin/payments` | All payments, filters | super_admin |

**Rule:** Frontend must never send `amount` or `price`. Backend always computes amount from DB for the given course.

---

## 7. LMS (Materials & Progress)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| GET | `/enrollments/:id/materials` | Materials for this enrollment (access only if enrolled & paid) | student, trainer |
| GET | `/enrollments/:id/materials/:materialId/access` | Get access URL/token for material (validated per request) | student |
| POST | `/enrollments/:id/progress` | Mark material complete (body: materialId) | student |
| GET | `/enrollments/:id/progress` | Progress summary | student, trainer |
| POST | `/admin/courses/:id/materials` | Add material to course | super_admin |
| PATCH | `/admin/materials/:id` | Update material | super_admin |

**Access validated on every request; no client-side access control.**

---

## 8. Job Portal

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| POST | `/payments/recruiter-access` | Create order for recruiter access (amount from admin_settings) | recruiter |
| GET | `/jobs` | List jobs (recruiter: own; student: all active) | student, recruiter |
| POST | `/jobs` | Create job | recruiter (only if has_paid_access) |
| GET | `/jobs/:id` | Job detail | student, recruiter |
| PATCH | `/jobs/:id` | Update job | recruiter (own) |
| POST | `/jobs/:id/applications` | Apply to job (body: cover_message?) | student |
| GET | `/jobs/:id/applications` | List applications (recruiter own job) | recruiter |
| GET | `/students/search` | Search student profiles (recruiter only, after paid access) | recruiter |

---

## 9. Messages & Notifications

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| GET | `/messages` | My inbox | All |
| POST | `/messages` | Send message | All |
| PATCH | `/messages/:id/read` | Mark read | All |
| GET | `/notifications` | Notifications (optional) | All |

---

## 10. Admin Dashboard & Settings

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|--------|
| GET | `/admin/settings` | List settings (e.g. commission, recruiter_access_amount) | super_admin |
| PATCH | `/admin/settings` | Update setting (key, value) | super_admin |
| GET | `/admin/audit-logs` | Audit logs (paginated, filter) | super_admin |
| GET | `/admin/disputes` | Placeholder for Zoho Desk / disputes | super_admin |

---

## 11. Zoho (Sync / Webhooks)

- **Zoho CRM:** Sync user lifecycle (create/update contact on register/profile update).
- **Zoho Mail:** Trigger transactional emails (backend calls Zoho Mail API).
- **Zoho Desk:** Create ticket on dispute; optional webhook to update status.
- **Zoho Books:** Sync payment records for reconciliation (backend pushes after payment verification).
- **Zoho Analytics:** Feed events/reports (optional API or export).

API endpoints for Zoho are internal or webhook receivers; not exposed to frontend as primary data source. Backend remains source of truth.

---

## Error Responses

- `400` – Validation error (body: `{ "error", "details?" }`)
- `401` – Unauthorized (missing or invalid JWT)
- `403` – Forbidden (role or ownership)
- `404` – Resource not found
- `429` – Rate limited
- `500` – Server error (no sensitive details)

All monetary values and access decisions are enforced server-side only.
