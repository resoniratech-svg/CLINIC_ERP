# API Contract: Billing & Finance (Module 9)

## 1. Billing Rules & Master Configurations
- **Endpoint**: `GET /api/v1/billing/rules`
- **Authentication**: `Bearer <token>`
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "billing_config": [ ... ],
      "discount_rules": [
        { "id": 1, "rule_name": "Standard Manager Discount", "max_discount_pct": 20.0, "role": "pro_manager" }
      ],
      "payment_methods": [
        { "id": 1, "method_name": "cash", "display_name": "Cash", "is_active": true }
      ]
    }
  }
  ```

---

## 2. Consultation Fee Configuration
- **Endpoints**:
  - `GET /api/v1/billing/consultation-fees?doctor_id=...`
  - `POST /api/v1/billing/consultation-fees` (Super Admin role required)
- **Request Body**:
  ```json
  {
    "doctor_id": 1,
    "appointment_type": "new",
    "fee_amount": 550,
    "status": "active"
  }
  ```

---

## 3. Itemized Bill Generation
- **Endpoint**: `POST /api/v1/billing/bills`
- **Authentication**: `Bearer <token>` (Roles: `receptionist` [consultation fee only], `pro_manager`, `super_admin`)
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "doctor_id": 1,
    "bill_type": "treatment",
    "amount": 2500,
    "discount_amount": 250,
    "items": [
      { "charge_type": "Therapy Session", "description": "Acupuncture & Homeopathy", "amount": 1500 },
      { "charge_type": "Consultation Charge", "description": "Specialist Review", "amount": 1000 }
    ]
  }
  ```
- **Discount Protection**: Rejects discounts $> 20\%$ with HTTP 400 unless explicitly approved or submitted by Super Admin.

---

## 4. Payment Settlement & Cash Ledger Synchronization
- **Endpoint**: `POST /api/v1/billing/payments`
- **Request Body**:
  ```json
  {
    "bill_id": 10,
    "payment_method": "cash",
    "amount": 1250
  }
  ```
- **Supported Payment Modes**: `cash`, `card`, `upi`, `razorpay`, `bajaj_pay`.
- **Automatic Ledger Sync**: When `payment_method = 'cash'`, automatically updates `cash_revenue` and recalculates `closing_balance` in `cash_ledger` for today.

---

## 5. Multichannel Revenue Report
- **Endpoint**: `GET /api/v1/billing/revenue?start_date=...&end_date=...`
- **Authentication**: `Bearer <token>` (Roles: `pro_manager`, `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "breakdown": {
        "cash": 1250.0,
        "card": 0.0,
        "upi": 1000.0,
        "razorpay": 0.0,
        "bajaj_pay": 0.0
      },
      "grand_total": 2250.0
    }
  }
  ```
