"""
Fazgom Togo - End-to-end backend tests.
Covers: auth, OTP, profile, KYC, cash, stock, credits, reports,
missions marketplace, applications, payments (mock), messages,
reviews, premium, earnings.
"""
import os
import io
import base64
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://togo-comptables.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Unique 8-digit phones each run (Togo numbers start with 9)
RUN_TAG = str(int(time.time()))[-6:]
MERCHANT_PHONE = "9" + RUN_TAG + "1"  # 8 digits
ASSISTANT_PHONE = "9" + RUN_TAG + "2"
PASSWORD = "TestPass123!"


@pytest.fixture(scope="module")
def state():
    return {}


# ===== AUTH =====
class TestAuth:
    def test_register_merchant(self, state):
        r = requests.post(f"{API}/auth/register", json={
            "phone": MERCHANT_PHONE,
            "password": PASSWORD,
            "role": "merchant",
            "display_name": "TEST Marchand",
            "shop_name": "TEST Boutique",
            "city": "Lomé",
        }, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["phone"] == "+228" + MERCHANT_PHONE
        assert d["user"]["role"] == "merchant"
        assert d["user"]["kyc_status"] == "not_required"
        state["merchant_token"] = d["token"]
        state["merchant_id"] = d["user"]["id"]

    def test_register_assistant(self, state):
        r = requests.post(f"{API}/auth/register", json={
            "phone": ASSISTANT_PHONE,
            "password": PASSWORD,
            "role": "assistant",
            "display_name": "TEST Assistant",
        }, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["kyc_status"] == "pending"
        state["assistant_token"] = d["token"]
        state["assistant_id"] = d["user"]["id"]

    def test_duplicate_register(self, state):
        r = requests.post(f"{API}/auth/register", json={
            "phone": MERCHANT_PHONE, "password": PASSWORD,
            "role": "merchant", "display_name": "x",
        }, timeout=15)
        assert r.status_code == 400

    def test_login_normalized_phone(self, state):
        # Login using 8-digit form for same merchant
        r = requests.post(f"{API}/auth/login", json={
            "phone": MERCHANT_PHONE, "password": PASSWORD,
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["id"] == state["merchant_id"]
        # also test using full +228 form
        r2 = requests.post(f"{API}/auth/login", json={
            "phone": "+228" + MERCHANT_PHONE, "password": PASSWORD,
        }, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["user"]["id"] == state["merchant_id"]

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={
            "phone": MERCHANT_PHONE, "password": "wrong",
        }, timeout=15)
        assert r.status_code == 401

    def test_otp_send_and_verify(self, state):
        r = requests.post(f"{API}/auth/otp/send", json={"phone": MERCHANT_PHONE}, timeout=15)
        assert r.status_code in (200, 503)
        if r.status_code == 503:
            assert "WhatsApp" in r.json().get("detail", "")
            return
        d = r.json()
        assert d["sent"] is True
        assert "dev_code" not in d
        assert d["channel"] == "whatsapp"

    def test_otp_verify_wrong(self):
        requests.post(f"{API}/auth/otp/send", json={"phone": MERCHANT_PHONE}, timeout=15)
        r = requests.post(f"{API}/auth/otp/verify", json={
            "phone": MERCHANT_PHONE, "code": "000000"
        }, timeout=15)
        # could be 400 (incorrect) - unlikely to randomly match
        assert r.status_code in (400,)

    def test_me(self, state):
        r = requests.get(f"{API}/auth/me", headers=mh(state), timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == state["merchant_id"]

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)


def mh(state):
    return {"Authorization": f"Bearer {state['merchant_token']}"}


def ah(state):
    return {"Authorization": f"Bearer {state['assistant_token']}"}


class TestProfile:
    def test_update_profile(self, state):
        r = requests.put(f"{API}/profile", headers=mh(state), json={
            "bio": "TEST bio update", "city": "Kara"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["bio"] == "TEST bio update"
        assert d["city"] == "Kara"


class TestKYC:
    def test_kyc_merchant_forbidden(self, state):
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        r = requests.post(f"{API}/kyc/upload", headers=mh(state),
                          data={"doc_type": "id_card"},
                          files={"file": ("id.png", png, "image/png")}, timeout=15)
        assert r.status_code == 403

    def test_kyc_assistant_upload(self, state):
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        r = requests.post(f"{API}/kyc/upload", headers=ah(state),
                          data={"doc_type": "id_card"},
                          files={"file": ("id.png", png, "image/png")}, timeout=15)
        assert r.status_code == 200, r.text
        state["kyc_doc_id"] = r.json()["id"]

    def test_kyc_my(self, state):
        r = requests.get(f"{API}/kyc/my", headers=ah(state), timeout=15)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        # ciphertext must NOT be exposed
        for d in docs:
            assert "ciphertext_b64" not in d
            assert "iv_b64" not in d
            assert "tag_b64" not in d
            assert "_id" not in d

    def test_kyc_bad_format(self, state):
        r = requests.post(f"{API}/kyc/upload", headers=ah(state),
                          data={"doc_type": "id_card"},
                          files={"file": ("x.txt", b"hello", "text/plain")}, timeout=15)
        assert r.status_code == 400


class TestCash:
    def test_create_and_list(self, state):
        for k, a in [("in", 5000), ("out", 1500), ("in", 2000)]:
            r = requests.post(f"{API}/cash/entries", headers=mh(state), json={
                "kind": k, "amount": a, "category": "ventes" if k == "in" else "achats",
            }, timeout=15)
            assert r.status_code == 200
        r = requests.get(f"{API}/cash/entries", headers=mh(state), timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_summary(self, state):
        r = requests.get(f"{API}/cash/summary", headers=mh(state), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("today", "week", "month"):
            assert k in d
            assert d[k]["in"] >= 7000
            assert d[k]["out"] >= 1500


class TestStock:
    def test_create_list_adjust_alerts(self, state):
        r = requests.post(f"{API}/stock/items", headers=mh(state), json={
            "name": "TEST Riz", "quantity": 10, "unit": "sac",
            "cost_price": 1000, "sell_price": 1200, "low_stock_threshold": 5,
        }, timeout=15)
        assert r.status_code == 200, r.text
        item_id = r.json()["id"]
        state["stock_id"] = item_id

        r2 = requests.get(f"{API}/stock/items", headers=mh(state), timeout=15)
        assert any(i["id"] == item_id for i in r2.json())

        # reduce to 4 (below threshold)
        r3 = requests.put(f"{API}/stock/items/{item_id}/adjust",
                          headers=mh(state), json={"delta": -6, "reason": "vente"}, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["quantity"] == 4

        # alerts
        r4 = requests.get(f"{API}/stock/alerts", headers=mh(state), timeout=15)
        assert r4.status_code == 200
        assert any(i["id"] == item_id for i in r4.json())


class TestCredits:
    def test_create_and_pay(self, state):
        r = requests.post(f"{API}/credits", headers=mh(state), json={
            "client_name": "TEST Client", "amount": 10000,
        }, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        # partial
        r2 = requests.post(f"{API}/credits/{cid}/payment", headers=mh(state),
                           json={"amount": 4000}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["status"] == "open"
        # close
        r3 = requests.post(f"{API}/credits/{cid}/payment", headers=mh(state),
                           json={"amount": 6000}, timeout=15)
        assert r3.json()["status"] == "paid"


class TestReports:
    def test_flash(self, state):
        r = requests.get(f"{API}/reports/flash", headers=mh(state), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("cash", "stock_value", "credits_due", "daily_series"):
            assert k in d
        assert len(d["daily_series"]) == 14


class TestMissionsFlow:
    def test_create_mission(self, state):
        r = requests.post(f"{API}/missions", headers=mh(state), json={
            "title": "TEST Inventaire boutique",
            "description": "Compter le stock mensuel",
            "type": "inventaire", "budget_fcfa": 10000,
            "duration_hours": 3, "location": "Lomé",
        }, timeout=15)
        assert r.status_code == 200, r.text
        state["mission_id"] = r.json()["id"]
        assert r.json()["status"] == "open"

    def test_assistant_cannot_create(self, state):
        r = requests.post(f"{API}/missions", headers=ah(state), json={
            "title": "x", "description": "x", "budget_fcfa": 1000
        }, timeout=15)
        assert r.status_code == 403

    def test_feed_visible(self, state):
        r = requests.get(f"{API}/missions?scope=feed", headers=ah(state), timeout=15)
        assert r.status_code == 200
        assert any(m["id"] == state["mission_id"] for m in r.json())

    def test_apply_and_duplicate(self, state):
        r = requests.post(f"{API}/missions/{state['mission_id']}/apply",
                          headers=ah(state), json={"cover_message": "Disponible"}, timeout=15)
        assert r.status_code == 200, r.text
        state["application_id"] = r.json()["id"]
        # duplicate
        r2 = requests.post(f"{API}/missions/{state['mission_id']}/apply",
                           headers=ah(state), json={"cover_message": "x"}, timeout=15)
        assert r2.status_code == 400

    def test_merchant_sees_applicants(self, state):
        r = requests.get(f"{API}/missions/{state['mission_id']}/applications",
                         headers=mh(state), timeout=15)
        assert r.status_code == 200
        apps = r.json()
        assert any(a["id"] == state["application_id"] for a in apps)

    def test_assistant_cannot_see_applicants(self, state):
        r = requests.get(f"{API}/missions/{state['mission_id']}/applications",
                         headers=ah(state), timeout=15)
        assert r.status_code == 403

    def test_accept(self, state):
        r = requests.post(
            f"{API}/missions/{state['mission_id']}/accept/{state['application_id']}",
            headers=mh(state), timeout=15)
        assert r.status_code == 200, r.text

        m = requests.get(f"{API}/missions/{state['mission_id']}",
                         headers=mh(state), timeout=15).json()
        assert m["status"] == "assigned"
        assert m["assistant_id"] == state["assistant_id"]

    def test_payment_init_mock(self, state):
        r = requests.post(f"{API}/payments/init", headers=mh(state),
                          json={"mission_id": state["mission_id"], "mode": "t-money"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mock") is True
        assert d["payment"]["escrow_status"] == "funded"
        m = requests.get(f"{API}/missions/{state['mission_id']}",
                         headers=mh(state), timeout=15).json()
        assert m["paid"] is True
        assert m["status"] == "in_progress"

    def test_messages(self, state):
        r1 = requests.post(f"{API}/messages", headers=mh(state), json={
            "mission_id": state["mission_id"], "body": "Bonjour, on commence?"
        }, timeout=15)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/messages", headers=ah(state), json={
            "mission_id": state["mission_id"], "body": "Oui, j'arrive!"
        }, timeout=15)
        assert r2.status_code == 200
        rl = requests.get(f"{API}/messages/{state['mission_id']}",
                          headers=mh(state), timeout=15)
        assert rl.status_code == 200
        assert len(rl.json()) >= 2

    def test_conversations(self, state):
        r = requests.get(f"{API}/conversations", headers=ah(state), timeout=15)
        assert r.status_code == 200
        assert any(c["mission_id"] == state["mission_id"] for c in r.json())

    def test_complete_and_payout(self, state):
        r = requests.post(f"{API}/missions/{state['mission_id']}/complete",
                          headers=mh(state), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["completed"] is True
        po = d["payout"]
        assert po is not None
        # 7% commission on 10000 = 700, net = 9300
        assert po["amount"] == 10000
        assert abs(po["commission"] - 700) < 0.01
        assert abs(po["net"] - 9300) < 0.01

    def test_reviews(self, state):
        r = requests.post(f"{API}/reviews", headers=mh(state), json={
            "mission_id": state["mission_id"], "stars": 5, "comment": "Excellent"
        }, timeout=15)
        assert r.status_code == 200, r.text
        # duplicate
        r2 = requests.post(f"{API}/reviews", headers=mh(state), json={
            "mission_id": state["mission_id"], "stars": 4
        }, timeout=15)
        assert r2.status_code == 400
        # assistant reviews merchant
        r3 = requests.post(f"{API}/reviews", headers=ah(state), json={
            "mission_id": state["mission_id"], "stars": 4, "comment": "Pro"
        }, timeout=15)
        assert r3.status_code == 200

        # rating updated on assistant
        me = requests.get(f"{API}/auth/me", headers=ah(state), timeout=15).json()
        assert me["rating_count"] >= 1
        assert me["rating_avg"] >= 4.0

    def test_earnings(self, state):
        r = requests.get(f"{API}/earnings/me", headers=ah(state), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["missions"] >= 1
        assert d["total"] >= 9300

    def test_premium(self, state):
        r = requests.post(f"{API}/premium/subscribe", headers=ah(state), timeout=15)
        assert r.status_code == 200
        assert r.json()["is_premium"] is True
        # merchant forbidden
        r2 = requests.post(f"{API}/premium/subscribe", headers=mh(state), timeout=15)
        assert r2.status_code == 403


class TestNoObjectIdLeaks:
    def test_no_underscore_id_in_responses(self, state):
        endpoints = [
            f"{API}/auth/me",
            f"{API}/cash/entries",
            f"{API}/cash/summary",
            f"{API}/stock/items",
            f"{API}/credits",
            f"{API}/reports/flash",
            f"{API}/missions?scope=mine",
            f"{API}/conversations",
            f"{API}/kyc/my",
        ]
        for ep in endpoints:
            tok = state["assistant_token"] if "kyc" in ep or "earnings" in ep else state["merchant_token"]
            r = requests.get(ep, headers={"Authorization": f"Bearer {tok}"}, timeout=15)
            assert r.status_code == 200, f"{ep} -> {r.status_code}"
            # Recursively check no top-level "_id" mongo key leaks
            def _walk(o):
                if isinstance(o, dict):
                    assert "_id" not in o, f"ObjectId leaked in {ep}"
                    for v in o.values():
                        _walk(v)
                elif isinstance(o, list):
                    for v in o:
                        _walk(v)
            _walk(r.json())
