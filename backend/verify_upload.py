"""Verification script for Milestone 4: Medical Report Upload + PDF Text Extraction.

Uses synthetic/de-identified clinical reports to verify:
1. Synthetic patient creation.
2. Synthetic text-based PDF generation via PyMuPDF.
3. PDF upload via POST /api/patients/{id}/reports/upload.
4. HTTP 201 Created verification.
5. Report database record creation and verification.
6. Physical file storage and security validation.
7. Page count verification.
8. Text extraction success and status.
9. Verification of extracted synthetic content.
10. Rejection of non-PDF uploads (415).
11. Missing patient handling (404).
12. Scanned/empty PDF handling (OCR_REQUIRED).
13. Comprehensive cleanup of database fixtures and storage files.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Tuple

import pymupdf
from sqlalchemy import delete, select

from app.core.database import SessionLocal, init_db
from app.main import app
from app.models.patient import Patient
from app.models.report import Report
from app.services.storage_service import storage_service


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


class ASGIUploadClient:
    """Lightweight in-memory client for testing multipart and standard requests."""

    def __init__(self, asgi_app):
        self.app = asgi_app

    def _build_multipart_payload(
        self,
        fields: Dict[str, str],
        files: Dict[str, Tuple[str, bytes, str]],
    ) -> Tuple[bytes, str]:
        boundary = "----WebKitFormBoundaryMedLensTest7MA4YWxkTrZu0gW"
        body = bytearray()

        for name, value in fields.items():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
            body.extend(f"{value}\r\n".encode("utf-8"))

        for name, (filename, file_bytes, content_type) in files.items():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode("utf-8")
            )
            body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
            body.extend(file_bytes)
            body.extend(b"\r\n")

        body.extend(f"--{boundary}--\r\n".encode("utf-8"))
        header_content_type = f"multipart/form-data; boundary={boundary}"
        return bytes(body), header_content_type

    async def request(
        self,
        method: str,
        path: str,
        body: bytes = b"",
        headers: list[tuple[bytes, bytes]] = None,
    ) -> ASGIResponse:
        headers = headers or []
        headers.append((b"host", b"testserver"))
        headers.append((b"content-length", str(len(body)).encode("ascii")))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method.upper(),
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": headers,
            "client": ("127.0.0.1", 50000),
            "server": ("127.0.0.1", 80),
        }

        sent = False

        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
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

    async def post_json(self, path: str, data: dict) -> ASGIResponse:
        body = json.dumps(data).encode("utf-8")
        headers = [(b"content-type", b"application/json")]
        return await self.request("POST", path, body=body, headers=headers)

    async def post_multipart(
        self,
        path: str,
        fields: Dict[str, str],
        files: Dict[str, Tuple[str, bytes, str]],
    ) -> ASGIResponse:
        body, content_type = self._build_multipart_payload(fields, files)
        headers = [(b"content-type", content_type.encode("ascii"))]
        return await self.request("POST", path, body=body, headers=headers)


def generate_synthetic_text_pdf() -> bytes:
    """Generate a multi-page synthetic clinical laboratory report PDF in memory."""
    doc = pymupdf.open()

    # Page 1: Complete Blood Count
    page1 = doc.new_page()
    page1.insert_text(
        (50, 72),
        "MedLens Clinical Laboratory Report\n"
        "Synthetic De-Identified Patient Panel\n"
        "Date: 2026-09-05\n\n"
        "COMPLETE BLOOD COUNT (CBC):\n"
        "- White Blood Cell (WBC): 6.8 x10^3/uL\n"
        "- Red Blood Cell (RBC): 4.65 x10^6/uL\n"
        "- Hemoglobin: 14.1 g/dL\n"
        "- Hematocrit: 42.0%\n"
        "- Platelets: 245 x10^3/uL\n",
        fontsize=11,
    )

    # Page 2: Comprehensive Metabolic Panel
    page2 = doc.new_page()
    page2.insert_text(
        (50, 72),
        "COMPREHENSIVE METABOLIC PANEL (CMP):\n"
        "- Glucose: 92 mg/dL\n"
        "- Blood Urea Nitrogen (BUN): 14 mg/dL\n"
        "- Creatinine: 0.9 mg/dL\n"
        "- Sodium: 139 mmol/L\n"
        "- Potassium: 4.2 mmol/L\n"
        "- Chloride: 102 mmol/L\n",
        fontsize=11,
    )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def generate_synthetic_scanned_pdf() -> bytes:
    """Generate a blank/scanned-style PDF with no extractable text."""
    doc = pymupdf.open()
    doc.new_page()  # Blank page
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


async def run_verification() -> bool:
    print("=" * 65)
    print("MedLens Report Upload & PDF Text Extraction Verification (M4)")
    print("=" * 65)

    init_db()
    client = ASGIUploadClient(app)

    created_patient_id = None
    created_report_ids = []
    created_storage_keys = []

    try:
        # Step 1: Create a test patient
        print("\n[Step 1] Creating a test patient...")
        patient_payload = {
            "patient_code": "TEST-PT-M4-01",
            "name": "Alex Mercer (Synthetic)",
            "age": 38,
            "sex": "Male",
            "symptoms": "Annual routine physical exam",
        }
        res_pt = await client.post_json("/api/patients", patient_payload)
        assert res_pt.status_code == 201, f"Failed to create patient: {res_pt.text}"
        created_patient_id = res_pt.json()["id"]
        print(f"  ✓ Test patient created (ID: {created_patient_id}).")

        # Step 2: Generate synthetic text-based PDF
        print("\n[Step 2] Generating synthetic multi-page clinical PDF...")
        pdf_bytes = generate_synthetic_text_pdf()
        assert len(pdf_bytes) > 0
        print(f"  ✓ Synthetic PDF generated in-memory ({len(pdf_bytes)} bytes).")

        # Step 3 & 4: Upload PDF via actual endpoint
        print(f"\n[Steps 3 & 4] Uploading PDF to /api/patients/{created_patient_id}/reports/upload...")
        res_upload = await client.post_multipart(
            path=f"/api/patients/{created_patient_id}/reports/upload",
            fields={"report_date": "2026-09-05"},
            files={"file": ("lab_cbc_panel_report.pdf", pdf_bytes, "application/pdf")},
        )
        assert res_upload.status_code == 201, f"Expected 201, got {res_upload.status_code}: {res_upload.text}"
        upload_data = res_upload.json()
        report_id = upload_data["report_id"]
        created_report_ids.append(report_id)
        print(f"  ✓ Upload succeeded with HTTP 201 Created. Report ID: {report_id}")

        # Step 5: Confirm Report record created in DB
        print("\n[Step 5] Confirming Report database record...")
        db = SessionLocal()
        report_row = db.execute(select(Report).where(Report.id == report_id)).scalar_one_or_none()
        assert report_row is not None, "Report row not found in database"
        assert report_row.patient_id == created_patient_id
        assert report_row.file_name == "lab_cbc_panel_report.pdf"
        assert report_row.storage_key is not None
        created_storage_keys.append(report_row.storage_key)
        db.close()
        print(f"  ✓ Database record confirmed (storage_key: {report_row.storage_key}).")

        # Step 6: Confirm PDF was stored securely on disk
        print("\n[Step 6] Confirming physical PDF storage...")
        pdf_path = storage_service.get_file_path(report_row.storage_key)
        assert pdf_path.exists(), f"Stored PDF file does not exist at {pdf_path}"
        assert pdf_path.stat().st_size == len(pdf_bytes), "Stored file size mismatch"
        print(f"  ✓ Physical PDF verified on disk ({pdf_path.stat().st_size} bytes).")

        # Step 7 & 8: Confirm page count and text extraction status
        print("\n[Steps 7 & 8] Confirming page count and extraction status...")
        assert upload_data["page_count"] == 2, f"Expected 2 pages, got {upload_data['page_count']}"
        assert upload_data["extraction_status"] == "TEXT_EXTRACTED"
        assert upload_data["extracted_text_available"] is True
        assert upload_data["processing_status"] == "COMPLETED"
        print("  ✓ Page count confirmed: 2 pages.")
        print("  ✓ Extraction status confirmed: TEXT_EXTRACTED.")
        print("  ✓ Extracted text availability confirmed: True.")

        # Step 9: Confirm extracted JSON on disk contains expected synthetic test content
        print("\n[Step 9] Confirming extracted JSON content and provenance...")
        stem = Path(report_row.storage_key).stem
        json_path = storage_service.get_file_path(f"{stem}_extracted.json")
        assert json_path.exists(), "Extracted JSON file not found on disk"
        with open(json_path, "r", encoding="utf-8") as f:
            extracted_json = json.load(f)

        assert extracted_json["page_count"] == 2
        assert len(extracted_json["pages"]) == 2
        assert "Hemoglobin: 14.1 g/dL" in extracted_json["pages"][0]["text"]
        assert "Glucose: 92 mg/dL" in extracted_json["pages"][1]["text"]
        assert "Potassium: 4.2 mmol/L" in extracted_json["full_text"]
        print("  ✓ Extracted text verified against synthetic test clinical values.")

        # Step 10: Test non-PDF upload rejection
        print("\n[Step 10] Testing non-PDF upload rejection...")
        res_non_pdf = await client.post_multipart(
            path=f"/api/patients/{created_patient_id}/reports/upload",
            fields={},
            files={"file": ("malicious_script.sh", b"echo 'attack'", "text/plain")},
        )
        assert res_non_pdf.status_code == 415, f"Expected 415 for non-PDF, got {res_non_pdf.status_code}"
        print("  ✓ Non-PDF file rejected with HTTP 415 Unsupported Media Type.")

        # Step 11: Test missing patient handling
        print("\n[Step 11] Testing missing patient (404)...")
        res_missing_pt = await client.post_multipart(
            path="/api/patients/999999/reports/upload",
            fields={},
            files={"file": ("sample.pdf", pdf_bytes, "application/pdf")},
        )
        assert res_missing_pt.status_code == 404, f"Expected 404 for nonexistent patient, got {res_missing_pt.status_code}"
        print("  ✓ Missing patient rejected with HTTP 404 Not Found.")

        # Step 12: Test empty/scanned PDF handling (OCR_REQUIRED)
        print("\n[Step 12] Testing blank/scanned PDF (OCR_REQUIRED)...")
        scanned_bytes = generate_synthetic_scanned_pdf()
        res_scanned = await client.post_multipart(
            path=f"/api/patients/{created_patient_id}/reports/upload",
            fields={},
            files={"file": ("scanned_scan_doc.pdf", scanned_bytes, "application/pdf")},
        )
        assert res_scanned.status_code == 201, f"Expected 201 for scanned upload, got {res_scanned.status_code}"
        scanned_data = res_scanned.json()
        scanned_rep_id = scanned_data["report_id"]
        created_report_ids.append(scanned_rep_id)

        assert scanned_data["extraction_status"] == "OCR_REQUIRED"
        assert scanned_data["extracted_text_available"] is False
        assert "OCR" in scanned_data["message"]
        print("  ✓ Scanned/blank PDF properly flagged as OCR_REQUIRED without pretending extraction succeeded.")

        db = SessionLocal()
        scanned_row = db.execute(select(Report).where(Report.id == scanned_rep_id)).scalar_one_or_none()
        assert scanned_row.storage_key is not None
        created_storage_keys.append(scanned_row.storage_key)
        db.close()

    finally:
        # Step 13: Clean up all test database records and generated test files
        print("\n[Step 13] Cleaning up test artifacts and database records...")
        db = SessionLocal()
        try:
            for rep_id in created_report_ids:
                db.execute(delete(Report).where(Report.id == rep_id))
            if created_patient_id:
                db.execute(delete(Patient).where(Patient.id == created_patient_id))
            db.commit()
            print("  ✓ Database records cleaned up.")
        finally:
            db.close()

        for key in created_storage_keys:
            storage_service.delete_report_artifacts(key)
        print("  ✓ Physical storage test files cleaned up.")

    print("\n" + "=" * 65)
    print("All Milestone 4 verification checks passed successfully!")
    print("=" * 65)
    return True


if __name__ == "__main__":
    success = asyncio.run(run_verification())
    if not success:
        sys.exit(1)
