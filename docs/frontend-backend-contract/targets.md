# API Contract: Target Management (Module 8)

## 1. Retrieve Hospital Targets & Progress
- **Endpoint**: `GET /api/v1/targets?month=...&year=...`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "month": 9,
      "year": 2026,
      "overall": {
        "target": 500000.0,
        "achieved": 234500.0,
        "remaining": 265500.0,
        "achievement_pct": 46.9
      },
      "enquiry": {
        "target": 200000.0,
        "achieved": 95000.0,
        "remaining": 105000.0,
        "achievement_pct": 47.5
      },
      "unit": {
        "target": 300000.0,
        "achieved": 139500.0,
        "remaining": 160500.0,
        "achievement_pct": 46.5
      }
    }
  }
  ```

---

## 2. Set Monthly Hospital Target
- **Endpoint**: `POST /api/v1/targets`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "month": 9,
    "year": 2026,
    "overall_target": 500000,
    "enquiry_target": 200000,
    "unit_target": 300000,
    "allow_unallocated": false
  }
  ```
- **Validation**: Strict validation ensures `enquiry_target + unit_target === overall_target` unless `allow_unallocated = true`.

---

## 3. Set Doctor Target Breakdown
- **Endpoint**: `POST /api/v1/targets/doctor-target`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "doctor_id": 1,
    "month": 9,
    "year": 2026,
    "enquiry_target": 50000,
    "unit_target": 100000,
    "referral_target": 10,
    "revenue_target": 150000
  }
  ```

---

## 4. Doctor Performance Report
- **Endpoint**: `GET /api/v1/targets/doctor-performance?month=...&year=...`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "doctor_id": 1,
        "doctor_name": "Dr. John Smith",
        "specialization": "Cardiology & Homeopathy",
        "enquiry_target": 50000.0,
        "unit_target": 100000.0,
        "referral_target": 10,
        "revenue_target": 150000.0,
        "achieved_revenue": 142000.0,
        "achievement_pct": 94.67
      }
    ]
  }
  ```
