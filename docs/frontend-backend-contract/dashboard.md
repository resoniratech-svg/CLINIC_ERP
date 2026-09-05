# API Contract: Super Admin Dashboard (Module 2)

## 1. Retrieve Operational Dashboard Summary
- **Endpoint**: `GET /api/v1/dashboard`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Request Parameters / Body**: None
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "today_overview": {
        "new_patients": 2,
        "new_enquiries": 5,
        "appointments": 8,
        "walk_ins": 4,
        "conversions": 1,
        "followups_due": 3,
        "renewals": 0,
        "acq_patients": 12,
        "due_patients_count": 1,
        "due_patients_amount": 500.0
      },
      "revenue_today": {
        "cash": 1200.0,
        "card": 0.0,
        "upi": 500.0,
        "razorpay": 0.0,
        "bajaj_pay": 0.0,
        "grand_total": 1700.0
      },
      "cash_position": {
        "opening_balance": 0.0,
        "cash_revenue": 1200.0,
        "cash_expenditure": 0.0,
        "available_cash": 1200.0,
        "deposited_amount": 0.0,
        "closing_balance": 1200.0
      },
      "monthly_target": {
        "month": 9,
        "year": 2026,
        "overall_target": 500000.0,
        "overall_achieved": 23400.0,
        "overall_remaining": 476600.0,
        "overall_achievement_pct": 4.68,
        "enquiry_target": 200000.0,
        "enquiry_achieved": 15000.0,
        "unit_target": 300000.0,
        "unit_achieved": 8400.0
      },
      "alerts": [
        {
          "type": "password_reset",
          "message": "1 password reset request(s) pending approval"
        },
        {
          "type": "low_stock",
          "message": "3 medicine item(s) below reorder level"
        },
        {
          "type": "expiring_medicine",
          "message": "1 medicine batch(es) expiring within 30 days"
        },
        {
          "type": "target_behind",
          "message": "Monthly revenue achievement (5%) is currently below target."
        }
      ]
    },
    "message": "Dashboard stats retrieved successfully"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid Bearer token
  - `403 Forbidden`: Authenticated user is not a `super_admin`
- **Database Tables Involved**:
  - `patients`, `leads`, `appointments`, `crm_followups`, `renewals`, `acq_patients`, `due_patients`
  - `payments`, `bills`, `cash_ledger`
  - `targets`, `medicine_stock`, `medicine_master`, `password_reset_requests`
