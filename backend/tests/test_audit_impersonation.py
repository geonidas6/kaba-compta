"""
Audit logging, impersonation, dynamic platform config (commission_enabled,
premium_price_fcfa, premium_duration_days), and /admin/users/{id}/full tests.

Adds coverage for iteration-3 features:
- POST /api/admin/users/{id}/impersonate (JWT with imp claim)
- Audit middleware on mutating impersonated calls (POST /api/cash/entries,
  multipart KYC upload)
- Audit middleware MUST NOT log non-impersonated mutations
- Audit middleware MUST NOT log GET requests
- GET /api/admin/audit-logs (enriched with admin_name / actor_name)
- GET /api/admin/users/{id}/full (stats + relations + 404 + RBAC)
- PUT /api/admin/settings/platform new fields + GET /admin/settings exposes them
- GET /api/public/config (commission_pct = 0 when commission_enabled = False)
- Mission complete payout commission flow under both toggles
- POST /api/premium/subscribe uses configured price + duration_days

The TestZCleanup class restores defaults so subsequent test runs are clean.
"""
import os
import io
import time
import pytest
import requests

def _read_frontend_env_url():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or _read_frontend_env_url()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set in frontend/.env"
API = BASE_URL + "/api"

ADMIN_PHONE = "+22890000000"
ADMIN_PASSWORD = "admin1234"
TAG = str(int(time.time()))[-6:]


# ----------------------- helpers -----------------------
def _post(path, **kw):
    return requests.post(API + path, timeout=20, **kw)


def _get(path, **kw):
    return requests.get(API + path, timeout=20, **kw)


def _put(path, **kw):
    return requests.put(API + path, timeout=20, **kw)


