import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";
import { Link, useParams } from "react-router-dom";
import { Container, Header, HelpPanel } from "@cloudscape-design/components";
import { useState, useEffect, useContext } from "react";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { RestoredApplicationConfig } from "../../../API";

export default function Playground() {
  const { sessionId } = useParams();
  const appContext = useContext(AppContext);
  const [isApplicationSession, setIsApplicationSession] = useState(false);
  const [applicationId, setApplicationId] = useState<string | undefined>();
  const [applicationConfig, setApplicationConfig] = useState<RestoredApplicationConfig | undefined>();
  const [, setSessionLoading] = useState(false);

  // Check if this session is an application session
  useEffect(() => {
    if (!appContext || !sessionId) return;

    const checkSession = async () => {
      console.log("🔍 Playground: Starting session check for sessionId:", sessionId);
      setSessionLoading(true);
      try {
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.sessions.getSession(sessionId);
        
        console.log("🔍 Playground: Raw session API result:", result);
        console.log("🔍 Playground: Session data:", result.data?.getSession);
        
        // Handle GraphQL errors gracefully - we can still restore if we have applicationId
        if (result.errors && result.errors.length > 0) {
          console.log("🔍 Playground: GraphQL errors detected:", result.errors);
          // Check if errors are related to applicationConfig resolution
          const appConfigErrors = result.errors.filter(error => 
            error.path && error.path.includes('applicationConfig')
          );
          if (appConfigErrors.length > 0) {
            console.log("🔍 Playground: Application config errors detected, will restore with applicationId only");
          }
        }
        
        const sessionData = result.data?.getSession && {
          ...result.data.getSession,
          applicationId: result.data.getSession.applicationId,
          applicationConfig: result.data.getSession.applicationConfig
        };
        if (sessionData) {
          console.log("🔍 Playground: Session data keys:", Object.keys(sessionData));
          console.log("🔍 Playground: ApplicationId in session:", sessionData.applicationId);
          console.log("🔍 Playground: ApplicationConfig in session:", sessionData.applicationConfig);
        }
        
        if (sessionData?.applicationId) {
          console.log("🔍 Playground: ✅ Detected application session:", sessionData.applicationId);
          setIsApplicationSession(true);
          setApplicationId(sessionData.applicationId);
          
          // Try to use application config if available, otherwise we'll just use applicationId
          if (sessionData.applicationConfig && sessionData.applicationConfig !== null) {
            console.log("🔍 Playground: Application config available:", sessionData.applicationConfig.name);
            setApplicationConfig(sessionData.applicationConfig as RestoredApplicationConfig);
          } else {
            console.log("🔍 Playground: ⚠️ No application config found, but will still restore as application session");
            // We'll still treat it as an application session, but without the config details
            setApplicationConfig(undefined);
          }
        } else {
          console.log("🔍 Playground: ❌ Not an application session");
          setIsApplicationSession(false);
          setApplicationId(undefined);
          setApplicationConfig(undefined);
        }
      } catch (error) {
        console.error("🔍 Playground: Error checking session:", error);
        setIsApplicationSession(false);
      } finally {
        setSessionLoading(false);
      }
    };

    checkSession();
  }, [appContext, sessionId]);

  const handleMessageSent = async () => {
    // Trigger a custom event that NavigationPanel can listen to
    const event = new CustomEvent('chatMessageSent');
    window.dispatchEvent(event);
  };

  // Render as application session if detected
  if (isApplicationSession) {
    return (
      <BaseAppLayout
        content={
          <Container>
            <Chat 
              sessionId={sessionId} 
              applicationId={applicationId} 
              description={applicationConfig?.description ?? ""}
              name={applicationConfig?.name ?? ""}
              onMessageSent={handleMessageSent}
            />
          </Container>
        }
        info={
          <HelpPanel header={<Header variant="h3">Using custom applications</Header>}>
            <p>
              Custom applications allow users to quickly query prebuilt LLM applications
              with a designated system prompt and selected workspaces, designed and managed
              by administrators based on collected user patterns and workflows. If you have
              administrator access you may edit existing applications in the {" "}
              <Link to="/admin/applications">Applications</Link> console.
            </p>
          </HelpPanel>
        }
      />
    );
  }

  // Render as regular playground for non-application sessions
  return (
    <BaseAppLayout
      info={
        <HelpPanel header={<Header variant="h3">Using the chat</Header>}>
          <p>
            This chat playground allows user to interact with a chosen LLM and
            optional RAG retriever. You can create new RAG workspaces via the{" "}
            <Link to="/rag/workspaces">Workspaces</Link> console.
          </p>
          <h3>Settings</h3>
          <p>
            You can configure additional settings for the LLM via the setting
            action at the bottom-right. You can change the Temperature and Top P
            values to be used for the answer generation. You can also enable and
            disable streaming mode for those models that support it (the setting
            is ignored if the model does not support streaming). Turning on
            Metadata displays additional information about the answer, such as
            the prompts being used to interact with the LLM and the document
            passages that might have been retrieved from the RAG storage.
          </p>
          <h3>Multimodal chat</h3>
          <p>
            If you select a multimodal model (like Anthropic Claude 3), you can
            upload images to use in the conversation.
          </p>
          <h3>Session history</h3>
          <p>
            All conversations are saved and can be later accessed via the{" "}
            <Link to="/chatbot/sessions">Session</Link> in the navigation bar.
          </p>
        </HelpPanel>
      }
      toolsWidth={300}
      content={
        <Container data-locator="chatbot-ai-container">
          <Chat sessionId={sessionId} onMessageSent={handleMessageSent} />
        </Container>
      }
    />
  );
}
