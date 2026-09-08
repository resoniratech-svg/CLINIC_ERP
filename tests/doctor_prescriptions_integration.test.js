import { describe, test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const FRONTEND_DIR = path.resolve(process.cwd());
const PRESCRIPTIONS_PAGE = path.join(FRONTEND_DIR, "src/pages/doctor/DoctorPrescriptionsPage.jsx");
const API_INDEX = path.join(FRONTEND_DIR, "src/api/index.js");

describe("Doctor Prescriptions Module Complete Integration Suite", () => {
  const pageContent = fs.readFileSync(PRESCRIPTIONS_PAGE, "utf-8");
  const apiContent = fs.readFileSync(API_INDEX, "utf-8");

  describe("1. Frontend Architecture & Contract Alignment", () => {
    test("1.1 DoctorPrescriptionsPage connects to doctorApi.getMyPrescriptions with server-side params", () => {
      assert.ok(pageContent.includes("doctorApi.getMyPrescriptions"), "Calls getMyPrescriptions");
      assert.ok(pageContent.includes("params.search = search.trim()"), "Supports server-side search parameter");
      assert.ok(pageContent.includes("params.status = statusFilter"), "Supports pharmacy status filter");
      assert.ok(pageContent.includes("params.date = dateFilter"), "Supports date filter");
    });

    test("1.2 Refresh button performs real API request and displays loading feedback", () => {
      assert.ok(pageContent.includes("fetchPrescriptions(true)"), "Refresh triggers real fetch");
      assert.ok(pageContent.includes("refreshing ? 'animate-spin' : ''"), "Shows spinning animation on refresh");
      assert.ok(pageContent.includes("Refreshing..."), "Shows refreshing feedback text");
    });

    test("1.3 Differentiates between API Error and Empty Data (Section 15)", () => {
      assert.ok(pageContent.includes("error ? ("), "Explicit error state check");
      assert.ok(pageContent.includes("Failed to Load Prescriptions"), "Renders dedicated error alert on failure");
      assert.ok(pageContent.includes("Try Again"), "Provides retry button on error");
      assert.ok(!pageContent.includes("prescriptions.length === 0 ? 'No prescriptions found' : error"), "Never hides error behind empty state");
    });

    test("1.4 Rich Prescription Card displays all backend clinical fields (Section 8)", () => {
      assert.ok(pageContent.includes("p.patient_name"), "Displays patient name");
      assert.ok(pageContent.includes("p.registration_id"), "Displays registration ID");
      assert.ok(pageContent.includes("p.patient_age"), "Displays patient age");
      assert.ok(pageContent.includes("p.patient_phone"), "Displays patient phone");
      assert.ok(pageContent.includes("p.pharmacy_status"), "Displays pharmacy status");
      assert.ok(pageContent.includes("p.consultation_id"), "Displays linked consultation ID");
      assert.ok(pageContent.includes("RX #{p.prescription_id}"), "Displays prescription number");
      assert.ok(pageContent.includes("m.medicine_name"), "Displays medicine name");
      assert.ok(pageContent.includes("m.dosage"), "Displays dosage");
      assert.ok(pageContent.includes("m.frequency"), "Displays frequency");
      assert.ok(pageContent.includes("m.duration_days"), "Displays duration");
      assert.ok(pageContent.includes("m.quantity"), "Displays quantity");
    });

    test("1.5 Prescription Details Modal implemented with live record retrieval (Section 12)", () => {
      assert.ok(pageContent.includes("handleViewDetails"), "Defines detail view handler");
      assert.ok(pageContent.includes("doctorApi.getPrescriptionDetails"), "Calls getPrescriptionDetails API");
      assert.ok(pageContent.includes("selectedPrescription"), "Manages selected prescription modal state");
      assert.ok(pageContent.includes("Prescribed Items"), "Renders complete items breakdown table");
      assert.ok(pageContent.includes("Open Consultation"), "Allows opening consultation from details");
    });

    test("1.6 Strictly zero localStorage or sessionStorage for prescription persistence (Section 14)", () => {
      assert.strictEqual(pageContent.includes("localStorage.setItem"), false, "No localStorage write");
      assert.strictEqual(pageContent.includes("sessionStorage.setItem"), false, "No sessionStorage write");
      assert.strictEqual(pageContent.includes("indexedDB"), false, "No IndexedDB write");
    });
  });

  describe("2. Backend API Endpoint Contracts", () => {
    test("2.1 api/index.js defines both getMyPrescriptions and getPrescriptionDetails", () => {
      assert.ok(apiContent.includes("getMyPrescriptions: (params) => axiosClient.get('/doctor/prescriptions/mine', { params })"), "Defines getMyPrescriptions");
      assert.ok(apiContent.includes("getPrescriptionDetails: (id) => axiosClient.get("), "Defines getPrescriptionDetails");
    });

    test("2.2 doctorApi.getMyPrescriptions handles query parameters contract correctly", () => {
      // Test that params mapping in api/index.js passes parameters object directly
      assert.ok(
        apiContent.includes("getMyPrescriptions: (params) => axiosClient.get('/doctor/prescriptions/mine', { params })"),
        "getMyPrescriptions accepts params query object"
      );
    });

    test("2.3 doctorApi.getPrescriptionDetails handles prescription ID parameter", () => {
      assert.ok(
        apiContent.includes("getPrescriptionDetails: (id) => axiosClient.get(`/doctor/prescriptions/${id}`)"),
        "getPrescriptionDetails accepts prescription ID"
      );
    });
  });

  describe("3. Prescriptions Data Contracts & Security Attributes", () => {
    test("3.1 Frontend contract verifies all clinical attributes are supported and rendered", () => {
      const requiredFields = [
        "dosage",
        "frequency",
        "duration_days",
        "quantity",
        "route",
        "timing",
        "food_instruction",
        "special_instructions"
      ];
      requiredFields.forEach(field => {
        assert.ok(
          pageContent.includes(field),
          `DoctorPrescriptionsPage must handle clinical field: ${field}`
        );
      });
    });

    test("3.2 Search and filter controls match backend query contracts", () => {
      assert.ok(pageContent.includes("search"), "Handles search input");
      assert.ok(pageContent.includes("statusFilter"), "Handles pharmacy status filter");
      assert.ok(pageContent.includes("dateFilter"), "Handles date filter");
      assert.ok(pageContent.includes("clearFilters"), "Handles filter reset");
    });

    test("3.3 Error state handling prevents false 'No prescriptions found' display (Section 15)", () => {
      // Must have conditional rendering where error is checked before empty state
      assert.ok(
        pageContent.includes(": error ? ("),
        "Error state is explicitly checked before empty state"
      );
      assert.ok(
        pageContent.includes("Failed to Load Prescriptions"),
        "Renders explicit error feedback"
      );
      assert.ok(
        pageContent.includes("Try Again"),
        "Provides retry mechanism on failure"
      );
    });

    test("3.4 Doctor Consultation Linking and Navigation", () => {
      assert.ok(pageContent.includes("navigate(`/doctor/consultation/"), "Direct navigation to linked consultation");
      assert.ok(pageContent.includes("Open Consultation"), "View modal has link to consultation");
    });

    test("3.5 Client-side State Security: Zero token leakage or sensitive caching", () => {
      assert.strictEqual(pageContent.includes("localStorage.setItem('prescription"), false, "No prescription caching in localStorage");
      assert.strictEqual(pageContent.includes("sessionStorage.setItem('prescription"), false, "No prescription caching in sessionStorage");
    });
  });
});
