"""Admin panel + FedaPay settings + webhook tests for Fazgom Togo backend."""
import os
import time
import hmac
import hashlib
import json
import io

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://togo-comptables.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"

ADMIN_PHONE = "+22890000000"
ADMIN_PASSWORD = "admin1234"

TAG = str(int(time.time()))[-6:]


def _post(path, **kw):
    return requests.post(API + path, timeout=20, **kw)


def _get(path, **kw):
    return requests.get(API + path, timeout=20, **kw)


def _put(path, **kw):
    return requests.put(API + path, timeout=20, **kw)


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = _post("/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def merchant():
    phone = f"9{TAG}11"
    r = _post("/auth/register", json={
        "phone": phone, "password": "TestPass123!", "role": "merchant",
        "display_name": f"TEST Merchant {TAG}", "shop_name": f"TEST Shop {TAG}",
        "email": f"merchant-{TAG}@example.com",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "headers": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def assistant():
    phone = f"9{TAG}22"
    r = _post("/auth/register", json={
        "phone": phone, "password": "TestPass123!", "role": "assistant",
        "display_name": f"TEST Assistant {TAG}",
        "email": f"assistant-{TAG}@example.com",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "headers": {"Authorization": f"Bearer {d['token']}"}}


# ---------- Admin seeding & login ----------
class TestAdminAuth:
    def test_admin_login(self, admin_token):
        assert admin_token

    def test_register_admin_rejected(self):
        r = _post("/auth/register", json={
            "phone": f"9{TAG}99", "password": "Pwd12345", "role": "admin",
            "display_name": "Hacker",
            "email": f"hacker-{TAG}@example.com",
        })
        assert r.status_code == 400, r.text


# ---------- Admin stats ----------
class TestAdminStats:
    def test_stats_requires_admin(self, merchant):
        r = _get("/admin/stats", headers=merchant["headers"])
        assert r.status_code == 403

    def test_stats_shape(self, admin_headers):
        r = _get("/admin/stats", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("users_count", "merchants", "assistants", "premium_assistants",
                  "missions_total", "missions_open", "missions_completed",
                  "kyc_pending_count", "commission_total", "gmv_total", "payments_count"):
            assert k in d, f"missing {k}"
        assert isinstance(d["users_count"], int)


# ---------- Admin users ----------
class TestAdminUsers:
    def test_list_users_role_filter(self, admin_headers, merchant, assistant):
        r = _get("/admin/users?role=merchant", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert all(u["role"] == "merchant" for u in users)
        assert any(u["id"] == merchant["user"]["id"] for u in users)
        assert all("_id" not in u and "password_hash" not in u for u in users)

    def test_list_users_search(self, admin_headers, merchant):
        r = _get(f"/admin/users?q=TEST Merchant {TAG}", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert any(u["id"] == merchant["user"]["id"] for u in users)

    def test_update_user_premium(self, admin_headers, assistant):
        r = _put(f"/admin/users/{assistant['user']['id']}",
                 headers=admin_headers, json={"is_premium": True})
        assert r.status_code == 200, r.text
        assert r.json()["is_premium"] is True

    def test_update_user_kyc_status(self, admin_headers, assistant):
        r = _put(f"/admin/users/{assistant['user']['id']}",
                 headers=admin_headers, json={"kyc_status": "approved"})
        assert r.status_code == 200
        assert r.json()["kyc_status"] == "approved"
        # revert
        _put(f"/admin/users/{assistant['user']['id']}",
             headers=admin_headers, json={"kyc_status": "pending"})

    def test_ban_user_blocks_protected(self, admin_headers, merchant):
        # ban
        r = _put(f"/admin/users/{merchant['user']['id']}",
                 headers=admin_headers, json={"banned": True})
        assert r.status_code == 200 and r.json()["banned"] is True
        # protected endpoint should now return 403
        r2 = _get("/auth/me", headers=merchant["headers"])
        assert r2.status_code == 403
        assert "suspendu" in r2.json().get("detail", "").lower()
        # unban for further tests
        r3 = _put(f"/admin/users/{merchant['user']['id']}",
                  headers=admin_headers, json={"banned": False})
        assert r3.status_code == 200 and r3.json()["banned"] is False
        # verify access restored
        r4 = _get("/auth/me", headers=merchant["headers"])
        assert r4.status_code == 200


# ---------- Admin KYC ----------
class TestAdminKYC:
    @pytest.fixture(scope="class")
    def kyc_doc(self, assistant, admin_headers):
        # Ensure pending status
        _put(f"/admin/users/{assistant['user']['id']}",
             headers=admin_headers, json={"kyc_status": "pending"})
        # Upload a fake PNG
        png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
        r = requests.post(
            API + "/kyc/upload",
            headers=assistant["headers"],
            data={"doc_type": "id_card"},
            files={"file": ("id.png", io.BytesIO(png), "image/png")},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_kyc_pending_no_ciphertext(self, admin_headers, kyc_doc, assistant):
        r = _get("/admin/kyc/pending", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        found = False
        for entry in data:
            if entry["user"]["id"] == assistant["user"]["id"]:
                found = True
                for d in entry["documents"]:
                    for k in ("ciphertext_b64", "iv_b64", "tag_b64", "_id"):
                        assert k not in d, f"leak {k}"
        assert found, "assistant not in pending list"

    def test_kyc_file_admin_download(self, admin_headers, kyc_doc):
        r = _get(f"/admin/kyc/{kyc_doc['id']}/file", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.content.startswith(b"\x89PNG")

    def test_kyc_decision_approve(self, admin_headers, assistant, kyc_doc):
        r = _post(f"/admin/kyc/{assistant['user']['id']}/decision?decision=approve",
                  headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["kyc_status"] == "approved"

    def test_kyc_decision_invalid(self, admin_headers, assistant):
        r = _post(f"/admin/kyc/{assistant['user']['id']}/decision?decision=foo",
                  headers=admin_headers)
        assert r.status_code == 400


# ---------- Admin missions & payments ----------
class TestAdminMissionsPayments:
    def test_missions_list(self, admin_headers):
        r = _get("/admin/missions", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_missions_status_filter(self, admin_headers):
        r = _get("/admin/missions?status_f=open", headers=admin_headers)
        assert r.status_code == 200
        assert all(m["status"] == "open" for m in r.json())

    def test_payments_shape(self, admin_headers):
        r = _get("/admin/payments", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "payments" in d and "payouts" in d
        assert isinstance(d["payments"], list)


# ---------- Settings ----------
class TestAdminSettings:
    def test_settings_default(self, admin_headers):
        r = _get("/admin/settings", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "fedapay" in d and "platform" in d and "webhook_url" in d
        assert d["webhook_url"].endswith("/api/payments/fedapay-webhook")

    def test_set_fedapay_and_masked(self, admin_headers):
        fake_key = "sk_test_FAKEFEDAPAYAPIKEY1234567890"
        secret = "whsec_TESTSECRET"
        r = _put("/admin/settings/fedapay", headers=admin_headers, json={
            "api_key": fake_key,
            "public_key": "pk_test_FAKEPUBLICKEY12345",
            "environment": "sandbox",
            "webhook_secret": secret,
        })
        assert r.status_code == 200, r.text
        # Now GET shows masked + set true
        g = _get("/admin/settings", headers=admin_headers).json()
        assert g["fedapay"]["api_key_set"] is True
        assert g["fedapay"]["webhook_secret_set"] is True
        assert g["fedapay"]["api_key_masked"]  # non-empty
        assert fake_key not in json.dumps(g)  # not leaked

    def test_set_platform(self, admin_headers):
        r = _put("/admin/settings/platform", headers=admin_headers, json={
            "commission_pct": 8.5,
            "public_backend_url": BASE_URL,
            "whatsapp_service_url": "",
        })
        assert r.status_code == 200, r.text
        g = _get("/admin/settings", headers=admin_headers).json()
        assert g["platform"]["commission_pct"] == 8.5
        assert g["webhook_url"].startswith(BASE_URL)


# ---------- Payment init switches mode based on fedapay key ----------
class TestPaymentSwitch:
    @pytest.fixture(scope="class")
    def assigned_mission(self, merchant, assistant):
        m = _post("/missions", headers=merchant["headers"], json={
            "title": f"TEST Mission Switch {TAG}",
            "description": "switch test",
            "type": "caisse",
            "budget_fcfa": 5000,
            "duration_hours": 1,
            "location": "Lomé",
        })
        assert m.status_code == 200, m.text
        mid = m.json()["id"]
        a = _post(f"/missions/{mid}/apply", headers=assistant["headers"], json={"cover_message": "hi"})
        assert a.status_code == 200
        app_id = a.json()["id"]
        acc = _post(f"/missions/{mid}/accept/{app_id}", headers=merchant["headers"])
        assert acc.status_code == 200
        return {"mission_id": mid, "merchant": merchant}

    def test_payment_non_mock_when_key_set(self, assigned_mission):
        # FedaPay key already set in TestAdminSettings
        r = _post("/payments/init", headers=assigned_mission["merchant"]["headers"], json={
            "mission_id": assigned_mission["mission_id"], "mode": "t-money",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("mock") is False
        assert body.get("payment", {}).get("provider") == "fedapay"


# ---------- Webhook ----------
class TestWebhook:
    def _sign(self, body: bytes, secret: str):
        ts = str(int(time.time()))
        sig = hmac.new(secret.encode(), (ts + ".").encode() + body, hashlib.sha256).hexdigest()
        return f"t={ts},s={sig}"

    def test_webhook_invalid_signature(self):
        payload = json.dumps({"name": "transaction.approved", "data": {"object": {"reference": "x"}}}).encode()
        r = requests.post(API + "/payments/fedapay-webhook", data=payload,
                          headers={"x-fedapay-signature": "t=1,s=bad", "Content-Type": "application/json"},
                          timeout=20)
        assert r.status_code == 403, r.text

    def test_webhook_valid_signature(self):
        secret = "whsec_TESTSECRET"  # matches what we set above
        payload = json.dumps({
            "name": "transaction.approved",
            "data": {"object": {"reference": "non-existent-mission", "id": "tx_123"}},
        }).encode()
        sig = self._sign(payload, secret)
        r = requests.post(API + "/payments/fedapay-webhook", data=payload,
                          headers={"x-fedapay-signature": sig, "Content-Type": "application/json"},
                          timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["received"] is True


# ---------- Cleanup ----------
class TestZCleanup:
    """Reset fedapay settings to empty to not impact subsequent runs."""

    def test_reset_fedapay(self, admin_headers):
        r = _put("/admin/settings/fedapay", headers=admin_headers, json={
            "api_key": "", "public_key": "", "webhook_secret": "", "environment": "sandbox",
        })
        assert r.status_code == 200
        g = _get("/admin/settings", headers=admin_headers).json()
        assert g["fedapay"]["api_key_set"] is False
        assert g["fedapay"]["webhook_secret_set"] is False

    def test_admin_not_banned(self, admin_headers):
        r = _get("/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
