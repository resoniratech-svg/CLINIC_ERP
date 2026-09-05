# API Contract: Roles & Permissions (Module 15)

## 1. Retrieve Roles & Permissions Matrix
- **Endpoint**: `GET /api/v1/settings/permissions-matrix`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      { "id": 1, "role": "receptionist", "module": "Appointments", "access_level": "full" },
      { "id": 2, "role": "pro_manager", "module": "Billing", "access_level": "full" }
    ]
  }
  ```

---

## 2. Update Permission Matrix Rule
- **Endpoint**: `POST /api/v1/settings/permissions-matrix`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "role": "receptionist",
    "module": "Appointments",
    "access_level": "full"
  }
  ```
- **Access Levels**: `full`, `read_only`, `none`.
