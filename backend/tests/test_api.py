import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Bangladesh AI Legal Assistant API", "status": "healthy"}

def test_list_documents():
    response = client.get("/api/documents")
    assert response.status_code == 200
    assert "documents" in response.json()
