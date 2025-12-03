import {
  Box,
  SpaceBetween,
  Table,
  Pagination,
  Button,
  TableProps,
  Header,
  CollectionPreferences,
  Modal,
} from "@cloudscape-design/components";
import { DateTime } from "luxon";
import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import RouterButton from "../wrappers/router-button";
import { Session } from "../../API";
import { useSessionsContext } from "../../common/sessions-context";

export default function Sessions() {
  const appContext = useContext(AppContext);
  const { allSessions, loadingSessions, refreshSessions } = useSessionsContext();
  const [selectedItems, setSelectedItems] = useState<Session[]>([]);
  const [preferences, setPreferences] = useState({ pageSize: 20 });
  const [showModalDelete, setShowModalDelete] = useState(false);
  const [deleteAllSessions, setDeleteAllSessions] = useState(false);

  const { items, collectionProps, paginationProps } = useCollection(allSessions, {
    filtering: {
      empty: (
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No sessions</b>
          </SpaceBetween>
        </Box>
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: "startTime",
        },
        isDescending: true,
      },
    },
    selection: {},
  });

  const deleteSelectedSessions = async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    await Promise.all(
      selectedItems.map((s) => apiClient.sessions.deleteSession(s.id))
    );
    await refreshSessions();
    setShowModalDelete(false);
  };

  const deleteUserSessions = async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    await apiClient.sessions.deleteSessions();
    await refreshSessions();
    setDeleteAllSessions(false);
  };

  return (
    <>
      <Modal
        onDismiss={() => setShowModalDelete(false)}
        visible={showModalDelete}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              {" "}
              <Button variant="link" onClick={() => setShowModalDelete(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={deleteSelectedSessions}>
                Ok
              </Button>
            </SpaceBetween>{" "}
          </Box>
        }
        header={"Delete session" + (selectedItems.length > 1 ? "s" : "")}
      >
        Do you want to delete{" "}
        {selectedItems.length == 1
          ? `session ${selectedItems[0].id}?`
          : `${selectedItems.length} sessions?`}
      </Modal>
      <Modal
        onDismiss={() => setDeleteAllSessions(false)}
        visible={deleteAllSessions}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              {" "}
              <Button
                variant="link"
                onClick={() => setDeleteAllSessions(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                data-locator="confirm-delete-all"
                onClick={deleteUserSessions}
              >
                Ok
              </Button>
            </SpaceBetween>{" "}
          </Box>
        }
        header={"Delete all sessions"}
      >
        {`Do you want to delete ${allSessions.length} sessions?`}
      </Modal>
      <Table
        {...collectionProps}
        variant="full-page"
        items={items}
        onSelectionChange={({ detail }) => {
          console.log(detail);
          setSelectedItems(detail.selectedItems);
        }}
        selectedItems={selectedItems}
        selectionType="multi"
        trackBy="id"
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No sessions</b>
            </SpaceBetween>
          </Box>
        }
        ariaLabels={{
          selectionGroupLabel: "Items selection",
          allItemsSelectionLabel: ({ selectedItems }) =>
            `${selectedItems.length} ${
              selectedItems.length === 1 ? "item" : "items"
            } selected`,
          // @ts-expect-error no-unused-var
          itemSelectionLabel: (e, item) => item.title!,
        }}
        pagination={<Pagination {...paginationProps} />}
        loadingText="Loading history"
        loading={loadingSessions}
        resizableColumns
        stickyHeader={true}
        preferences={
          <CollectionPreferences
            onConfirm={({ detail }) =>
              setPreferences({ pageSize: detail.pageSize ?? 20 })
            }
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10" },
                { value: 20, label: "20" },
                { value: 50, label: "50" },
              ],
            }}
          />
        }
        header={
          <Header
            description="List of past sessions"
            variant="awsui-h1-sticky"
            actions={
              <SpaceBetween direction="horizontal" size="m" alignItems="center">
                <RouterButton
                  iconName="add-plus"
                  href={`/chatbot/playground/${uuidv4()}`}
                  variant="inline-link"
                >
                  New session
                </RouterButton>
                <Button
                  iconAlt="Refresh list"
                  iconName="refresh"
                  variant="inline-link"
                  onClick={() => refreshSessions()}
                >
                  Refresh
                </Button>
                <Button
                  disabled={selectedItems.length == 0}
                  iconAlt="Delete"
                  iconName="remove"
                  variant="inline-link"
                  onClick={() => {
                    if (selectedItems.length > 0) setShowModalDelete(true);
                  }}
                >
                  Delete
                </Button>
                <Button
                  iconAlt="Delete all sessions"
                  data-locator="delete-all"
                  iconName="delete-marker"
                  variant="inline-link"
                  onClick={() => setDeleteAllSessions(true)}
                >
                  Delete all sessions
                </Button>
              </SpaceBetween>
            }
          >
            Session History
          </Header>
        }
        columnDefinitions={
          [
            {
              id: "title",
              header: "Title",
              sortingField: "title",
              width: 800,
              minWidth: 200,
              cell: (e) => {
                // Check if this session has applicationId to use the direct application route
                const sessionData = e as (typeof e & {
                  applicationId?: string;
                  applicationConfig?: any; // Use any to handle type flexibility
                });
                
                const isApplicationSession = !!sessionData.applicationId;
                const href = isApplicationSession 
                  ? `/application/${sessionData.applicationId}/${e.id}`
                  : `/chatbot/playground/${e.id}`;
                
                // Show application indicator and name for application sessions
                const displayTitle = isApplicationSession && sessionData.applicationConfig?.name
                  ? `🔧 ${sessionData.applicationConfig.name} - ${e.title || 'Session'}`
                  : e.title;
                
                return <Link to={href}>{displayTitle}</Link>;
              },
              isRowHeader: true,
            },
            {
              id: "startTime",
              header: "Time",
              sortingField: "startTime",
              cell: (e: Session) =>
                DateTime.fromISO(
                  new Date(e.startTime).toISOString()
                ).toLocaleString(DateTime.DATETIME_SHORT),
              sortingComparator: (a, b) => {
                return (
                  new Date(b.startTime).getTime() -
                  new Date(a.startTime).getTime()
                );
              },
            },
          ] as TableProps.ColumnDefinition<Session>[]
        }
      />
    </>
  );
}
