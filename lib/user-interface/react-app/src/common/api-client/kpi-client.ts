import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { getKpiMetrics, exportSessionDataPage } from "../../graphql/queries";
import { GetKpiMetricsQuery, ExportSessionDataPageQuery } from "../../API";

export class KpiClient {
  async getKpiMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<GraphQLResult<GraphQLQuery<GetKpiMetricsQuery>>> {
    const input =
      startDate || endDate ? { startDate: startDate ?? null, endDate: endDate ?? null } : null;

    const result = await API.graphql<GraphQLQuery<GetKpiMetricsQuery>>({
      query: getKpiMetrics,
      variables: { input },
    });
    return result;
  }

  async exportSessionDataPage(
    cursor?: string | null,
    limit?: number | null,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<GraphQLResult<GraphQLQuery<ExportSessionDataPageQuery>>> {
    const hasAny =
      cursor != null ||
      limit != null ||
      startDate != null ||
      endDate != null;
    const input = hasAny
      ? {
          cursor: cursor ?? null,
          limit: limit ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        }
      : null;
    const result = await API.graphql<GraphQLQuery<ExportSessionDataPageQuery>>({
      query: exportSessionDataPage,
      variables: { input },
    });
    return result;
  }
}
