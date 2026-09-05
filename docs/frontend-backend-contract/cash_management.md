# API Contract: Cash Management (Module 11)

## 1. Daily Cash Drawer & Ledger
- **Endpoint**: `GET /api/v1/cash/ledger?date=YYYY-MM-DD`
- **Authentication**: `Bearer <token>` (Roles: `pro_manager`, `super_admin`)
- **Mathematical Formula**:
  $$\text{Closing Balance} = \text{Opening Balance} + \text{Cash Revenue} - \text{Cash Expenditure} - \text{Deposited Amount}$$
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "branch_id": 1,
      "ledger_date": "2026-09-03",
      "opening_balance": 5000.0,
      "cash_revenue": 2500.0,
      "cash_expenditure": 250.0,
      "deposited_amount": 500.0,
      "available_cash": 7250.0,
      "closing_balance": 6750.0
    }
  }
  ```

---

## 2. Petty Cash Expenditures
- **Endpoint**: `POST /api/v1/cash/expenditure`
- **Authentication**: `Bearer <token>` (Roles: `pro_manager`, `super_admin`)
- **Request Body**:
  ```json
  {
    "expense_date": "2026-09-03",
    "expense_category": "Clinic Supplies",
    "description": "Cotton and sanitizers",
    "amount": 250
  }
  ```
- **Side Effect**: Automatically increments `cash_expenditure` and decreases `closing_balance` in `cash_ledger`.

---

## 3. Bank Cash Deposit
- **Endpoint**: `POST /api/v1/cash/deposit`
- **Authentication**: `Bearer <token>` (Roles: `pro_manager`, `super_admin`)
- **Request Body**:
  ```json
  {
    "deposit_date": "2026-09-03",
    "deposited_amount": 500,
    "deposit_reference": "HDFC-DEP-001"
  }
  ```
- **Validation Rule**: Blocked with HTTP 400 if `deposited_amount > available_cash` (cannot deposit more cash than physically present).
- **Side Effect**: Records entry in `cash_deposits` and updates `deposited_amount` and `closing_balance` in `cash_ledger`.
