"""Automated API verification script for MedLens Patient and Report APIs.

Exercises the actual FastAPI application and database across:
- GET / and GET /health
- GET /docs
- Patient CRUD operations and validation
- Report creation, listing, detail, and status updates
- Proper HTTP status codes (200, 201, 404, 409, 422)
- Clean teardown of test fixtures
"""

import asyncio
import json
import sys
from urllib.parse import urlencode

from sqlalchemy import delete, select

from app.core.database import SessionLocal, init_db
from app.main import app
from app.models.patient import Patient
from app.models.report import Report


class ASGIResponse:
    def __init__(self, status_code: int, headers: list[tuple[bytes, bytes]], body: bytes):
        self.status_code = status_code
        self.headers = {k.decode("latin1").lower(): v.decode("latin1") for k, v in headers}
        self._body = body

    @property
    def text(self) -> str:
        return self._body.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.text)


class ASGIClient:
    """Lightweight in-memory ASGI client to test FastAPI application."""

    def __init__(self, asgi_app):
        self.app = asgi_app

    async def request(
        self,
        method: str,
        path: str,
        params: dict = None,
        json_data: dict = None,
    ) -> ASGIResponse:
        query_bytes = urlencode(params).encode("ascii") if params else b""
        body_bytes = json.dumps(json_data).encode("utf-8") if json_data is not None else b""

        headers = []
        if json_data is not None:
            headers.append((b"content-type", b"application/json"))
        headers.append((b"content-length", str(len(body_bytes)).encode("ascii")))
        headers.append((b"host", b"testserver"))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method.upper(),
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": query_bytes,
            "headers": headers,
            "client": ("127.0.0.1", 50000),
            "server": ("127.0.0.1", 80),
        }

        sent_body = False

        async def receive():
            nonlocal sent_body
            if not sent_body:
                sent_body = True
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        status_code = 500
        response_headers = []
        response_body_parts = []

        async def send(message):
            nonlocal status_code, response_headers
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_headers = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response_body_parts.append(message.get("body", b""))

        await self.app(scope, receive, send)
        return ASGIResponse(status_code, response_headers, b"".join(response_body_parts))

    async def get(self, path: str, params: dict = None) -> ASGIResponse:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, json_data: dict = None) -> ASGIResponse:
        return await self.request("POST", path, json_data=json_data)

    async def put(self, path: str, json_data: dict = None) -> ASGIResponse:
        return await self.request("PUT", path, json_data=json_data)


