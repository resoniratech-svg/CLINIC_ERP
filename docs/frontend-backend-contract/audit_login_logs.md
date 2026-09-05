# API Contract: Audit & Login Logs (Module 19)

## 1. System Audit Logs
- **Endpoint**: `GET /api/v1/logs/audit?module=...&user_id=...&start_date=...&end_date=...&page=1&limit=50`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 105,
        "user_id": 1,
        "username": "admin",
        "full_name": "Super Admin",
        "module": "Hospital Settings",
        "action": "Update Setting",
        "record_id": 1,
        "new_value": { "setting_key": "registration_validity_days", "setting_value": "30" },
        "ip_address": "::1",
        "created_at": "2026-09-03T10:45:00.000Z"
      }
    ]
  }
  ```

---

## 2. Authentication & Login Logs
- **Endpoint**: `GET /api/v1/logs/login?status=...&user_id=...&start_date=...&end_date=...&page=1&limit=50`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 204,
        "user_id": 1,
        "username": "admin",
        "full_name": "Super Admin",
        "employee_id": "EMP-001",
        "status": "SUCCESS",
        "ip_address": "::1",
        "login_time": "2026-09-03T10:30:00.000Z"
      }
    ]
  }
  ```
