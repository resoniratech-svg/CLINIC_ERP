# POSTMAN API GUIDE — HOSPITAL ERP BACKEND (SUPER ADMIN MODULE)

## Seeded Super Admin Credentials

- **Username**: `admin`
- **Password**: `SuperAdmin@123`
- **Role**: `super_admin`
- **Branch ID**: `1`

## Environment Setup
- **Base URL**: `http://localhost:5000/api/v1`
- **Header for Protected Endpoints**: `Authorization: Bearer {{token}}`
- **Header for JSON requests**: `Content-Type: application/json`

---

## 1. Authentication Endpoints

### 1.1 Super Admin Login
- **URL**: `http://localhost:5000/api/v1/auth/login`
- **Method**: `POST`
- **Request Body**:
```json
{
  "username": "admin",
  "password": "SuperAdmin@123"
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

### 1.2 Logout
- **URL**: `http://localhost:5000/api/v1/auth/logout`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Response Example**:
```json
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

### 1.3 Change Password
- **URL**: `http://localhost:5000/api/v1/auth/change-password`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "old_password": "SuperAdmin@123",
  "new_password": "SuperAdminNewPass@123"
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": null,
  "message": "Password changed successfully"
}
```

### 1.4 Forgot Password Request
- **URL**: `http://localhost:5000/api/v1/auth/forgot-password`
- **Method**: `POST`
- **Request Body**:
```json
{
  "username_or_employee_id": "rita_rec"
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": null,
  "message": "Password reset request submitted successfully. Please contact Super Admin for approval."
}
```

---

## 2. Super Admin Dashboard

### 2.1 Aggregated Hospital Overview
- **URL**: `http://localhost:5000/api/v1/dashboard`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer {{token}}`
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "today_overview": {
      "new_patients": 25,
      "new_enquiries": 18,
      "appointments": 48,
      "walk_ins": 30,
      "conversions": 15,
      "followups_due": 22,
      "renewals": 10,
      "acq_patients": 5,
      "due_patients_count": 8,
      "due_patients_amount": 35000
    },
    "revenue_today": {
      "cash": 20000,
      "card": 15000,
      "upi": 25000,
      "razorpay": 10000,
      "bajaj_pay": 5000,
      "grand_total": 75000
    },
    "cash_position": {
      "opening_balance": 19000,
      "cash_revenue": 20000,
      "cash_expenditure": 1000,
      "available_cash": 38000,
      "deposited_amount": 38000,
      "closing_balance": 0
    },
    "monthly_target": {
      "month": 9,
      "year": 2026,
      "overall_target": 500000,
      "overall_achieved": 350000,
      "overall_remaining": 150000,
      "overall_achievement_pct": 70,
      "enquiry_target": 200000,
      "enquiry_achieved": 130000,
      "unit_target": 300000,
      "unit_achieved": 220000
    },
    "alerts": []
  },
  "message": "Dashboard stats retrieved successfully"
}
```

---

## 3. User Management

### 3.1 List Users
- **URL**: `http://localhost:5000/api/v1/users?role=receptionist`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer {{token}}`
- **Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "user_id": 2,
      "employee_id": "REC001",
      "full_name": "Rita Receptionist",
      "mobile_number": "9888877771",
      "username": "rita_rec",
      "role": "receptionist",
      "status": "active"
    }
  ],
  "message": "Users retrieved successfully"
}
```

### 3.2 Create User (e.g. Doctor)
- **URL**: `http://localhost:5000/api/v1/users`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "employee_id": "DOC101",
  "full_name": "Dr. Suresh Kumar",
  "mobile_number": "9876500001",
  "email": "suresh@hospital.com",
  "gender": "male",
  "date_of_joining": "2026-01-15",
  "username": "dr_suresh",
  "password": "DoctorPass@123",
  "department": "Cardiology",
  "designation": "Senior Cardiologist",
  "role": "doctor",
  "doctor_details": {
    "specialization": "Cardiologist",
    "qualification": "MD, DM Cardiology",
    "medical_registration_number": "REG-12345",
    "experience_years": 10,
    "new_consultation_fee": 600,
    "renewal_consultation_fee": 400,
    "followup_consultation_fee": 250
  }
}
```

### 3.3 Deactivate User (Soft Status Update)
- **URL**: `http://localhost:5000/api/v1/users/2/status`
- **Method**: `PATCH`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "status": "inactive"
}
```

---

## 4. Password Reset Queue

### 4.1 Approve Password Reset
- **URL**: `http://localhost:5000/api/v1/password-resets/1/approve`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "request_id": 1,
    "user_id": 2,
    "username": "rita_rec",
    "temporary_password": "K9#mX2!pL8"
  },
  "message": "Password reset approved. Provide this temporary password to the user."
}
```

---

## 5. Doctor Resignation & Transfer

### 5.1 Transfer Doctor Responsibilities
- **URL**: `http://localhost:5000/api/v1/doctors/1/transfer`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "to_doctor_id": 2
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "from_doctor_id": 1,
    "to_doctor_id": 2,
    "appointments_moved": 18,
    "followups_moved": 12,
    "source_doctor_status": "inactive"
  },
  "message": "Doctor responsibilities transferred and doctor deactivated successfully. Historical records preserved."
}
```

---

## 6. Target Management

### 6.1 Set Monthly Target
- **URL**: `http://localhost:5000/api/v1/targets`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
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

---

## 7. Billing & Finance

### 7.1 Create Consultation Bill
- **URL**: `http://localhost:5000/api/v1/billing/bills`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "patient_id": 1,
  "doctor_id": 1,
  "bill_type": "consultation",
  "amount": 500,
  "discount_amount": 0
}
```

### 7.2 Record Payment
- **URL**: `http://localhost:5000/api/v1/billing/payments`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "bill_id": 1,
  "payment_method": "cash",
  "amount": 500
}
```

---

## 8. Cash Management

### 8.1 Retrieve Cash Ledger
- **URL**: `http://localhost:5000/api/v1/cash/ledger`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer {{token}}`

### 8.2 Create Cash Deposit
- **URL**: `http://localhost:5000/api/v1/cash/deposit`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "deposit_date": "2026-09-01",
  "deposited_amount": 10000,
  "deposit_reference": "DEP-BANK-998877"
}
```

---

## 9. Pharmacy Management

### 9.1 Dispense Prescription
- **URL**: `http://localhost:5000/api/v1/pharmacy/dispense`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {{token}}`
- **Request Body**:
```json
{
  "prescription_id": 1
}
```

---

## 10. Audit Logs & Login Logs

### 10.1 List Audit Logs
- **URL**: `http://localhost:5000/api/v1/logs/audit`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer {{token}}`

### 10.2 List Login Logs
- **URL**: `http://localhost:5000/api/v1/logs/login`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer {{token}}`
