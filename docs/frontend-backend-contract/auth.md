# API Contract: Authentication (Module 1)

## 1. Login
- **Endpoint**: `POST /api/v1/auth/login`
- **Authentication**: None (Public)
- **Required Role**: Any active user (`super_admin`, `receptionist`, `doctor`, `pro_manager`, `executive`, `pharmacy`)
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "SuperAdmin@123"
  }
  ```
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "user_id": 1,
        "employee_id": "EMP000",
        "full_name": "Super Admin",
        "role": "super_admin",
        "branch_id": 1,
        "must_change_password": false
      }
    },
    "message": "Login successful"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing username or password
  - `401 Unauthorized`: Invalid credentials
  - `403 Forbidden`: Account is inactive or suspended
- **Database Tables Involved**: `users`, `branches`, `login_logs`

---

## 2. Logout
- **Endpoint**: `POST /api/v1/auth/logout`
- **Authentication**: `Bearer <token>`
- **Request Body**: `{}`
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": null,
    "message": "Logged out successfully"
  }
  ```
- **Database Tables Involved**: `login_logs` (records `logout_time` and calculates `session_duration_seconds`)

---

## 3. Change Password
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Authentication**: `Bearer <token>`
- **Request Body**:
  ```json
  {
    "old_password": "CurrentPassword123",
    "new_password": "NewSecurePassword123"
  }
  ```
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": null,
    "message": "Password changed successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Incorrect current password or missing fields
- **Database Tables Involved**: `users` (updates `password_hash`, sets `must_change_password = false`, updates `updated_at`)

---

## 4. Forgot Password / Request Reset
- **Endpoint**: `POST /api/v1/auth/forgot-password` (or `POST /api/v1/password-resets/request`)
- **Authentication**: None (Public)
- **Request Body**:
  ```json
  {
    "username_or_employee_id": "REC001"
  }
  ```
- **Response Structure (200 OK / 201 Created)**:
  ```json
  {
    "success": true,
    "data": null,
    "message": "Password reset request submitted successfully. Please contact Super Admin for approval."
  }
  ```
- **Database Tables Involved**: `users`, `password_reset_requests` (creates pending request for Super Admin authorization)

---

## 5. Super Admin Password Reset Queue
- **Endpoint**: `GET /api/v1/password-resets`
- **Authentication**: `Bearer <token>`
- **Required Role**: `super_admin`
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "user_id": 5,
        "employee_id": "REC001",
        "full_name": "Rita Receptionist",
        "username": "rita_rec",
        "role": "receptionist",
        "status": "pending",
        "requested_at": "2026-09-03T10:00:00Z"
      }
    ]
  }
  ```
