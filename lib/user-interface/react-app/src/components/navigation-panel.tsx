import {
  SideNavigation,
  SideNavigationProps,
} from "@cloudscape-design/components";
import useOnFollow from "../common/hooks/use-on-follow";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { AppContext } from "../common/app-context";
import { useContext, useState, useEffect, useMemo, useRef } from "react";
import { CHATBOT_NAME } from "../common/constants";
import { UserContext } from "../common/user-context";
import { UserRole } from "../common/types";
import { ApiClient } from "../common/api-client/api-client";
import { Application, Session } from "../API";
import { Utils } from "../common/utils";

export default function NavigationPanel() {
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const [applications, setApplications] = useState<Application[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const initialLoadDone = useRef(false);

  const truncateTitle = (title: string, maxLength: number = 30): string => {
    if (title.length <= maxLength) return title;
    const truncated = title.substring(0, maxLength).split(' ').slice(0, -1).join(' ');
    return `${truncated}...`;
  };

  // Fetch applications when component mounts
  useEffect(() => {
    const fetchApplications = async () => {
      if (!appContext) return;
      
      try {
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.applications.getApplications();
        if (result.data?.listApplications) {
          setApplications(result.data.listApplications);
        }
      } catch (error) {
        console.error("Error fetching applications:", Utils.getErrorMessage(error));
      } finally {
        setLoadingApps(false);
      }
    };

    fetchApplications();
  }, [appContext]);

  // Fetch recent sessions
  useEffect(() => {
    const fetchRecentSessions = async () => {
      if (!appContext) return;
      
      try {
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.sessions.getSessions();
        if (result.data?.listSessions) {
          // Sort by startTime descending and take the 5 most recent
          const sortedSessions = [...result.data.listSessions].sort((a, b) => 
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          ).slice(0, 5);
          
          setRecentSessions(sortedSessions);
        }
      } catch (error) {
        console.error("Error fetching sessions:", Utils.getErrorMessage(error));
      } finally {
        setLoadingSessions(false);
      }
    };

    // Add event listener for chat messages
    const handleChatMessage = () => {
      fetchRecentSessions();
    };

    window.addEventListener('chatMessageSent', handleChatMessage);

    // Only fetch on initial mount
    if (!initialLoadDone.current) {
      fetchRecentSessions();
      initialLoadDone.current = true;
    }

    // Cleanup event listener
    return () => {
      window.removeEventListener('chatMessageSent', handleChatMessage);
    };
  }, [appContext]);

  // Generate navigation items dynamically whenever applications change
  const items = useMemo<SideNavigationProps.Item[]>(() => {
    const items: SideNavigationProps.Item[] = [];
    if (
      userContext.userRoles.includes(UserRole.ADMIN) ||
      userContext.userRoles.includes(UserRole.WORKSPACE_MANAGER) ||
      userContext.userRoles.includes(UserRole.CHATBOT_USER)
    ) {
      const applicationItems = loadingApps 
        ? [{ type: "link" as const, text: "Loading applications...", href: "#" }]
        : applications.length > 0 
          ? applications.map(app => ({
              type: "link" as const,
              text: app.name,
              href: `/application/${app.id}`
            }))
          : [{ type: "link" as const, text: "No applications found", href: "#" }];
      
      const recentSessionItems = loadingSessions
        ? [{ type: "link" as const, text: "Loading sessions...", href: "#" }]
        : recentSessions.length > 0
          ? recentSessions.map(session => ({
              type: "link" as const,
              text: session.title ? truncateTitle(session.title) : `Session ${session.id.substring(0, 8)}...`,
              href: `/chatbot/playground/${session.id}`
            }))
          : [{ type: "link" as const, text: "No recent sessions", href: "#" }];
          
      const adminAndWorkspaceManagerItems: SideNavigationProps.Item[] = [
        {
          type: "link",
          text: "Home",
          href: "/",
        },
        {
          type: "section",
          text: "Recent Sessions",
          items: [
            ...recentSessionItems,
            { 
              type: "link" as const, 
              text: "View all sessions", 
              href: "/chatbot/sessions" 
            }
          ]
        },
        {
          type: "section",
          text: "Applications",
          items: applicationItems
        },
          
        {
          type: "section",
          text: "Chatbot",
          items: [
            { type: "link", text: "Playground", href: "/chatbot/playground" },
            ...(userContext.userRoles.includes(UserRole.ADMIN) || 
               userContext.userRoles.includes(UserRole.WORKSPACE_MANAGER) ? [
              {
                type: "link" as const,
                text: "Multi-chat playground",
                href: "/chatbot/multichat",
              }
            ] : []),
            {
              type: "link",
              text: "Sessions",
              href: "/chatbot/sessions",
            },
            ...(userContext.userRoles.includes(UserRole.ADMIN) || 
               userContext.userRoles.includes(UserRole.WORKSPACE_MANAGER) ? [
              {
                type: "link" as const,
                text: "Models",
                href: "/chatbot/models",
              }
            ] : []),
          ],
        },
      ];
      items.push(...adminAndWorkspaceManagerItems);

      if (
        appContext?.config.rag_enabled &&
        (userContext.userRoles.includes(UserRole.WORKSPACE_MANAGER) ||
        userContext.userRoles.includes(UserRole.ADMIN))
      ) {
        const crossEncodersItems: SideNavigationProps.Item[] = appContext
          ?.config.cross_encoders_enabled
          ? [
              {
                type: "link",
                text: "Cross-encoders",
                href: "/rag/cross-encoders",
              },
            ]
          : [];

        items.push({
          type: "section",
          text: "Retrieval-Augmented Generation (RAG)",
          items: [
            { type: "link", text: "Dashboard", href: "/rag" },
            {
              type: "link",
              text: "Semantic search",
              href: "/rag/semantic-search",
            },
            { type: "link", text: "Workspaces", href: "/rag/workspaces" },
            {
              type: "link",
              text: "Embeddings",
              href: "/rag/embeddings",
            },
            ...crossEncodersItems,
            { type: "link", text: "Engines", href: "/rag/engines" },
          ],
        });
      }
    }

    if (userContext.userRoles.includes(UserRole.ADMIN)) {
      items.push({
        type: "section",
        text: "Admin",
        items: [
          {
            type: "link",
            text: "Applications",
            href: "/admin/applications",
          },
        ],
      });
    }

    return items;
  }, [applications, recentSessions, loadingApps, loadingSessions, userContext.userRoles, appContext?.config]);

  const onChange = ({
    detail,
  }: {
    detail: SideNavigationProps.ChangeDetail;
  }) => {
    const sectionIndex = items.indexOf(detail.item);
    setNavigationPanelState({
      collapsedSections: {
        ...navigationPanelState.collapsedSections,
        [sectionIndex]: !detail.expanded,
      },
    });
  };

  return (
    <SideNavigation
      onFollow={onFollow}
      onChange={onChange}
      header={{ href: "/", text: CHATBOT_NAME }}
      items={items.map((value, idx) => {
        if (value.type === "section") {
          const collapsed =
            navigationPanelState.collapsedSections?.[idx] === true;
          value.defaultExpanded = !collapsed;
        }

        return value;
      })}
    />
  );
}