# ----------------------- fixtures -----------------------
@pytest.fixture(scope="module")
def admin_headers():
    r = _post("/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def merchant():
    phone = f"9{TAG}31"
    r = _post("/auth/register", json={
        "phone": phone, "password": "TestPass123!", "role": "merchant",
        "display_name": f"TEST Merc {TAG}", "shop_name": f"TEST Shop {TAG}",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"id": d["user"]["id"], "token": d["token"],
            "headers": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def assistant():
    phone = f"9{TAG}41"
    r = _post("/auth/register", json={
        "phone": phone, "password": "TestPass123!", "role": "assistant",
        "display_name": f"TEST Asst {TAG}",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"id": d["user"]["id"], "token": d["token"],
            "headers": {"Authorization": f"Bearer {d['token']}"}}


# ===================== Impersonation =====================
class TestImpersonationToken:
    def test_admin_can_impersonate_merchant(self, admin_headers, merchant):
        r = _post(f"/admin/users/{merchant['id']}/impersonate",
                  headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and isinstance(body["token"], str)
        assert body["user"]["id"] == merchant["id"]
        assert body["impersonator_id"]
        # store token for downstream class-less tests
        pytest.imp_merchant_token = body["token"]
        pytest.imp_merchant_headers = {"Authorization": f"Bearer {body['token']}"}

    def test_admin_can_impersonate_assistant(self, admin_headers, assistant):
        r = _post(f"/admin/users/{assistant['id']}/impersonate",
                  headers=admin_headers)
        assert r.status_code == 200, r.text
        pytest.imp_assistant_headers = {
            "Authorization": f"Bearer {r.json()['token']}"
        }

    def test_cannot_impersonate_admin(self, admin_headers):
        # Look up admin id via /admin/users
        r = _get("/admin/users?role=admin", headers=admin_headers)
        assert r.status_code == 200
        admin_id = next((u["id"] for u in r.json() if u["role"] == "admin"), None)
        assert admin_id
        r2 = _post(f"/admin/users/{admin_id}/impersonate", headers=admin_headers)
        assert r2.status_code == 400

    def test_impersonate_missing_user(self, admin_headers):
        r = _post("/admin/users/nope-does-not-exist/impersonate",
                  headers=admin_headers)
        assert r.status_code == 404

    def test_impersonate_requires_admin(self, merchant):
        r = _post(f"/admin/users/{merchant['id']}/impersonate",
                  headers=merchant["headers"])
        assert r.status_code == 403


# ===================== Audit Middleware =====================
class TestAuditMiddleware:
    def test_impersonated_post_creates_audit_log(self, admin_headers, merchant):
        # POST cash entry as impersonated merchant
        payload = {"kind": "in", "amount": 1234, "category": "ventes",
                   "note": f"TEST audit {TAG}"}
        r = _post("/cash/entries",
                  headers=pytest.imp_merchant_headers, json=payload)
        assert r.status_code == 200, r.text

        # Pull audit logs as admin and find the matching entry
        time.sleep(0.5)  # allow async insert to flush
        r2 = _get("/admin/audit-logs?limit=50", headers=admin_headers)
        assert r2.status_code == 200
        logs = r2.json()
        match = [
            lg for lg in logs
            if lg["method"] == "POST"
            and lg["path"] == "/api/cash/entries"
            and lg["actor_user_id"] == merchant["id"]
        ]
        assert match, f"Expected audit log for impersonated cash entry, got {logs[:3]}"
        lg = match[0]
        assert lg["status_code"] == 200
        assert lg["admin_id"]
        assert f"TEST audit {TAG}" in lg["body_preview"]
        # Enrichment
        assert "admin_name" in lg
        assert "actor_name" in lg
        pytest.audit_log_id = lg["id"]

    def test_non_impersonated_post_NOT_logged(self, admin_headers, merchant):
        # Same merchant, but using their own (non-imp) token
        marker = f"TEST nonimp {TAG}"
        r = _post("/cash/entries", headers=merchant["headers"],
                  json={"kind": "in", "amount": 99, "category": "ventes",
                        "note": marker})
        assert r.status_code == 200
        time.sleep(0.5)
        r2 = _get("/admin/audit-logs?limit=100", headers=admin_headers)
        assert r2.status_code == 200
        logs = r2.json()
        bad = [lg for lg in logs if marker in (lg.get("body_preview") or "")]
        assert not bad, f"Non-impersonated POST should NOT be logged: {bad}"

    def test_impersonated_GET_NOT_logged(self, admin_headers):
        # Snapshot count first
        before = _get("/admin/audit-logs?limit=200",
                      headers=admin_headers).json()
        before_n = len(before)
        # Do several GETs while impersonated
        for _ in range(3):
            r = _get("/cash/entries",
                     headers=pytest.imp_merchant_headers)
            assert r.status_code == 200
        time.sleep(0.5)
        after = _get("/admin/audit-logs?limit=200",
                     headers=admin_headers).json()
        # Filter to GET entries on /api/cash/entries since the snapshot
        get_logs = [lg for lg in after if lg["method"] == "GET"]
        assert not get_logs, f"GET should never be audited, got {get_logs[:3]}"
        # Total count should not have increased (no other mutating calls in between)
        assert len(after) == before_n

    def test_kyc_multipart_upload_body_preview(self, admin_headers, assistant):
        # impersonated assistant uploads a small PNG
        png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)  # minimal junk bytes
        files = {"file": ("test_id.png", io.BytesIO(png), "image/png")}
        data = {"doc_type": "id_card"}
        r = requests.post(
            f"{API}/kyc/upload",
            headers=pytest.imp_assistant_headers,
            files=files, data=data, timeout=20,
        )
        assert r.status_code == 200, f"KYC upload failed: {r.status_code} {r.text}"

        time.sleep(0.5)
        logs = _get("/admin/audit-logs?limit=100",
                    headers=admin_headers).json()
        match = [lg for lg in logs
                 if lg["path"] == "/api/kyc/upload"
                 and lg["actor_user_id"] == assistant["id"]]
        assert match, "Expected audit log for impersonated kyc upload"
        bp = match[0]["body_preview"]
        assert bp.startswith("<file upload "), \
            f"body_preview should mask multipart, got: {bp!r}"
        assert bp.endswith(" bytes>")


# ===================== /admin/audit-logs RBAC =====================
class TestAdminAuditLogsRBAC:
    def test_audit_logs_requires_admin(self, merchant):
        r = _get("/admin/audit-logs", headers=merchant["headers"])
        assert r.status_code == 403


# ===================== /admin/users/{id}/full =====================
class TestAdminUserFull:
    def test_full_for_merchant(self, admin_headers, merchant):
        r = _get(f"/admin/users/{merchant['id']}/full", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        # shape
        for key in ("user", "stats", "missions_as_merchant",
                    "missions_as_assistant", "payments", "payouts",
                    "reviews_received", "reviews_given",
                    "kyc_documents", "audit_logs"):
            assert key in d, f"missing key {key}"
        # password_hash never leaked
        assert "password_hash" not in d["user"]
        # stats shape
        s = d["stats"]
        for k in ("missions_as_merchant", "missions_as_assistant",
                  "total_earned", "total_spent", "cash_entries_count",
                  "stock_items_count", "credits_count", "open_credits_count",
                  "reviews_received_count", "reviews_given_count",
                  "audit_logs_count"):
            assert k in s, f"missing stat {k}"
        # cash entries have been created (>=2 from earlier tests)
        assert s["cash_entries_count"] >= 2

    def test_full_kyc_excludes_ciphertext(self, admin_headers, assistant):
        r = _get(f"/admin/users/{assistant['id']}/full", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for doc in d["kyc_documents"]:
            assert "ciphertext_b64" not in doc
            assert "iv_b64" not in doc
            assert "tag_b64" not in doc

    def test_full_404_for_unknown_user(self, admin_headers):
        r = _get("/admin/users/does-not-exist-xyz/full", headers=admin_headers)
        assert r.status_code == 404

    def test_full_requires_admin(self, merchant):
        r = _get(f"/admin/users/{merchant['id']}/full",
                 headers=merchant["headers"])
        assert r.status_code == 403


# ===================== Platform settings (commission_enabled etc.) =====================
class TestPlatformSettings:
    def test_put_platform_accepts_new_fields(self, admin_headers):
        r = _put("/admin/settings/platform", headers=admin_headers, json={
            "commission_enabled": False,
            "premium_price_fcfa": 3500,
            "premium_duration_days": 45,
            "commission_pct": 12,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["updated"] is True
        assert set(body["fields"]) >= {"commission_enabled",
                                       "premium_price_fcfa",
                                       "premium_duration_days",
                                       "commission_pct"}

    def test_get_settings_exposes_new_fields(self, admin_headers):
        r = _get("/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        p = r.json()["platform"]
        assert p["commission_enabled"] is False
        assert p["premium_price_fcfa"] == 3500
        assert p["premium_duration_days"] == 45
        assert p["commission_pct"] == 12

    def test_public_config_no_auth(self):
        r = _get("/public/config")
        assert r.status_code == 200
        c = r.json()
        assert c["premium_price_fcfa"] == 3500
        assert c["premium_duration_days"] == 45
        assert c["commission_enabled"] is False
        # commission_pct masked to 0 when disabled
        assert c["commission_pct"] == 0

    def test_premium_subscribe_uses_config(self, assistant):
        r = _post("/premium/subscribe", headers=assistant["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_premium"] is True
        assert d["price_fcfa"] == 3500
        assert d["duration_days"] == 45


# ===================== Mission complete commission flow =====================
def _create_paid_mission(merchant, assistant):
    """Create a mission, assistant applies, merchant accepts, mock-pays it."""
    rm = _post("/missions", headers=merchant["headers"], json={
        "title": f"TEST mission {TAG}",
        "description": "desc",
        "city": "Lomé",
        "budget_fcfa": 10000,
        "type": "caisse",
    })
    assert rm.status_code == 200, rm.text
    mid = rm.json()["id"]

    ra = _post(f"/missions/{mid}/apply", headers=assistant["headers"],
               json={"cover_message": "moi"})
    assert ra.status_code == 200, ra.text
    aid = ra.json()["id"]

    racc = _post(f"/missions/{mid}/accept/{aid}", headers=merchant["headers"])
    assert racc.status_code == 200, racc.text

    rp = _post("/payments/init", headers=merchant["headers"],
               json={"mission_id": mid, "mode": "t-money"})
    assert rp.status_code == 200, rp.text
    return mid


class TestMissionCompleteCommission:
    def test_complete_no_commission_when_disabled(self, admin_headers,
                                                  merchant, assistant):
        # Ensure platform = commission_enabled False (set by previous class)
        mid = _create_paid_mission(merchant, assistant)
        r = _post(f"/missions/{mid}/complete", headers=merchant["headers"])
        assert r.status_code == 200, r.text
        po = r.json()["payout"]
        assert po is not None
        assert po["amount"] == 10000
        assert po["commission"] == 0
        assert po["net"] == 10000
        assert po["commission_pct"] == 0

    def test_complete_with_commission_enabled(self, admin_headers, merchant,
                                              assistant):
        # Toggle ON with 10%
        r = _put("/admin/settings/platform", headers=admin_headers, json={
            "commission_enabled": True, "commission_pct": 10,
        })
        assert r.status_code == 200

        mid = _create_paid_mission(merchant, assistant)
        r2 = _post(f"/missions/{mid}/complete", headers=merchant["headers"])
        assert r2.status_code == 200, r2.text
        po = r2.json()["payout"]
        assert po["amount"] == 10000
        assert abs(po["commission"] - 1000) < 0.001
        assert abs(po["net"] - 9000) < 0.001
        assert po["commission_pct"] == 10

    def test_public_config_pct_when_enabled(self):
        r = _get("/public/config")
        assert r.status_code == 200
        c = r.json()
        assert c["commission_enabled"] is True
        assert c["commission_pct"] == 10


# ===================== Cleanup: reset platform defaults =====================
class TestZCleanup:
    def test_reset_platform_defaults(self, admin_headers):
        r = _put("/admin/settings/platform", headers=admin_headers, json={
            "commission_enabled": True,
            "commission_pct": 7,
            "premium_price_fcfa": 2000,
            "premium_duration_days": 30,
        })
        assert r.status_code == 200
        r2 = _get("/admin/settings", headers=admin_headers)
        p = r2.json()["platform"]
        assert p["commission_enabled"] is True
        assert p["commission_pct"] == 7
        assert p["premium_price_fcfa"] == 2000
        assert p["premium_duration_days"] == 30
