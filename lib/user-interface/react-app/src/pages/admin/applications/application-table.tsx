import {
  Pagination,
  PropertyFilter,
  Table,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useCallback, useContext, useMemo, useState } from "react";
import { TextHelper } from "../../../common/helpers/text-helper";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";

import { ApplicationPageHeader } from "./application-page-header";
import { getApplicationColumnDefinitions } from "./column-definitions";
import { ApplicationColumnFilteringProperties } from "./application-filtering-properties";
import { useApplicationsContext } from "../../../common/applications-context";
import ApplicationDeleteModal from "./application-delete-modal";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { Utils } from "../../../common/utils";
import { Application } from "../../../API";

export default function ApplicationTable() {
  const appContext = useContext(AppContext);
  const { applications, loadingApplications, refreshApplications } =
    useApplicationsContext();
  const [applicationToDelete, setApplicationToDelete] =
    useState<Application | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const onDeleteRequest = useCallback((item: Application) => {
    setApplicationToDelete(item);
    setShowDeleteModal(true);
  }, []);

  const columnDefinitions = useMemo(
    () => getApplicationColumnDefinitions(onDeleteRequest),
    [onDeleteRequest]
  );

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(applications, {
    propertyFiltering: {
      filteringProperties: ApplicationColumnFilteringProperties,
      empty: (
        <TableEmptyState
          resourceName="Application Configuration"
          createHref="/admin/applications/manage"
        />
      ),
      noMatch: (
        <TableNoMatchState
          onClearFilter={() => {
            actions.setPropertyFiltering({ tokens: [], operation: "and" });
          }}
        />
      ),
    },
    pagination: { pageSize: 50 },
    sorting: {
      defaultState: {
        sortingColumn: columnDefinitions[4],
        isDescending: true,
      },
    },
  });

  const onConfirmDelete = async () => {
    if (!appContext || !applicationToDelete?.id) return;

    setShowDeleteModal(false);
    const apiClient = new ApiClient(appContext);
    try {
      await apiClient.applications.deleteApplication(applicationToDelete.id);

      setTimeout(async () => {
        await refreshApplications();
      }, 1500);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    } finally {
      setApplicationToDelete(null);
    }
  };

  const onDiscardDelete = () => {
    setShowDeleteModal(false);
    setApplicationToDelete(null);
  };

  return (
    <>
      <ApplicationDeleteModal
        visible={showDeleteModal && !!applicationToDelete}
        onDiscard={onDiscardDelete}
        onDelete={onConfirmDelete}
        application={applicationToDelete ?? undefined}
      />
      <Table
        {...collectionProps}
        items={items}
        columnDefinitions={columnDefinitions}
        variant="full-page"
        stickyHeader={true}
        resizableColumns={true}
        header={
          <ApplicationPageHeader
            getApplications={refreshApplications}
            counter={
              loadingApplications
                ? undefined
                : TextHelper.getHeaderCounterText(applications, undefined)
            }
          />
        }
        loading={loadingApplications}
        loadingText="Loading Applications"
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={PropertyFilterI18nStrings}
            filteringPlaceholder={"Filter Applicatioins"}
            countText={TextHelper.getTextFilterCounterText(filteredItemsCount)}
            expandToViewport={true}
          />
        }
        pagination={<Pagination {...paginationProps} />}
      />
    </>
  );
}
