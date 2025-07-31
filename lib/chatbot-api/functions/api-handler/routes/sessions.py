from pydantic import BaseModel, Field
from common.constant import SAFE_FILE_NAME_REGEX, UserRole
from common.validation import WorkspaceIdValidation
import genai_core.presign
import genai_core.sessions
import genai_core.types
import genai_core.auth
import genai_core.utils.json
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
import json

tracer = Tracer()
router = Router()
logger = Logger()


def map_application_fields(application_item):
    """Map DynamoDB field names (PascalCase) to GraphQL field names (camelCase)"""
    if not application_item:
        return None
    
    return {
        "id": application_item.get("Id"),
        "name": application_item.get("Name"),
        "description": application_item.get("Description"),
        "model": application_item.get("Model"),
        "workspace": application_item.get("Workspace"),
        "systemPrompt": application_item.get("SystemPrompt"),
        "systemPromptRag": application_item.get("SystemPromptRag"),
        "condenseSystemPrompt": application_item.get("CondenseSystemPrompt"),
        "roles": application_item.get("Roles"),
        "allowImageInput": application_item.get("AllowImageInput"),
        "allowDocumentInput": application_item.get("AllowDocumentInput"),
        "allowVideoInput": application_item.get("AllowVideoInput"),
        "outputModalities": application_item.get("OutputModalities"),
        "enableGuardrails": application_item.get("EnableGuardrails"),
        "streaming": application_item.get("Streaming"),
        "maxTokens": application_item.get("MaxTokens"),
        "temperature": application_item.get("Temperature"),
        "topP": application_item.get("TopP"),
        "seed": application_item.get("Seed"),
        "createTime": application_item.get("CreateTime"),
        "updateTime": application_item.get("UpdateTime"),
    }


class FileURequestValidation(BaseModel):
    fileName: str = Field(min_length=1, max_length=500, pattern=SAFE_FILE_NAME_REGEX)


@router.resolver(field_name="getFileURL")
@tracer.capture_method
def get_file(fileName: str):
    FileURequestValidation(**{"fileName": fileName})
    user_id = genai_core.auth.get_user_id(router)
    result = genai_core.presign.generate_user_presigned_get(
        user_id, fileName, expiration=600
    )

    logger.info("Generated pre-signed for " + fileName)
    return result


@router.resolver(field_name="listSessions")
@tracer.capture_method
def get_sessions():
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    sessions = genai_core.sessions.list_sessions_by_user_id(user_id)

    return [
        {
            "id": session.get("SessionId"),
            "title": session.get("History", [{}])[0]
            .get("data", {})
            .get("content", "<no title>"),
            "startTime": f'{session.get("StartTime")}Z',
        }
        for session in sessions
    ]


@router.resolver(field_name="getSession")
@tracer.capture_method
def get_session(id: str):
    WorkspaceIdValidation(**{"workspaceId": id})
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    user_roles = genai_core.auth.get_user_roles(router)
    if user_roles is None:
        raise genai_core.types.CommonError("User does not have any roles")

    showMetadata = False
    if (
        UserRole.ADMIN.value in user_roles
        or UserRole.WORKSPACE_MANAGER.value in user_roles
        or UserRole.CHATBOT_USER.value in user_roles
    ):
        showMetadata = True

    session = genai_core.sessions.get_session(id, user_id)
    if not session:
        return None

    # Check if this session has an associated application
    application_id = None
    application_config = None
    
    # Look for applicationId in session metadata
    session_history = session.get("History", [])
    logger.info(f"Session {id} history length: {len(session_history)}")
    
    for i, item in enumerate(session_history):
        metadata = item.get("data", {}).get("additional_kwargs", {})
        logger.info(f"Session {id} item {i} metadata keys: {list(metadata.keys()) if metadata else 'No metadata'}")
        if metadata and metadata.get("applicationId"):
            application_id = metadata.get("applicationId")
            logger.info(f"Found applicationId in session {id}: {application_id}")
            break
    
    if not application_id:
        logger.info(f"No applicationId found in session {id} metadata")
    
    # If we found an applicationId, fetch the current application configuration
    if application_id:
        try:
            logger.info(f"Fetching application config for {application_id}")
            application_raw = genai_core.applications.get_application(application_id)
            logger.info(f"Successfully fetched application config: {application_raw is not None}")
            if application_raw:
                logger.info(f"Raw application data keys: {list(application_raw.keys()) if application_raw else 'No data'}")
                logger.info(f"Application name: {application_raw.get('Name', 'Unknown')}")
                
                # Map DynamoDB field names to GraphQL field names
                application_config = map_application_fields(application_raw)
                logger.info(f"Mapped application config: {application_config is not None}")
                if application_config:
                    logger.info(f"Mapped application name: {application_config.get('name', 'Unknown')}")
                
                # Ensure all required fields exist, set to None if missing
                # This handles cases where the application data might be incomplete
                if not application_config.get('id') or not application_config.get('name'):
                    logger.warning(f"Application {application_id} has missing required fields (id or name), treating as unavailable")
                    application_config = None
            else:
                logger.warning(f"Application {application_id} not found in database")
                application_config = None
        except Exception as e:
            # If application no longer exists, log but continue
            logger.warning(f"Could not fetch application {application_id} for session {id}: {e}")
            application_config = None

    history = [
        {
            "type": item.get("type"),
            "content": item.get("data", {}).get("content"),
        }
        for item in session.get("History")
    ]

    # Always include metadata for model and workspace configuration
    for item, original_item in zip(history, session.get("History")):
        metadata = original_item.get("data", {}).get("additional_kwargs", {})
        if metadata:
            # For non-admin users, only include essential configuration metadata
            if not showMetadata:
                essential_metadata = {
                    "modelId": metadata.get("modelId"),
                    "workspaceId": metadata.get("workspaceId"),
                    "modelKwargs": metadata.get("modelKwargs"),
                    "sessionId": metadata.get("sessionId"),
                    "applicationId": metadata.get("applicationId"),  # Include applicationId in essential metadata
                }
                # Remove None values
                essential_metadata = {k: v for k, v in essential_metadata.items() if v is not None}
                item["metadata"] = json.dumps(
                    essential_metadata,
                    cls=genai_core.utils.json.CustomEncoder,
                )
            else:
                # For admin users, include full metadata
                item["metadata"] = json.dumps(
                    metadata,
                    cls=genai_core.utils.json.CustomEncoder,
                )

    result = {
        "id": session.get("SessionId"),
        "title": session.get("History", [{}])[0]
        .get("data", {})
        .get("content", "<no title>"),
        "startTime": f'{session.get("StartTime")}Z',
        "history": history,
    }
    
    # Include application configuration if this is an application session
    if application_id:
        result["applicationId"] = application_id
        logger.info(f"Adding applicationId to result: {application_id}")
        if application_config:
            result["applicationConfig"] = application_config
            logger.info(f"Adding applicationConfig to result for app: {application_config.get('name', 'Unknown')}")
        else:
            logger.warning(f"ApplicationId {application_id} found but no config available")
    else:
        logger.info(f"Session {id} is not an application session")
    
    logger.info(f"Final result keys for session {id}: {list(result.keys())}")
    return result


@router.resolver(field_name="deleteUserSessions")
@tracer.capture_method
def delete_user_sessions():
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.sessions.delete_user_sessions(user_id)

    return result


@router.resolver(field_name="deleteSession")
@tracer.capture_method
def delete_session(id: str):
    WorkspaceIdValidation(**{"workspaceId": id})
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.sessions.delete_session(id, user_id)

    return result
