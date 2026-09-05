# API Contract: Pharmacy & Inventory (Module 13)

## 1. Pharmacy Dashboard & Operational Queues
- **Endpoints**:
  - `GET /api/v1/pharmacy/dashboard`
  - `GET /api/v1/pharmacy/queue` (Prescriptions ready for dispensing)
  - `GET /api/v1/pharmacy/prescriptions/:id/process`

---

## 2. Medicine Master & Inventory Control
- **Endpoints**:
  - `GET /api/v1/pharmacy/medicines?search=...`
  - `POST /api/v1/pharmacy/medicines`
  - `PUT /api/v1/pharmacy/medicines/:id`
- **Request Body (`POST /api/v1/pharmacy/medicines`)**:
  ```json
  {
    "medicine_name": "Arnica Montana",
    "generic_name": "Arnica",
    "medicine_type": "Dilution",
    "strength": "200CH",
    "unit": "bottles",
    "category": "Constitutional",
    "manufacturer": "SBL Homeopathy",
    "reorder_level": 15
  }
  ```

---

## 3. Stock Management & FEFO Batch Tracking
- **Endpoints**:
  - `GET /api/v1/pharmacy/stock`
  - `POST /api/v1/pharmacy/stock`
  - `GET /api/v1/pharmacy/stock/low-stock`
  - `GET /api/v1/pharmacy/stock/expiring`
- **Request Body (`POST /api/v1/pharmacy/stock`)**:
  ```json
  {
    "medicine_id": 1,
    "batch_number": "BATCH-101",
    "manufacture_date": "2026-01-01",
    "expiry_date": "2028-12-31",
    "quantity": 100,
    "purchase_rate": 85.0,
    "mrp": 140.0,
    "supplier": "National Homeo Distributors",
    "invoice_number": "INV-001"
  }
  ```

---

## 4. Dispensing & Prohibited Clinical Action Blockers
- **Dispensing Endpoint**: `POST /api/v1/pharmacy/prescriptions/:id/dispense/complete`
- **Prohibited Action Protections**:
  - Pharmacist calling `POST /api/v1/pharmacy/prescriptions/items/:id/modify-medicine` is blocked with HTTP 403.
  - Pharmacist calling `POST /api/v1/pharmacy/patients/register` or `POST /api/v1/pharmacy/billing` is blocked with HTTP 403.
