# WeCare Homeopathy ERP — Complete API Contract Reference

## Base URL
`http://localhost:5000/api/v1`

---

## 1. Authentication
* `POST /auth/login`: `{ username, password }` $\rightarrow$ `{ success, data: { token, user } }`
* `GET /auth/me`: `Bearer <token>` $\rightarrow$ `{ success, data: user }`
* `POST /auth/logout`: `Bearer <token>` $\rightarrow$ `{ success, message }`

---

## 2. Dashboard
* `GET /dashboard/stats`: `{ success, data: { total_patients, today_appointments, monthly_revenue, active_doctors } }`
* `GET /dashboard/charts`: `{ success, data: { revenue_trend, patient_traffic_trend, department_split } }`

---

## 3. User Management
* `GET /users?role=&status=`: Lists hospital users with joined profile details.
* `POST /users`: Provisions user account with role-specific profile (doctor, executive, receptionist, pro, pharmacy).
* `PUT /users/:id`: Updates personnel attributes.
* `PATCH /users/:id/status`: Updates user status (`active` / `inactive`).

---

## 4. Receptionist Operations
* `POST /receptionist/patients/register-flow`: Single-flow atomic registration.
* `GET /receptionist/patients/search?search=`: Patient lookup across phone/name/UHID.
* `GET /receptionist/patients/:id/overview`: Comprehensive 360 patient profile.
* `POST /receptionist/appointments`: Book consultation.
* `PUT /receptionist/appointments/:id/reschedule`: Reschedule appointment.
* `PUT /receptionist/appointments/:id/cancel`: Cancel appointment.
* `POST /receptionist/appointments/:id/check-in`: 1-click check-in.
* `GET /receptionist/waiting-queue`: Live OPD waiting room.
* `POST /receptionist/billing/consultation`: Generate consultation fee bill.
* `POST /receptionist/billing/due-collection`: Collect outstanding balance.

---

## 5. Doctor & Consultation
* `GET /doctors`: List doctors with consultation fee tiers.
* `GET /doctors/:id/summary`: Pre-transfer workload audit.
* `POST /doctors/:id/transfer`: Execute resignation and successor reassignment.
* `POST /doctor/consultations`: Record diagnosis, vitals, symptoms, and clinical advice.
* `POST /doctor/prescriptions`: Prescribe remedies with potency, dosage, and duration.

---

## 6. PRO / Manager
* `GET /pro/queue`: Patient handoff queue from doctors with confidential notes masking.
* `GET /pro/packages`: Treatment package offerings (monthly, quarterly, half-yearly, yearly).
* `POST /pro/billing/treatment`: Generate itemized treatment bill.
* `GET /pro/cash-summary`: Daily cash collections breakdown.
* `POST /pro/feedback`: Log patient feedback & complaints.

---

## 7. Executive / Call Center
* `GET /executive/dashboard`: Executive lead performance metrics.
* `POST /executive/leads`: Create single inbound/outbound lead.
* `POST /executive/leads/import/preview`: Validate bulk Excel file and identify duplicate phone numbers.
* `POST /executive/leads/import/confirm`: Commit non-duplicate leads to database.
* `POST /executive/calls`: Record call attempt outcome (Interested, Callback, Not Interested, Invalid).
* `GET /executive/incentives`: Monthly lead generation incentive compensation.

---

## 8. Target Management
* `GET /targets?month=&year=`: Retrieve hospital monthly target metrics.
* `POST /targets`: Create monthly quota ($\text{Enquiry} + \text{Unit} = \text{Overall}$).
* `GET /targets/doctors`: Individual doctor performance and revenue target tracking.
* `POST /targets/doctors`: Set monthly physician target.

---

## 9. Billing & Finance
* `GET /billing/rules`: Discount rules, payment configurations, and tax parameters.
* `GET /billing/consultation-fees?doctor_id=`: Fee matrix by doctor.
* `POST /billing/consultation-fees`: Set doctor fee tiers.
* `POST /billing/bills`: Itemized bill generation with 20% max discount enforcement.
* `POST /billing/payments`: Payment settlement across Cash, Card, UPI, Razorpay, and Bajaj Pay.
* `GET /billing/revenue?start_date=&end_date=`: Multichannel revenue breakdown.

---

## 10. Cash Management
* `GET /cash/ledger?date=`: Retrieve daily physical cash drawer ledger.
* `POST /cash/expenditure`: Record petty cash expense with automatic drawer debit.
* `POST /cash/deposit`: Record bank cash deposit with $\le \text{available\_cash}$ validation.

---

## 11. CRM
* `GET /crm/followups?category=&status=&assigned_to=`: CRM follow-up tracker.
* `POST /crm/followups`: Create follow-up (restricted to Receptionist and PRO/Manager).
* `POST /crm/acq`: Enroll patient into ACQ care plan.
* `POST /crm/ocnr`: Mark patient as Old Case (OC) or Non-Responding (NR).
* `POST /crm/referrals`: Create patient/employee referral.

---

## 12. Pharmacy
* `GET /pharmacy/dashboard`: Pharmacy KPIs and reorder warnings.
* `GET /pharmacy/queue`: Prescriptions awaiting dispensing.
* `GET /pharmacy/medicines`: Search medicines catalog.
* `POST /pharmacy/medicines`: Add remedy master item.
* `GET /pharmacy/stock`: Multi-batch stock inventory with FEFO expiry.
* `POST /pharmacy/stock`: Ingest batch stock.
* `POST /pharmacy/prescriptions/:id/dispense/complete`: Dispense medicines and deduct stock.
* `POST /pharmacy/clarifications`: Submit clarification request to doctor.

---

## 13. Reports
* `GET /reports/patients`: Patient demographic and intake analytics.
* `GET /reports/revenue`: Collections and tender breakdown.
* `GET /reports/target`: Target realization vs actuals.
* `GET /reports/executive`: Call center conversions and incentives.
* `GET /reports/pharmacy`: Medicine catalog and expiry risk audit.
* `GET /reports/crm`: Care follow-ups and churn metrics.

---

## 14. Settings & Masters
* `GET /settings/permissions-matrix`: Retrieve role-permission mapping.
* `POST /settings/permissions-matrix`: Update module access level.
* `GET /settings/hospital`: Key-value global clinic parameters.
* `PUT /settings/hospital`: Update clinic parameter.
* `GET /settings/masters/:type`: Retrieve master items.
* `POST /settings/masters/:type`: Add item to master catalog.

---

## 15. Audit & Login Logs
* `GET /logs/audit`: System audit trail with user/action diffs.
* `GET /logs/login`: Historical login attempts and session status.
