import base64
import json
import os
import statistics
from collections import defaultdict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

BOSTON_TZ = ZoneInfo("America/New_York")

AWS_REGION = os.environ["AWS_REGION"]
SESSIONS_TABLE_NAME = os.environ["SESSIONS_TABLE_NAME"]
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(SESSIONS_TABLE_NAME)
idp_client = boto3.client("cognito-idp", region_name=AWS_REGION)
logger = Logger()


def _parse_iso(date_str):
    """Parse an ISO date string into a timezone-aware datetime."""
    if not date_str:
        return None
    date_str = date_str.replace("Z", "+00:00")
    return datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)


def _count_interactions(history):
    """Count interactions (human messages) in a session history."""
    if not history:
        return 0
    return sum(1 for item in history if item.get("type") == "human")


def _is_application_session(history):
    """Check if any history item contains an applicationId in metadata."""
    if not history:
        return False
    for item in history:
        metadata = item.get("data", {}).get("additional_kwargs", {})
        if metadata and metadata.get("applicationId"):
            return True
    return False


def _scan_all_sessions():
    """Full scan of the sessions table, returning all items."""
    items = []
    try:
        last_evaluated_key = None
        while True:
            scan_kwargs = {}
            if last_evaluated_key:
                scan_kwargs["ExclusiveStartKey"] = last_evaluated_key
            response = table.scan(**scan_kwargs)
            items.extend(response.get("Items", []))
            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break
    except ClientError as error:
        logger.exception("Error scanning sessions table", error=error)
    return items


def _median(values):
    """Compute median of a list, returning 0.0 for empty lists."""
    if not values:
        return 0.0
    return float(statistics.median(values))


def _build_heatmap_data(all_sessions):
    """Build hour-by-date heatmap for work hours (9-16) on work days (Mon-Fri) in Boston time."""
    heatmap = defaultdict(lambda: {"sessions": 0, "interactions": 0})

    for session in all_sessions:
        raw_time = session.get("StartTime")
        if not raw_time:
            continue
        session_dt = _parse_iso(str(raw_time))
        if session_dt is None:
            continue

        boston_dt = session_dt.astimezone(BOSTON_TZ)

        if boston_dt.weekday() > 4:
            continue

        hour = boston_dt.hour
        if hour < 9 or hour > 16:
            continue

        date_str = boston_dt.strftime("%Y-%m-%d")
        key = (date_str, hour)
        heatmap[key]["sessions"] += 1

        history = session.get("History", [])
        heatmap[key]["interactions"] += _count_interactions(history)

    return [
        {
            "date": date_str,
            "hour": hour,
            "sessions": counts["sessions"],
            "interactions": counts["interactions"],
        }
        for (date_str, hour), counts in sorted(heatmap.items())
    ]


def get_kpi_metrics(start_date=None, end_date=None):
    all_sessions = _scan_all_sessions()
    logger.info(f"Scanned {len(all_sessions)} total sessions")

    start_dt = _parse_iso(start_date)
    end_dt = _parse_iso(end_date)

    # Track the earliest session per user across ALL sessions (for new-user detection)
    user_earliest_session = {}
    for session in all_sessions:
        user_id = session.get("UserId")
        raw_time = session.get("StartTime")
        if not user_id or not raw_time:
            continue
        session_dt = _parse_iso(str(raw_time))
        if session_dt is None:
            continue
        if user_id not in user_earliest_session or session_dt < user_earliest_session[user_id]:
            user_earliest_session[user_id] = session_dt

    # Filter sessions by date range
    filtered_sessions = []
    for session in all_sessions:
        raw_time = session.get("StartTime")
        if not raw_time:
            continue
        session_dt = _parse_iso(str(raw_time))
        if session_dt is None:
            continue
        if start_dt and session_dt < start_dt:
            continue
        if end_dt and session_dt > end_dt:
            continue
        filtered_sessions.append(session)

    # Aggregate metrics from filtered sessions
    user_session_counts = defaultdict(int)
    user_interaction_counts = defaultdict(int)
    total_interactions = 0
    application_session_count = 0

    for session in filtered_sessions:
        user_id = session.get("UserId")
        if not user_id:
            continue
        history = session.get("History", [])
        interactions = _count_interactions(history)

        user_session_counts[user_id] += 1
        user_interaction_counts[user_id] += interactions
        total_interactions += interactions

        if _is_application_session(history):
            application_session_count += 1

    total_users = len(user_session_counts)
    total_sessions = len(filtered_sessions)
    avg_sessions = float(total_sessions) / total_users if total_users > 0 else 0.0
    avg_interactions = float(total_interactions) / total_users if total_users > 0 else 0.0
    app_pct = (float(application_session_count) / total_sessions * 100.0) if total_sessions > 0 else 0.0

    # New users: users whose first-ever session falls within the date range
    new_users = 0
    for user_id, earliest_dt in user_earliest_session.items():
        in_range = True
        if start_dt and earliest_dt < start_dt:
            in_range = False
        if end_dt and earliest_dt > end_dt:
            in_range = False
        if in_range:
            new_users += 1

    session_counts_list = sorted(user_session_counts.values())
    interaction_counts_list = sorted(user_interaction_counts.values())

    heatmap_data = _build_heatmap_data(all_sessions)
    # AppSync max response ~6 MiB; long histories can produce huge heatmap arrays.
    if len(heatmap_data) > 20000:
        heatmap_data = heatmap_data[-20000:]

    return {
        "totalUsers": total_users,
        "totalSessions": total_sessions,
        "totalInteractions": total_interactions,
        "avgSessionsPerUser": round(avg_sessions, 2),
        "avgInteractionsPerUser": round(avg_interactions, 2),
        "applicationSessionsPercentage": round(app_pct, 2),
        "newUsers": new_users,
        "medianSessionsPerUser": round(_median(session_counts_list), 2),
        "medianInteractionsPerUser": round(_median(interaction_counts_list), 2),
        "heatmapData": heatmap_data,
    }


