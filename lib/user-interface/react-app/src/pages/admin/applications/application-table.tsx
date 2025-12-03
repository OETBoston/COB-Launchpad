import {
  Pagination,
  PropertyFilter,
  Table,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { TextHelper } from "../../../common/helpers/text-helper";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";

import { ApplicationPageHeader } from "./application-page-header";
import { ApplicationColumnDefinitions } from "./column-definitions";
import { ApplicationColumnFilteringProperties } from "./application-filtering-properties";
import { useApplicationsContext } from "../../../common/applications-context";

export default function ApplicationTable() {
  const { applications, loadingApplications, refreshApplications } = useApplicationsContext();
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
        sortingColumn: ApplicationColumnDefinitions[4],
        isDescending: true,
      },
    },
    selection: {},
  });

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        columnDefinitions={ApplicationColumnDefinitions}
        selectionType="single"
        variant="full-page"
        stickyHeader={true}
        resizableColumns={true}
        header={
          <ApplicationPageHeader
            selectedApplications={collectionProps.selectedItems ?? []}
            getApplications={refreshApplications}
            counter={
              loadingApplications
                ? undefined
                : TextHelper.getHeaderCounterText(
                    applications,
                    collectionProps.selectedItems
                  )
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