async def run_verification() -> bool:
    print("=" * 60)
    print("MedLens API Verification — Milestone 3")
    print("=" * 60)

    # 0. Initialize database
    init_db()
    client = ASGIClient(app)

    # 1. Foundation Endpoints: GET /, GET /health, GET /docs
    print("\n[Step 0] Verifying Foundation Endpoints...")
    res_root = await client.get("/")
    assert res_root.status_code == 200, f"Expected 200 for /, got {res_root.status_code}"
    root_data = res_root.json()
    assert root_data["name"] == "MedLens API"
    assert root_data["status"] == "running"
    print("  ✓ GET / returned 200 OK with expected JSON.")

    res_health = await client.get("/health")
    assert res_health.status_code == 200, f"Expected 200 for /health, got {res_health.status_code}"
    health_data = res_health.json()
    assert health_data["status"] == "healthy"
    assert health_data["service"] == "medlens-api"
    print("  ✓ GET /health returned 200 OK with expected JSON.")

    res_docs = await client.get("/docs")
    assert res_docs.status_code == 200, f"Expected 200 for /docs, got {res_docs.status_code}"
    assert "SwaggerUIBundle" in res_docs.text
    print("  ✓ GET /docs returned 200 OK and rendered Swagger UI.")

    created_patient_id = None
    created_report_id = None

    try:
        # Step 1: Create a test patient
        print("\n[Step 1] Creating a test patient (POST /api/patients)...")
        patient_payload = {
            "patient_code": "TEST-PT-901",
            "name": "Sarah Connor",
            "age": 42,
            "sex": "Female",
            "symptoms": "Intermittent fatigue, mild fever",
            "existing_conditions": "Hypertension",
            "allergies": "Penicillin",
            "medications": "Lisinopril 10mg",
        }
        res_create_pt = await client.post("/api/patients", json_data=patient_payload)
        assert res_create_pt.status_code == 201, f"Expected 201, got {res_create_pt.status_code}: {res_create_pt.text}"
        pt_data = res_create_pt.json()
        created_patient_id = pt_data["id"]
        assert pt_data["patient_code"] == "TEST-PT-901"
        assert pt_data["name"] == "Sarah Connor"
        assert pt_data["age"] == 42
        assert pt_data["sex"] == "Female"
        print(f"  ✓ Patient created successfully (ID: {created_patient_id}).")

        # Test duplicate patient_code handling -> 409 Conflict
        res_dup_pt = await client.post("/api/patients", json_data=patient_payload)
        assert res_dup_pt.status_code == 409, f"Expected 409 for duplicate patient, got {res_dup_pt.status_code}"
        print("  ✓ Duplicate patient_code properly returned 409 Conflict.")

        # Test validation error -> 422 Unprocessable Entity
        invalid_payload = {"patient_code": "INV", "name": "", "age": -5, "sex": "Female"}
        res_invalid = await client.post("/api/patients", json_data=invalid_payload)
        assert res_invalid.status_code == 422, f"Expected 422 for invalid patient, got {res_invalid.status_code}"
        print("  ✓ Invalid patient payload properly returned 422 Unprocessable Entity.")

        # Step 2: Retrieve the patient
        print(f"\n[Step 2] Retrieving the patient (GET /api/patients/{created_patient_id})...")
        res_get_pt = await client.get(f"/api/patients/{created_patient_id}")
        assert res_get_pt.status_code == 200, f"Expected 200, got {res_get_pt.status_code}"
        pt_detail = res_get_pt.json()
        assert pt_detail["id"] == created_patient_id
        assert pt_detail["name"] == "Sarah Connor"
        assert "reports" in pt_detail
        print("  ✓ Patient detail retrieved successfully with reports array.")

        # Search patient by name and code
        res_search_code = await client.get("/api/patients", params={"search": "TEST-PT-901"})
        assert res_search_code.status_code == 200
        assert any(p["id"] == created_patient_id for p in res_search_code.json())
        print("  ✓ Search by patient_code succeeded.")

        res_search_name = await client.get("/api/patients", params={"search": "Connor"})
        assert res_search_name.status_code == 200
        assert any(p["id"] == created_patient_id for p in res_search_name.json())
        print("  ✓ Search by patient name succeeded.")

        # 404 on nonexistent patient
        res_pt_404 = await client.get("/api/patients/999999")
        assert res_pt_404.status_code == 404
        print("  ✓ Non-existent patient properly returned 404 Not Found.")

        # Step 3: Update the patient
        print(f"\n[Step 3] Updating the patient (PUT /api/patients/{created_patient_id})...")
        update_payload = {
            "symptoms": "Fatigue resolved, asymptomatic",
            "medications": "Lisinopril 5mg",
        }
        res_update_pt = await client.put(f"/api/patients/{created_patient_id}", json_data=update_payload)
        assert res_update_pt.status_code == 200, f"Expected 200, got {res_update_pt.status_code}"
        updated_pt = res_update_pt.json()
        assert updated_pt["symptoms"] == "Fatigue resolved, asymptomatic"
        assert updated_pt["medications"] == "Lisinopril 5mg"
        assert updated_pt["name"] == "Sarah Connor"  # Unmodified fields stay intact
        print("  ✓ Patient updated successfully.")

        # Step 4: Create a report for that patient
        print(f"\n[Step 4] Creating a report for patient (POST /api/patients/{created_patient_id}/reports)...")
        report_payload = {
            "file_name": "complete_blood_count_panel.pdf",
            "report_date": "2026-09-01",
            "processing_status": "PENDING",
        }
        res_create_rep = await client.post(
            f"/api/patients/{created_patient_id}/reports",
            json_data=report_payload,
        )
        assert res_create_rep.status_code == 201, f"Expected 201, got {res_create_rep.status_code}: {res_create_rep.text}"
        rep_data = res_create_rep.json()
        created_report_id = rep_data["id"]
        assert rep_data["patient_id"] == created_patient_id
        assert rep_data["file_name"] == "complete_blood_count_panel.pdf"
        assert rep_data["report_date"] == "2026-09-01"
        assert rep_data["processing_status"] == "PENDING"
        print(f"  ✓ Report created successfully (ID: {created_report_id}).")

        # 404 when creating report for non-existent patient
        res_rep_pt_404 = await client.post("/api/patients/999999/reports", json_data=report_payload)
        assert res_rep_pt_404.status_code == 404
        print("  ✓ Creating report for non-existent patient properly returned 404 Not Found.")

        # Step 5: Retrieve the patient's reports
        print(f"\n[Step 5] Retrieving patient reports (GET /api/patients/{created_patient_id}/reports)...")
        res_pt_reports = await client.get(f"/api/patients/{created_patient_id}/reports")
        assert res_pt_reports.status_code == 200
        reports_list = res_pt_reports.json()
        assert len(reports_list) >= 1
        assert any(r["id"] == created_report_id for r in reports_list)
        print(f"  ✓ Patient reports retrieved ({len(reports_list)} report(s) found).")

        # Step 6: Retrieve the individual report
        print(f"\n[Step 6] Retrieving individual report (GET /api/reports/{created_report_id})...")
        res_get_rep = await client.get(f"/api/reports/{created_report_id}")
        assert res_get_rep.status_code == 200
        rep_detail = res_get_rep.json()
        assert rep_detail["id"] == created_report_id
        assert rep_detail["file_name"] == "complete_blood_count_panel.pdf"
        print("  ✓ Individual report retrieved successfully.")

        # 404 on non-existent report
        res_rep_404 = await client.get("/api/reports/999999")
        assert res_rep_404.status_code == 404
        print("  ✓ Non-existent report properly returned 404 Not Found.")

        # Step 7: Update the report processing status
        print(f"\n[Step 7] Updating report processing status (PUT /api/reports/{created_report_id}/status)...")
        for next_status in ["PROCESSING", "COMPLETED"]:
            res_status = await client.put(
                f"/api/reports/{created_report_id}/status",
                json_data={"processing_status": next_status},
            )
            assert res_status.status_code == 200, f"Expected 200, got {res_status.status_code}"
            assert res_status.json()["processing_status"] == next_status
            print(f"  ✓ Status updated to '{next_status}'.")

        # Invalid status enum -> 422 Unprocessable Entity
        res_invalid_status = await client.put(
            f"/api/reports/{created_report_id}/status",
            json_data={"processing_status": "INVALID_STATUS"},
        )
        assert res_invalid_status.status_code == 422
        print("  ✓ Invalid status enum properly rejected with 422 Unprocessable Entity.")

        # Step 8: Confirm expected HTTP status codes
        print("\n[Step 8] All expected HTTP status codes confirmed:")
        print("  ✓ 200 OK (GET list, GET item, PUT update)")
        print("  ✓ 201 Created (POST patient, POST report)")
        print("  ✓ 404 Not Found (Invalid patient/report IDs)")
        print("  ✓ 409 Conflict (Duplicate patient_code)")
        print("  ✓ 422 Unprocessable Entity (Schema/enum validation failures)")

    finally:
        # Step 9: Clean up test data
        print("\n[Step 9] Cleaning up test fixtures from database...")
        db = SessionLocal()
        try:
            if created_report_id:
                db.execute(delete(Report).where(Report.id == created_report_id))
            if created_patient_id:
                db.execute(delete(Patient).where(Patient.id == created_patient_id))
            db.commit()

            # Confirm records removed
            remaining_pt = db.execute(
                select(Patient).where(Patient.patient_code == "TEST-PT-901")
            ).scalar_one_or_none()
            assert remaining_pt is None
            print("  ✓ Development database successfully restored to clean state.")
        finally:
            db.close()

    print("\n" + "=" * 60)
    print("All verification steps passed successfully!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(run_verification())
    if not success:
        sys.exit(1)
