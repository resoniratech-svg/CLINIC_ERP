# API Contract: Master Data Management (Module 17)

## 1. Supported Master Catalogs
All 8 master catalogs are mapped as follows:
- `villages` $\rightarrow$ `master_villages`
- `mandals` $\rightarrow$ `master_mandals`
- `lead-sources` $\rightarrow$ `master_lead_sources`
- `referral-sources` $\rightarrow$ `master_referral_sources`
- `departments` $\rightarrow$ `master_departments`
- `specializations` $\rightarrow$ `master_specializations`
- `charge-types` $\rightarrow$ `master_charge_types`
- `expense-categories` $\rightarrow$ `master_expense_categories`

---

## 2. Retrieve Master Data Catalog
- **Endpoint**: `GET /api/v1/settings/masters/:type`
- **Authentication**: `Bearer <token>`
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      { "id": 1, "name": "Kukatpally" },
      { "id": 2, "name": "Gachibowli" }
    ],
    "message": "Master villages retrieved successfully"
  }
  ```

---

## 3. Add Master Data Item
- **Endpoint**: `POST /api/v1/settings/masters/:type`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "name": "Madhapur"
  }
  ```