def _build_user_id_map():
    """Build a map from Cognito sub to Employee ID (username with Boston_ prefix stripped)."""
    user_map = {}
    if not COGNITO_USER_POOL_ID:
        logger.warning("COGNITO_USER_POOL_ID not set, skipping user lookup")
        return user_map
    try:
        paginator = idp_client.get_paginator("list_users")
        for page in paginator.paginate(UserPoolId=COGNITO_USER_POOL_ID):
            for user in page["Users"]:
                username = user.get("Username", "")
                sub = None
                for attr in user.get("Attributes", []):
                    if attr["Name"] == "sub":
                        sub = attr["Value"]
                        break
                if sub:
                    employee_id = username
                    if username.startswith("Boston_"):
                        employee_id = username[len("Boston_"):]
                    user_map[sub] = employee_id
    except ClientError as error:
        logger.exception("Error listing Cognito users", error=error)
    return user_map


class _DecimalEncoder(json.JSONEncoder):
    """Handle DynamoDB Decimal types during JSON serialization."""
    def default(self, obj):
        from decimal import Decimal
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super().default(obj)


def _dynamo_key_json_default(obj):
    from decimal import Decimal
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return str(obj)


def _encode_scan_cursor(last_evaluated_key):
    if not last_evaluated_key:
        return None
    raw = json.dumps(last_evaluated_key, default=_dynamo_key_json_default).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode_scan_cursor(cursor):
    if not cursor:
        return None
    raw = base64.urlsafe_b64decode(cursor.encode())
    return json.loads(raw.decode())


def _encode_export_cursor(sek, idx):
    """Cursor for resumable export scan (sek + index within batch)."""
    payload = {"sek": sek, "idx": idx}
    raw = json.dumps(payload, default=_dynamo_key_json_default).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode_export_cursor(cursor):
    """Returns { sek: DynamoDB ExclusiveStartKey or None, idx: int }."""
    if not cursor:
        return {"sek": None, "idx": 0}
    raw = base64.urlsafe_b64decode(cursor.encode())
    decoded = json.loads(raw.decode())
    if isinstance(decoded, dict) and "idx" in decoded:
        return {"sek": decoded.get("sek"), "idx": int(decoded.get("idx", 0))}
    # Legacy cursor: raw LastEvaluatedKey only
    return {"sek": decoded, "idx": 0}


# Keep each GraphQL response under AppSync ~6 MiB limit (large session histories).
_DEFAULT_EXPORT_PAGE = 10
_MAX_EXPORT_PAGE = 25
_EXPORT_SCAN_LIMIT = 100


def _session_in_export_range(session, start_dt, end_dt):
    """Filter by StartTime using parsed datetimes (matches get_kpi_metrics behavior)."""
    if start_dt is None and end_dt is None:
        return True
    raw_time = session.get("StartTime")
    if not raw_time:
        return False
    session_dt = _parse_iso(str(raw_time))
    if session_dt is None:
        return False
    if start_dt and session_dt < start_dt:
        return False
    if end_dt and session_dt > end_dt:
        return False
    return True


def export_session_data_page(limit=None, cursor=None, start_date=None, end_date=None):
    """One page of session export; use nextCursor until None for full export."""
    page = int(limit) if limit is not None else _DEFAULT_EXPORT_PAGE
    page = min(max(1, page), _MAX_EXPORT_PAGE)

    start_dt = _parse_iso(start_date) if start_date else None
    end_dt = _parse_iso(end_date) if end_date else None

    pos = _decode_export_cursor(cursor)
    batch_start_key = pos["sek"]
    start_index = pos["idx"]
    user_map = _build_user_id_map()

    rows = []
    current_key = batch_start_key

    try:
        while len(rows) < page:
            scan_kwargs = {"Limit": _EXPORT_SCAN_LIMIT}
            if current_key is not None:
                scan_kwargs["ExclusiveStartKey"] = current_key

            response = table.scan(**scan_kwargs)
            full_items = response.get("Items", [])

            sek_for_this_batch = current_key
            last_evaluated = response.get("LastEvaluatedKey")

            for j in range(start_index, len(full_items)):
                session = full_items[j]
                if not _session_in_export_range(session, start_dt, end_dt):
                    continue

                user_id = session.get("UserId", "")
                history = session.get("History", [])

                rows.append({
                    "employeeId": user_map.get(user_id, ""),
                    "userId": user_id,
                    "sessionId": session.get("SessionId", ""),
                    "startTime": str(session.get("StartTime", "")),
                    "interactionCount": _count_interactions(history),
                    "applicationSession": _is_application_session(history),
                    "history": json.dumps(history, cls=_DecimalEncoder),
                })

                if len(rows) >= page:
                    if j + 1 < len(full_items):
                        next_cursor = _encode_export_cursor(sek_for_this_batch, j + 1)
                    elif last_evaluated:
                        next_cursor = _encode_export_cursor(last_evaluated, 0)
                    else:
                        next_cursor = None
                    return {
                        "rowsJson": json.dumps(rows, cls=_DecimalEncoder),
                        "nextCursor": next_cursor,
                    }

            start_index = 0
            current_key = last_evaluated
            if not current_key:
                break
    except ClientError as error:
        logger.exception("Error scanning sessions table for export", error=error)
        return {"rowsJson": "[]", "nextCursor": None}

    return {
        "rowsJson": json.dumps(rows, cls=_DecimalEncoder),
        "nextCursor": None,
    }
