import json
from aws_lambda_powertools import Logger
import boto3
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from botocore.exceptions import ClientError

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import (
    BaseMessage,
    messages_from_dict,
    messages_to_dict,
)
from langchain_core.messages.ai import AIMessage, AIMessageChunk
from langchain_core.messages.human import HumanMessage

# Helper function for message conversion
def _message_to_dict(message: BaseMessage) -> dict:
    """Convert a message to a dictionary."""
    return {"type": message.type, "data": {"content": message.content, "additional_kwargs": message.additional_kwargs}}

client = boto3.resource("dynamodb")
logger = Logger()


class DynamoDBChatMessageHistory(BaseChatMessageHistory):
    def __init__(
        self,
        table_name: str,
        session_id: str,
        user_id: str,
    ):
        self.table = client.Table(table_name)
        self.session_id = session_id
        self.user_id = user_id
        self.temporary_messages = []
        self.start_time = None
        self._pending_guardrail_for_human: Optional[dict] = None

    @property
    def messages(self) -> List[BaseMessage]:
        return self.get_messages_from_storage() + self.temporary_messages

    def _get_raw_item(self) -> dict:
        try:
            response = self.table.get_item(
                Key={"SessionId": self.session_id, "UserId": self.user_id}
            )
            return response.get("Item") or {}
        except ClientError as error:
            if error.response["Error"]["Code"] == "ResourceNotFoundException":
                logger.warning("No record found with session id: %s", self.session_id)
            else:
                logger.exception(error)
            return {}

    def get_messages_from_storage(self) -> List[BaseMessage]:
        """Retrieve the messages from DynamoDB"""
        item = self._get_raw_item()
        if item:
            items = item.get("History", [])
            self.start_time = item.get("StartTime")
        else:
            items = []

        return messages_from_dict(items)

    def set_pending_guardrail_for_human(self, payload: dict) -> None:
        """ApplyGuardrail INPUT trace; merged into the next stored HumanMessage."""
        self._pending_guardrail_for_human = json.loads(
            json.dumps(payload), parse_float=Decimal
        )

    def merge_into_last_message_additional_kwargs(self, updates: dict) -> None:
        """Merge keys into additional_kwargs of the last message (e.g. OUTPUT guardrail trace)."""
        updates = json.loads(json.dumps(updates), parse_float=Decimal)
        item = self._get_raw_item()
        messages = messages_to_dict(messages_from_dict(item.get("History", [])))
        if not messages:
            return
        ak = messages[-1]["data"].get("additional_kwargs")
        if not isinstance(ak, dict):
            ak = {}
        merged = {**ak, **updates}
        messages[-1]["data"]["additional_kwargs"] = merged
        new_item = {
            "SessionId": self.session_id,
            "UserId": self.user_id,
            "StartTime": item.get("StartTime") or datetime.now().isoformat(),
            "History": messages,
        }
        try:
            self.table.put_item(Item=new_item)
        except ClientError as err:
            logger.exception(err)

    def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in DynamoDB"""
        item = self._get_raw_item()
        messages = messages_to_dict(messages_from_dict(item.get("History", [])))
        if isinstance(message, HumanMessage) and self._pending_guardrail_for_human is not None:
            ak = dict(message.additional_kwargs or {})
            ak["guardrail"] = self._pending_guardrail_for_human
            message.additional_kwargs = ak
            self._pending_guardrail_for_human = None
        if isinstance(message, AIMessageChunk):
            # When streaming with RunnableWithMessageHistory,
            # it would add a chunk to the history but it expects a text as content.
            ai_message = ""
            for c in message.content:
                if "text" in c:
                    ai_message = ai_message + c.get("text")
            _message = _message_to_dict(AIMessage(ai_message))
        else:
            _message = _message_to_dict(message)
        messages.append(_message)

        new_item = {
            "SessionId": self.session_id,
            "UserId": self.user_id,
            "StartTime": item.get("StartTime") or datetime.now().isoformat(),
            "History": messages,
        }

        try:
            self.table.put_item(Item=new_item)
        except ClientError as err:
            logger.exception(err)

    def add_temporary_message(self, message: HumanMessage) -> None:
        """Add a message without storing it (For example images, documents)"""
        self.temporary_messages.append(message)

    def add_metadata(self, metadata: dict) -> None:
        """Add additional metadata to the last message"""
        item = self._get_raw_item()
        messages = messages_to_dict(messages_from_dict(item.get("History", [])))
        if not messages:
            return

        metadata = json.loads(json.dumps(metadata), parse_float=Decimal)
        messages[-1]["data"]["additional_kwargs"] = metadata

        new_item = {
            "SessionId": self.session_id,
            "UserId": self.user_id,
            "StartTime": (
                datetime.now().isoformat()
                if self.start_time is None
                else self.start_time
            ),
            "History": messages,
        }

        try:
            self.table.put_item(Item=new_item)

        except Exception as err:
            logger.exception(err)

    def replace_last_message(self, content: str) -> None:
        """Replace the last message. For example when it is blocked by guardrails"""
        item = self._get_raw_item()
        messages = messages_to_dict(messages_from_dict(item.get("History", [])))
        if not messages:
            return

        messages[-1]["data"]["content"] = content

        logger.info(
            "updaing",
            content=content,
            date=self.start_time,
            item={
                "SessionId": self.session_id,
                "UserId": self.user_id,
                "StartTime": (
                    datetime.now().isoformat()
                    if self.start_time is None
                    else self.start_time
                ),
                "History": messages,
            },
        )
        new_item = {
            "SessionId": self.session_id,
            "UserId": self.user_id,
            "StartTime": (
                datetime.now().isoformat()
                if self.start_time is None
                else self.start_time
            ),
            "History": messages,
        }
        try:
            self.table.put_item(Item=new_item)

        except Exception as err:
            logger.exception(err)

    def clear(self) -> None:
        """Clear session memory from DynamoDB"""
        try:
            self.table.delete_item(
                Key={"SessionId": self.session_id, "UserId": self.user_id}
            )
        except ClientError as err:
            logger.exception(err)
