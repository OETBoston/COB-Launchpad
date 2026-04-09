import genai_core.kpi
import genai_core.types
import genai_core.auth
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


@router.resolver(field_name="getKpiMetrics")
@tracer.capture_method
@permissions.approved_roles([permissions.ADMIN_ROLE])
def get_kpi_metrics(input: dict = None):
    start_date = None
    end_date = None
    if input:
        start_date = input.get("startDate")
        end_date = input.get("endDate")

    result = genai_core.kpi.get_kpi_metrics(start_date, end_date)
    return result


@router.resolver(field_name="exportSessionDataPage")
@tracer.capture_method
@permissions.approved_roles([permissions.ADMIN_ROLE])
def export_session_data_page(input: dict = None):
    limit = None
    cursor = None
    start_date = None
    end_date = None
    if input:
        limit = input.get("limit")
        cursor = input.get("cursor")
        start_date = input.get("startDate")
        end_date = input.get("endDate")
    return genai_core.kpi.export_session_data_page(
        limit=limit,
        cursor=cursor,
        start_date=start_date,
        end_date=end_date,
    )
