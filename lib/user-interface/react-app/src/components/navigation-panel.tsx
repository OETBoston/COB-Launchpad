import {
  SideNavigation,
  SideNavigationProps,
  Button,
} from "@cloudscape-design/components";
import useOnFollow from "../common/hooks/use-on-follow";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { AppContext } from "../common/app-context";
import { useContext, useMemo } from "react";
import { CHATBOT_NAME } from "../common/constants";
import { UserContext } from "../common/user-context";
import { UserRole } from "../common/types";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import { useSessionsContext } from "../common/sessions-context";
import { useApplicationsContext } from "../common/applications-context";

export default function NavigationPanel() {
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const { applications, loadingApplications: loadingApps } = useApplicationsContext();
  const { recentSessions, loadingSessions } = useSessionsContext();

  const handleNewSession = () => {
    const newSessionId = uuidv4();
    navigate(`/chatbot/playground/${newSessionId}`);
  };

  const handleHeaderClick = () => {
    navigate("/");
  };

  const truncateTitle = (title: string, maxLength: number = 30): string => {
    if (title.length <= maxLength) return title;
    const truncated = title.substring(0, maxLength).split(' ').slice(0, -1).join(' ');
    return `${truncated}...`;
  };

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
          ? recentSessions.map(session => {
              // Check if this session has applicationId to use the direct application route
              const sessionData = session as (typeof session & {
                applicationId?: string;
                applicationConfig?: any; // Use any to handle type flexibility
              });
              
              const isApplicationSession = !!sessionData.applicationId;
              const href = isApplicationSession 
                ? `/application/${sessionData.applicationId}/${session.id}`
                : `/chatbot/playground/${session.id}`;
              
              // Use application name if available for application sessions
              const displayName = isApplicationSession && sessionData.applicationConfig?.name
                ? `${sessionData.applicationConfig.name} - ${session.title ? truncateTitle(session.title, 20) : 'Session'}`
                : (session.title ? truncateTitle(session.title) : `Session ${session.id.substring(0, 8)}...`);
              
              return {
                type: "link" as const,
                text: displayName,
                href: href
              };
            })
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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%'
    }}>
      {/* Sticky Header */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid #e1e5e9',
        backgroundColor: 'white',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 2,
        cursor: 'pointer'
      }}
      onClick={handleHeaderClick}>
        <h3 style={{
          margin: 0,
        }}>
          {CHATBOT_NAME}
        </h3>
      </div>
      
      {/* Scrollable Navigation Items */}
      <div style={{ 
        flex: '1', 
        overflow: 'auto',
        minHeight: 0  // Important for flex child to be scrollable
      }}>
        <SideNavigation
          onFollow={onFollow}
          onChange={onChange}
          items={items.map((value, idx) => {
            if (value.type === "section") {
              const collapsed =
                navigationPanelState.collapsedSections?.[idx] === true;
              value.defaultExpanded = !collapsed;
            }

            return value;
          })}
        />
      </div>
      
      {/* Sticky Footer Button */}
      <div style={{ 
        padding: '1rem', 
        borderTop: '1px solid #e1e5e9',
        backgroundColor: 'white',
        flexShrink: 0,
        position: 'sticky',
        bottom: 0,
        zIndex: 2
      }}>
        <Button variant="primary" iconName="add-plus" onClick={handleNewSession} fullWidth>
          New Session
        </Button>
      </div>
    </div>
  );
}
