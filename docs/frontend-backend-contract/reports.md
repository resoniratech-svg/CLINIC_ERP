# API Contract: Hospital Reports (Module 14)

## 1. Executive & Clinical Reports Suite
All report endpoints require `super_admin` authentication:
- `GET /api/v1/reports/patients`: Patient intake, visits, renewals, and outstanding dues.
- `GET /api/v1/reports/revenue`: Multichannel cash and digital collections breakdown.
- `GET /api/v1/reports/target`: Monthly target realization and achievement percentages.
- `GET /api/v1/reports/executive`: Call center lead conversions and incentive compensation.
- `GET /api/v1/reports/pharmacy`: Medicine catalog size, stock quantities, low stock, and expiring batches.
- `GET /api/v1/reports/crm`: Follow-up resolution rates, active ACQ care plans, and OC/NR churn stats.
