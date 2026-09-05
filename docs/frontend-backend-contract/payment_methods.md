# API Contract: Payment Methods (Module 10)

## 1. Supported Payment Gateways & Instruments
- **Allowed Methods**:
  - `cash`: Direct physical cash in hand (automatically tallies and updates `cash_ledger`).
  - `card`: Credit/Debit cards via Point-of-Sale (POS) terminal.
  - `upi`: Real-time Unified Payments Interface (GPay, PhonePe, Paytm QR).
  - `razorpay`: Online payment links and digital payment gateway.
  - `bajaj_pay`: Medical EMI financing and credit options.

---

## 2. Configuration & Validation Matrix
- **Endpoint**: `GET /api/v1/billing/rules`
- **Enforcement Rules**:
  - Payment methods checked against `payment_methods_config.is_active` table before transaction processing.
  - Transactions on deactivated payment modes are blocked with HTTP 400.
  - Unsupported/unrecognized payment methods are rejected with HTTP 400.
