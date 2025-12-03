import { useContext, useEffect, useState, useRef } from "react";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
  FeedbackData,
} from "./types";
import {
  Alert,
  SpaceBetween,
  StatusIndicator,
  Container,
  Header,
} from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import ChatInputPanel, { ChatScrollState } from "./chat-input-panel";
import styles from "../../styles/chat.module.scss";
import { CHATBOT_NAME } from "../../common/constants";
import { Application, RestoredApplicationConfig } from "../../API";

export default function Chat(props: {
  sessionId?: string;
  applicationId?: string;
  onMessageSent?: () => void;
  description?: string;
  name?: string;
}) {
  const appContext = useContext(AppContext);
  const [running, setRunning] = useState<boolean>(false);
  const previousRunningRef = useRef<boolean>(false);
  const [session, setSession] = useState<
    { id: string; loading: boolean } | undefined
  >();
  const [, setApplication] = useState<Application>(
    {} as Application
  );
  const [initError, setInitError] = useState<string | undefined>(undefined);
  const [configuration, setConfiguration] = useState<ChatBotConfiguration>(
    () => ({
      streaming: true,
      showMetadata: false,
      maxTokens: 8192,
      temperature: 0.6,
      topP: 0.9,
      images: null,
      documents: null,
      videos: null,
      seed: 0,
      filesBlob: {
        images: null,
        documents: null,
        videos: null,
      },
    })
  );

  const [messageHistory, setMessageHistory] = useState<ChatBotHistoryItem[]>(
    []
  );

  // Add state for session configuration
  const [sessionConfiguration, setSessionConfiguration] = useState<{
    modelId?: string;
    provider?: string;
    workspaceId?: string;
    modelKwargs?: any;
  } | null>(null);

  // Add state for restored application data
  const [restoredApplicationId, setRestoredApplicationId] = useState<string | undefined>(undefined);
  const [restoredApplicationConfig, setRestoredApplicationConfig] = useState<RestoredApplicationConfig | undefined>(undefined);
  
  // Computed property to determine effective applicationId (from props or restored from session)
  const effectiveApplicationId = props.applicationId || restoredApplicationId;
  const effectiveDescription = props.description || restoredApplicationConfig?.description || 
    (restoredApplicationId ? "Application session (original application no longer available)" : undefined);
  const effectiveName = props.name || restoredApplicationConfig?.name || 
    (restoredApplicationId ? "Application Chat" : undefined);
  
  // Add logging for effective values
  useEffect(() => {
    console.log("🔍 Chat: Effective values updated:");
    console.log("🔍 Chat: - effectiveApplicationId:", effectiveApplicationId);
    console.log("🔍 Chat: - effectiveDescription:", effectiveDescription);
    console.log("🔍 Chat: - effectiveName:", effectiveName);
    console.log("🔍 Chat: - props.applicationId:", props.applicationId);
    console.log("🔍 Chat: - restoredApplicationId:", restoredApplicationId);
    console.log("🔍 Chat: - restoredApplicationConfig:", restoredApplicationConfig);
  }, [effectiveApplicationId, effectiveDescription, effectiveName, props.applicationId, restoredApplicationId, restoredApplicationConfig]);

  // Track when AI finishes responding and trigger session refresh
  useEffect(() => {
    if (previousRunningRef.current === true && running === false) {
      // AI just finished responding, refresh sessions
      props.onMessageSent?.();
    }
    previousRunningRef.current = running;
  }, [running, props.onMessageSent]);

  useEffect(() => {
    if (!appContext) return;
    setMessageHistory([]);
    setSessionConfiguration(null);
    setRestoredApplicationId(undefined);
    setRestoredApplicationConfig(undefined);

    (async () => {
      if (!props.sessionId) {
        setSession({ id: uuidv4(), loading: false });
        return;
      }

      setSession({ id: props.sessionId, loading: true });
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.sessions.getSession(props.sessionId);
        console.log("Session API result:", result);

        if (result.data?.getSession?.history) {
          ChatScrollState.skipNextHistoryUpdate = true;
          ChatScrollState.skipNextScrollEvent = true;
          
          console.log("🔍 Chat: Raw session result:", result.data.getSession);
          
          // Handle GraphQL errors gracefully
          if (result.errors && result.errors.length > 0) {
            console.log("🔍 Chat: GraphQL errors detected:", result.errors);
            const appConfigErrors = result.errors.filter(error => 
              error.path && error.path.includes('applicationConfig')
            );
            if (appConfigErrors.length > 0) {
              console.log("🔍 Chat: Application config errors detected, will restore with applicationId only");
            }
          }
          
          const history = result.data!.getSession!.history.filter((x) => x !== null);
          
          // Set message history first
          const processedHistory = history.map((x) => ({
            type: x!.type as ChatBotMessageType,
            metadata: x!.metadata ? JSON.parse(x!.metadata) : null,
            content: x!.content,
          }));
          setMessageHistory(processedHistory);

          // Check if this session has application data
          const sessionData = result.data.getSession as (typeof result.data.getSession & {
            applicationId?: string;
            applicationConfig?: any; // Use any to avoid __typename conflicts
          });
          
          console.log("🔍 Chat: Session data keys:", Object.keys(sessionData));
          console.log("🔍 Chat: ApplicationId:", sessionData.applicationId);
          console.log("🔍 Chat: ApplicationConfig:", sessionData.applicationConfig);
          
          if (sessionData.applicationId) {
            console.log("🔍 Chat: ✅ Restoring application session:", sessionData.applicationId);
            setRestoredApplicationId(sessionData.applicationId);
            
            // If we have current application config, use it
            if (sessionData.applicationConfig && sessionData.applicationConfig !== null) {
              console.log("🔍 Chat: ✅ Applying restored application config:", sessionData.applicationConfig);
              console.log("🔍 Chat: App name:", sessionData.applicationConfig.name);
              console.log("🔍 Chat: App description:", sessionData.applicationConfig.description);
              // Cast to RestoredApplicationConfig to fix type mismatch
              setRestoredApplicationConfig(sessionData.applicationConfig as RestoredApplicationConfig);
            } else {
              console.log("🔍 Chat: ⚠️ ApplicationId found but no config available - original application may have been deleted");
              // Still restore as application session, but with no specific config
              setRestoredApplicationConfig(undefined);
            }
          } else {
            console.log("🔍 Chat: ❌ No applicationId found in session");
          }

          // Extract session configuration once
          const sessionConfig = extractSessionConfiguration(history);
          if (sessionConfig) {
            console.log("🔍 Chat: Setting session configuration:", sessionConfig);
            setSessionConfiguration(sessionConfig);
          }

          window.scrollTo({
            top: 0,
            behavior: "instant",
          });
        }
      } catch (error) {
        console.log(error);
      }

      setSession({ id: props.sessionId, loading: false });
      setRunning(false);
    })();
  }, [appContext, props.sessionId, props.applicationId]);

  // Helper function to extract session configuration from metadata
  const extractSessionConfiguration = (history: any[]) => {
    for (const item of history) {
      if (item.metadata) {
        try {
          const metadata = JSON.parse(item.metadata);
          if (metadata.modelId && metadata.modelKwargs) {
            // Extract provider from modelId (format: provider.modelName)
            const modelParts = metadata.modelId.split('.');
            const provider = modelParts[0]; // First part is the provider (e.g., 'anthropic')
            const modelId = metadata.modelId; // Keep the full modelId as is
            
            return {
              modelId,
              provider,
              workspaceId: metadata.workspaceId,
              modelKwargs: metadata.modelKwargs,
            };
          }
        } catch (e) {
          console.warn('Failed to parse session metadata:', e);
        }
      }
    }
    return null;
  };

  const handleFeedback = (
    feedbackType: 1 | 0,
    idx: number,
    message: ChatBotHistoryItem
  ) => {
    if (message.metadata?.sessionId) {
      let prompt = "";
      if (Array.isArray(message.metadata?.prompts)) {
        prompt = (message.metadata?.prompts[0] as string) || "";
      }
      const completion = message.content;
      const model = message.metadata?.modelId;
      const feedbackData: FeedbackData = {
        sessionId: message.metadata.sessionId as string,
        key: idx,
        feedback: feedbackType,
        prompt: prompt,
        completion: completion,
        model: model as string,
        applicationId: effectiveApplicationId,  // Use effective applicationId (props or restored)
      };
      addUserFeedback(feedbackData);
    }
  };

  const addUserFeedback = async (feedbackData: FeedbackData) => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    await apiClient.userFeedback.addUserFeedback({ feedbackData });
  };

  return (
    <div
      className={
        effectiveApplicationId ? styles.chat_app_container : styles.chat_container
      }
    >
      {initError && (
        <Alert
          statusIconAriaLabel="Error"
          type="error"
          header="Unable to initalize the Chatbot."
        >
          {initError}
        </Alert>
      )}
      {effectiveDescription && (
        <Container>
          <SpaceBetween direction="vertical" size="xxs">
            <Header variant="h3">{effectiveName}</Header>
            <p>{effectiveDescription}</p>
          </SpaceBetween>
        </Container>
      )}
      <div style={{ position: 'relative', flex: '1' }}>
        <SpaceBetween direction="vertical" size="xxs">
          {messageHistory.map((message, idx) => {
            return (
              <ChatMessage
                key={idx}
                message={message}
                showMetadata={configuration.showMetadata}
                onThumbsUp={() => handleFeedback(1, idx, message)}
                onThumbsDown={() => handleFeedback(0, idx, message)}
              />
            );
          })}
        </SpaceBetween>
        <div className={styles.welcome_text} style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          lineHeight: '1.5em'
        }}>
          {messageHistory.length == 0 &&
            !session?.loading &&
            !effectiveApplicationId && <center>{CHATBOT_NAME}</center>}
          {messageHistory.length == 0 &&
            !session?.loading &&
            effectiveApplicationId && (
              <center>{effectiveName ?? CHATBOT_NAME}</center>
            )}
          {session?.loading && (
            <center>
              <StatusIndicator type="loading">Loading session</StatusIndicator>
            </center>
          )}
        </div>
      </div>
      <div className={styles.input_container}>
        {session && (
          <ChatInputPanel
            session={session}
            running={running}
            setRunning={setRunning}
            messageHistory={messageHistory}
            setMessageHistory={setMessageHistory}
            setInitErrorMessage={(error) => setInitError(error)}
            configuration={configuration}
            setConfiguration={setConfiguration}
            applicationId={effectiveApplicationId}  // Use effective applicationId (props or restored)
            setApplication={setApplication}
            sessionConfiguration={sessionConfiguration}
          />
        )}
      </div>
    </div>
  );
}
