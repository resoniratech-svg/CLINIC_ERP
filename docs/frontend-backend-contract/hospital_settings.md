# API Contract: Hospital Settings (Module 16)

## 1. Retrieve Hospital Settings Key-Value Map
- **Endpoint**: `GET /api/v1/settings/hospital`
- **Authentication**: `Bearer <token>`
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "hospital_name": "WeCare Homeopathy",
      "registration_validity_days": "30",
      "pharmacy_expiry_alert_days": "30",
      "crm_callback_window_hours": "24",
      "currency_symbol": "₹"
    }
  }
  ```

---

## 2. Update Hospital Global Setting
- **Endpoint**: `PUT /api/v1/settings/hospital`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "setting_key": "registration_validity_days",
    "setting_value": "45"
  }
  ```
