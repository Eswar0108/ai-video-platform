import pytest
import httpx

@pytest.mark.asyncio
async def test_register_and_login_flow(client: httpx.AsyncClient):
    # 1. Register new user
    register_payload = {
        "email": "newuser@example.com",
        "password": "securepassword123",
        "full_name": "New Video Contributor",
        "role": "worker"
    }
    reg_resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New Video Contributor"
    assert data["role"] == "worker"
    assert "id" in data

    # 2. Duplicate registration should fail
    dup_resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"]

    # 3. Login with correct password
    login_payload = {
        "email": "newuser@example.com",
        "password": "securepassword123"
    }
    login_resp = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    access_token = token_data["access_token"]

    # 4. Login with incorrect password
    bad_login = await client.post("/api/v1/auth/login", json={"email": "newuser@example.com", "password": "wrong"})
    assert bad_login.status_code == 401

    # 5. Get current user profile
    headers = {"Authorization": f"Bearer {access_token}"}
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "newuser@example.com"
    assert me_data["role"] == "worker"

@pytest.mark.asyncio
async def test_auth_me_unauthorized(client: httpx.AsyncClient):
    # Missing token
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401

    # Invalid token
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert resp.status_code == 401
