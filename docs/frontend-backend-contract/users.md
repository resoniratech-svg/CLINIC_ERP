# API Contract: User Management (Module 3)

## 1. List Users
- **Endpoint**: `GET /api/v1/users`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Query Parameters**:
  - `role` (optional): Filter by role (`receptionist`, `doctor`, `pro_manager`, `executive`, `pharmacy`, `super_admin`)
  - `status` (optional): Filter by status (`active`, `inactive`, `suspended`)
  - `search` (optional): Search across `full_name`, `username`, `employee_id`, `mobile_number`
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "user_id": 10,
        "employee_id": "REC001",
        "full_name": "Rita Receptionist",
        "mobile_number": "9876543210",
        "email": "rita@wecare.com",
        "gender": "female",
        "username": "rita_rec",
        "department": "Front Desk",
        "designation": "Receptionist",
        "role": "receptionist",
        "status": "active",
        "last_login_at": "2026-09-03T09:30:00Z",
        "created_at": "2026-09-01T00:00:00Z"
      }
    ],
    "message": "Users retrieved successfully"
  }
  ```

---

## 2. Get User Details by ID
- **Endpoint**: `GET /api/v1/users/:id`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Response Structure (200 OK)**: Includes full user record + role-specific details:
  - Receptionist: `permissions` (`registration`, `enquiry`, `appointment`, `checkin`, `consultation_fee_billing`, `payment_collection`, `crm_calling`, `followup`, `renewal`, `due_management`)
  - Doctor: `doctor_details` (`doctor_code`, `qualification`, `specialization`, `medical_registration_number`, `experience_years`, `working_days`, `start_time`, `end_time`, `slot_duration_minutes`, `new_consultation_fee`, `renewal_consultation_fee`, `followup_consultation_fee`)
  - PRO / Manager: `permissions` (`counselling`, `billing`, `payment`, `due_collection`, `crm`, `followup`, `renewals`, `complaints`, `feedback`, `reports`, `accountant`)
  - Executive: `executive_details` (`per_lead_incentive`, `incentive_type`, `incentive_amount`, `incentive_trigger`, `effective_date`)
  - Pharmacy: `permissions` (`prescription_queue`, `dispensing`, `inventory`, `stock`, `batch`, `expiry`, `returns`, `stock_adjustment`, `stock_transactions`)

---

## 3. Create User
- **Endpoint**: `POST /api/v1/users`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Request Body**:
  ```json
  {
    "employee_id": "REC001",
    "full_name": "Rita Receptionist",
    "mobile_number": "9876543210",
    "email": "rita@wecare.com",
    "gender": "female",
    "date_of_joining": "2026-01-01",
    "username": "rita_rec",
    "password": "Password@123",
    "department": "Front Desk",
    "designation": "Receptionist",
    "role": "receptionist",
    "status": "active",
    "permissions": { ... }
  }
  ```
- **Response Structure (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "user_id": 15,
      "employee_id": "REC001",
      "full_name": "Rita Receptionist",
      "username": "rita_rec",
      "role": "receptionist",
      "status": "active"
    },
    "message": "User created successfully"
  }
  ```

---

## 4. Update User Profile
- **Endpoint**: `PUT /api/v1/users/:id`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Request Body**: `{ full_name, mobile_number, email, gender, department, designation, status }`

---

## 5. Update User Status
- **Endpoint**: `PATCH /api/v1/users/:id/status`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Request Body**:
  ```json
  {
    "status": "inactive"
  }
  ```
  *(Valid status values: `active`, `inactive`, `suspended`)*
- **Cascades**: Automatically synchronizes status across `doctors` and `executives` tables.
