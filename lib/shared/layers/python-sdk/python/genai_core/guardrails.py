"""Normalize Bedrock guardrail payloads (Converse trace, ApplyGuardrail, etc.) for session storage."""

from __future__ import annotations

from typing import Any, Dict, Optional


def extract_guardrail_payload_from_bedrock(obj: Any) -> Optional[Dict[str, Any]]:
    """
    Build one JSON-serializable object to store under message additional_kwargs['guardrail'].

    Supports:
    - Converse-style: { "output": {...}, "guardrail": { "action", "assessments", ... } }
    - Top-level trace: { "trace": { "guardrail": ... } }
    - ApplyGuardrail API: { "action", "assessments", "outputs", ... }
    - Nested structures (e.g. LangChain metadata copying AWS response)
    """
    if obj is None:
        return None
    direct = _extract_guardrail_payload_shallow(obj)
    if direct is not None:
        return direct
    if isinstance(obj, dict):
        nested = _deep_find_converse_guardrail(obj, depth=0)
        if nested is not None:
            return nested
    return None


def _extract_guardrail_payload_shallow(obj: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(obj, dict):
        return None
    if "guardrail" in obj:
        out: Dict[str, Any] = {"guardrail": obj["guardrail"]}
        if "output" in obj:
            out["output"] = obj["output"]
        return out
    if "trace" in obj:
        return {"trace": obj["trace"]}
    for key in ("amazon-bedrock-trace",):
        if key in obj:
            inner = _extract_guardrail_payload_shallow(obj[key])
            if inner is not None:
                return inner
            return {key: obj[key]}
    if obj.get("action") is not None and (
        "assessments" in obj or obj.get("outputs") is not None
    ):
        return {"applyGuardrail": obj}
    return None


def _deep_find_converse_guardrail(obj: Any, depth: int) -> Optional[Dict[str, Any]]:
    if depth > 8:
        return None
    if isinstance(obj, dict):
        if "guardrail" in obj and isinstance(obj["guardrail"], (dict, list)):
            out: Dict[str, Any] = {"guardrail": obj["guardrail"]}
            if "output" in obj:
                out["output"] = obj["output"]
            return out
        for v in obj.values():
            found = _deep_find_converse_guardrail(v, depth + 1)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for x in obj:
            found = _deep_find_converse_guardrail(x, depth + 1)
            if found is not None:
                return found
    return None


def should_persist_guardrail_payload(payload: Optional[Dict[str, Any]]) -> bool:
    return bool(payload)
