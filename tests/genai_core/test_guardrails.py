from genai_core.guardrails import (
    extract_guardrail_payload_from_bedrock,
    should_persist_guardrail_payload,
)


def test_extract_converse_style_guardrail():
    raw = {
        "output": {"message": {"role": "assistant"}},
        "guardrail": {
            "action": "NONE",
            "assessments": [
                {"policy": "toxicity", "result": "FLAGGED", "confidence": 0.92}
            ],
        },
    }
    p = extract_guardrail_payload_from_bedrock(raw)
    assert p is not None
    assert p["guardrail"]["action"] == "NONE"
    assert p["guardrail"]["assessments"][0]["result"] == "FLAGGED"


def test_extract_apply_guardrail_shape():
    raw = {
        "action": "NONE",
        "assessments": [{"contentPolicy": {"filters": [{"detected": True}]}}],
    }
    p = extract_guardrail_payload_from_bedrock(raw)
    assert p is not None
    assert "applyGuardrail" in p


def test_extract_nested_trace():
    raw = {"trace": {"guardrail": {"inputAssessment": {"x": 1}}}}
    p = extract_guardrail_payload_from_bedrock(raw)
    assert p is not None
    assert "trace" in p


def test_should_persist_nonempty():
    assert should_persist_guardrail_payload({"guardrail": {}})
    assert not should_persist_guardrail_payload(None)
    assert not should_persist_guardrail_payload({})
