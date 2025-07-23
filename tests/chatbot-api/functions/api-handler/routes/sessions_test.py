from pydantic import ValidationError
import pytest
from genai_core.types import CommonError
from routes.sessions import get_file
from routes.sessions import get_sessions
from routes.sessions import get_session
from routes.sessions import delete_user_sessions
from routes.sessions import delete_session

session = {
    "SessionId": "SessionId",
    "StartTime": "123",
    "History": [
        {
            "type": "type",
            "data": {"content": "content", "additional_kwargs": "additional_kwargs"},
        }
    ],
}


def test_get_file_url(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.presign.generate_user_presigned_get", return_value="url")
    assert get_file("file") == "url"


def test_get_sessions(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.list_sessions_by_user_id", return_value=[session])
    expected = [
        {
            "id": session.get("SessionId"),
            "title": "content",
            "startTime": session.get("StartTime") + "Z",
        }
    ]
    assert get_sessions() == expected


def test_get_sessions_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        get_sessions()


def test_get_session(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.get_session", return_value=session)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    expected = {
        "id": session.get("SessionId"),
        "title": "content",
        "startTime": session.get("StartTime") + "Z",
        "history": [
            {"type": "type", "content": "content", "metadata": '"additional_kwargs"'}
        ],
    }
    assert get_session("id") == expected


def test_get_session_user(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.get_session", return_value=session)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    expected = {
        "id": session.get("SessionId"),
        "title": "content",
        "startTime": session.get("StartTime") + "Z",
        "history": [{"type": "type", "content": "content"}],
    }
    # Regular users now get essential configuration metadata
    result = get_session("id")
    assert result["id"] == expected["id"]
    assert result["title"] == expected["title"]
    assert result["startTime"] == expected["startTime"]
    # Check that metadata is included for configuration restoration
    assert "metadata" in result["history"][0]


def test_get_session_with_configuration_metadata(mocker):
    # Test session with model and workspace configuration
    session_with_config = {
        "SessionId": "SessionId",
        "StartTime": "123",
        "History": [
            {
                "type": "ai",
                "data": {
                    "content": "AI response",
                    "additional_kwargs": {
                        "modelId": "bedrock.claude-3-sonnet",
                        "workspaceId": "workspace-123",
                        "modelKwargs": {"temperature": 0.7, "maxTokens": 1000},
                        "sessionId": "session-123",
                        "userId": "user-123",
                        "documents": [],
                        "prompts": ["test prompt"],
                        "usage": {"total_tokens": 150}
                    },
                },
            }
        ],
    }
    
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.get_session", return_value=session_with_config)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    
    result = get_session("id")
    
    # Verify that essential configuration metadata is included for regular users
    assert "metadata" in result["history"][0]
    metadata = result["history"][0]["metadata"]
    
    # Parse the metadata to verify it contains configuration
    import json
    parsed_metadata = json.loads(metadata)
    
    # Check that essential configuration is included
    assert "modelId" in parsed_metadata
    assert "workspaceId" in parsed_metadata
    assert "modelKwargs" in parsed_metadata
    assert "sessionId" in parsed_metadata
    
    # Check that sensitive information is not included for regular users
    assert "documents" not in parsed_metadata
    assert "prompts" not in parsed_metadata
    assert "usage" not in parsed_metadata


def test_get_session_invalid_input():
    with pytest.raises(ValidationError, match="1 validation error"):
        get_session("")
    with pytest.raises(ValidationError, match="1 validation error"):
        get_session(None)


def test_get_session_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        get_session("id")


def test_get_session_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.get_session", return_value=None)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert get_session("id") == None


def test_delete_user_sessions(mocker):
    service_response = {"id": "id", "deleted": True}
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch(
        "genai_core.sessions.delete_user_sessions", return_value=[service_response]
    )
    assert delete_user_sessions() == [service_response]


def test_delete_user_sessions_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        delete_user_sessions()


def test_delete_session(mocker):
    service_response = {"id": "id", "deleted": True}
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.delete_session", return_value=service_response)
    assert delete_session("id") == service_response


def test_delete_session_invalid_input():
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_session("")
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_session(None)


def test_delete_session_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        delete_session("id")
