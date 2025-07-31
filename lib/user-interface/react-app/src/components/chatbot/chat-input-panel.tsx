import {
  Box,
  Button,
  Select,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  PromptInput,
  ButtonGroup,
  ButtonGroupProps,
  FileTokenGroup,
  Alert,
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { StorageHelper } from "../../common/helpers/storage-helper";
import { API } from "aws-amplify";
import { GraphQLSubscription } from "@aws-amplify/api";
import {
  Application,
  GetApplicationQuery,
  Model,
  ReceiveMessagesSubscription,
  Workspace,
} from "../../API";
import { ModelInterface } from "../../common/types";
import styles from "../../styles/chat.module.scss";
import ConfigDialog from "./config-dialog";
import {
  ChabotInputModality,
  ChatBotHeartbeatRequest,
  ChatBotAction,
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotMode,
  ChatBotRunRequest,
  ChatInputState,
  SessionFile,
  ChatBotModelInterface,
  ChatBotToken,
  ChabotOutputModality,
} from "./types";
import { sendQuery } from "../../graphql/mutations";
import { getSelectedModelMetadata, updateMessageHistoryRef } from "./utils";
import { receiveMessages } from "../../graphql/subscriptions";
import { Utils } from "../../common/utils";
import FileDialog from "./file-dialog";

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
  setInitErrorMessage?: (error?: string) => void;
  applicationId?: string;
  setApplication: Dispatch<React.SetStateAction<Application>>;
  sessionConfiguration?: {
    modelId?: string;
    provider?: string;
    workspaceId?: string;
    modelKwargs?: any;
  } | null;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

const workspaceDefaultOptions: SelectProps.Option[] = [
  {
    label: "No workspace (RAG data source)",
    value: "",
    iconName: "close",
  },
  {
    label: "Create new workspace",
    value: "__create__",
    iconName: "add-plus",
  },
];

export default function ChatInputPanel(props: ChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [state, setState] = useState<ChatInputState>({
    value: "",
    selectedModel: null,
    selectedModelMetadata: null,
    selectedWorkspace: workspaceDefaultOptions[0],
    modelsStatus: "loading",
    workspacesStatus: "loading",
    applicationStatus: "loading",
  });
  const [configDialogVisible, setConfigDialogVisible] = useState(false);
  const [imageDialogVisible, setImageDialogVisible] = useState(false);
  const [documentDialogVisible, setDocumentDialogVisible] = useState(false);
  const [videoDialogVisible, setVideoDialogVisible] = useState(false);
  const [images, setImages] = useState<SessionFile[]>([]);
  const [documents, setDocuments] = useState<SessionFile[]>([]);
  const [videos, setVideos] = useState<SessionFile[]>([]);
  const [filesBlob, setFilesBlob] = useState<File[]>([]);
  const [outputModality, setOutputModality] = useState<ChabotOutputModality>(
    ChabotOutputModality.Text
  );
  const [application] =
    useState<GetApplicationQuery["getApplication"]>(null);
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.UNINSTANTIATED
  );

  const modelMatchingCompleteRef = useRef(false);
  const [modelMatchingComplete, setModelMatchingComplete] = useState(false);
  const modelMatchingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [modelMatchingWarning, setModelMatchingWarning] = useState<string | undefined>(undefined);
  const lastProcessedConfigRef = useRef<string | null>(null);
  const sessionConfigProcessedRef = useRef<string | null>(null); // Track processed session configs

  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);
  const isMediaGenerationModel = (outputModality?: ChabotOutputModality) => {
    if (!outputModality) return false;
    return [ChabotOutputModality.Image, ChabotOutputModality.Video].includes(
      outputModality
    );
  };

  useEffect(() => {
    messageHistoryRef.current = props.messageHistory;
  }, [props.messageHistory]);

  useEffect(() => {
    async function subscribe() {
      console.log("Subscribing to AppSync");
      const messageTokens: { [key: string]: ChatBotToken[] } = {};
      setReadyState(ReadyState.CONNECTING);
      const sub = await API.graphql<
        GraphQLSubscription<ReceiveMessagesSubscription>
      >({
        query: receiveMessages,
        variables: {
          sessionId: props.session.id,
        },
        authMode: "AMAZON_COGNITO_USER_POOLS",
      }).subscribe({
        next: ({ value }) => {
          console.log("Raw WebSocket data received:", value);
          const data = value.data!.receiveMessages?.data;
          if (data !== undefined && data !== null) {
            console.log("Parsed message data:", data);
            const response: ChatBotMessageResponse = JSON.parse(data);
            console.log("Parsed response:", response);
            if (response.action === ChatBotAction.Heartbeat) {
              console.log("Heartbeat pong!");
              return;
            }

            updateMessageHistoryRef(
              props.session.id,
              messageHistoryRef.current,
              response,
              messageTokens
            );

            if (
              response.action === ChatBotAction.FinalResponse ||
              response.action === ChatBotAction.Error
            ) {
              console.log("Final message received");
              props.setRunning(false);
            }
            props.setMessageHistory([...messageHistoryRef.current]);
          }
        },
        error: (error) => console.warn(error),
      });
      return sub;
    }

    const sub = subscribe();
    sub
      .then(() => {
        setReadyState(ReadyState.OPEN);
        console.log(`Subscribed to session ${props.session.id}`);
        const request: ChatBotHeartbeatRequest = {
          action: ChatBotAction.Heartbeat,
          modelInterface: ChatBotModelInterface.Langchain,
          data: {
            sessionId: props.session.id,
          },
        };
        const result = API.graphql({
          query: sendQuery,
          variables: {
            data: JSON.stringify(request),
          },
        });
        Promise.all([result])
          .then((x) => console.log(`Query successful`, x))
          .catch((err) => {
            console.log(Utils.getErrorMessage(err));
          });
      })
      .catch((err) => {
        console.log(err);
        setReadyState(ReadyState.CLOSED);
      });

    return () => {
      sub
        .then((s) => {
          console.log(`Unsubscribing from ${props.session.id}`);
          s.unsubscribe();
        })
        .catch((err) => console.log(err));
    };
    // eslint-disable-next-line
  }, [props.session.id]);

  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);

  useEffect(() => {
    if (!appContext) return;

    // Only load models and workspaces once at component mount
    const loadModelsAndWorkspaces = async () => {
      const apiClient = new ApiClient(appContext);
      try {
        if (props.setInitErrorMessage) props.setInitErrorMessage(undefined);
        
        // Load models first
        const modelsResult = await apiClient.models.getModels();
        const models = modelsResult.data ? modelsResult.data.listModels : [];
        
        // Load workspaces if RAG is enabled
        let workspaces: Workspace[] = [];
        if (appContext?.config.rag_enabled) {
          const workspacesResult = await apiClient.workspaces.getWorkspaces();
          workspaces = workspacesResult.data?.listWorkspaces ?? [];
        }

        setState(prevState => ({
          ...prevState,
          models,
          workspaces,
          modelsStatus: "finished",
          workspacesStatus: "finished"
        }));

      } catch (error) {
        console.error("Error loading models/workspaces:", error);
        if (props.setInitErrorMessage) {
          props.setInitErrorMessage(Utils.getErrorMessage(error));
        }
        setState(prevState => ({
          ...prevState,
          modelsStatus: "error",
          workspacesStatus: "error"
        }));
        setReadyState(ReadyState.CLOSED);
      }
    };

    loadModelsAndWorkspaces();
  }, [appContext]); // Only run once when appContext is available

  // Separate effect to handle session configuration updates
  useEffect(() => {
    if (!state.models || !state.workspaces) return;

    // Skip model matching for applications - they have pre-configured models
    if (props.applicationId) {
      console.log("🔍 Skipping model matching for application mode");
      setModelMatchingComplete(true);
      modelMatchingCompleteRef.current = true;
      return;
    }

    // Create a unique key for this configuration to prevent duplicate processing
    const configKey = props.sessionConfiguration ? 
      `${props.sessionConfiguration.modelId}-${props.sessionConfiguration.provider}-${props.sessionConfiguration.workspaceId}` : 
      'no-config';
    
    // Skip if we've already processed this exact configuration
    if (sessionConfigProcessedRef.current === configKey) {
      console.log("🔍 Skipping duplicate session config processing:", configKey);
      return;
    }

    sessionConfigProcessedRef.current = configKey;
    console.log("🔍 Processing session configuration:", configKey);

    let selectedModelOption = getSelectedModelOption(state.models);
    let selectedWorkspace = workspaceDefaultOptions[0];
    let selectedModelMetadata: Model | null = null;

    // If we have session configuration, use those values
    const sessionWorkspaceId = props.sessionConfiguration?.workspaceId;
    if (sessionWorkspaceId && state.workspaces) {
      const workspace = state.workspaces.find(ws => ws.id === sessionWorkspaceId);
      if (workspace) {
        selectedWorkspace = {
          label: workspace.name,
          value: workspace.id
        };
      }
    }

    const sessionModelId = props.sessionConfiguration?.modelId;
    const sessionProvider = props.sessionConfiguration?.provider;
    if (sessionModelId && sessionProvider) {
      // Helper function to normalize model names by removing region prefix
      const normalizeModelName = (name: string) => name.includes('.') ? 
        name.split('.').slice(-2).join('.') : name;

      const normalizedSessionModelId = normalizeModelName(sessionModelId);
      console.log("🔍 Looking for model:", { 
        original: sessionModelId, 
        normalized: normalizedSessionModelId,
        provider: sessionProvider
      });

      // Find model by comparing normalized names
      const model = state.models.find((m: Model) => {
        const normalizedModelName = normalizeModelName(m.name);
        const matches = normalizedModelName === normalizedSessionModelId;
        if (matches) {
          console.log("🔍 Model match found:", {
            modelName: m.name,
            modelProvider: m.provider,
            normalizedName: normalizedModelName
          });
        }
        return matches;
      });

      if (model) {
        selectedModelOption = {
          label: model.name,
          value: `${sessionProvider}::${model.name}`
        };
        selectedModelMetadata = model;  // Use the found model as metadata

        console.log("🔍 Setting model and metadata:", {
          option: selectedModelOption,
          metadata: selectedModelMetadata
        });
      } else {
        console.log("⚠️ Could not find matching model. Looking for:", normalizedSessionModelId);
      }
    }

    // Mark model matching as complete after processing session config
    if (!modelMatchingCompleteRef.current) {
      console.log("🔍 Marking model matching complete after session config processing");
      modelMatchingCompleteRef.current = true;
      setModelMatchingComplete(true);
    }

    // Single state update with all changes
    setState(prevState => {
      const shouldUpdate = 
        prevState.selectedModel?.value !== selectedModelOption?.value ||
        prevState.selectedWorkspace?.value !== selectedWorkspace?.value ||
        prevState.selectedModelMetadata?.name !== selectedModelMetadata?.name;

      if (!shouldUpdate) {
        console.log("🔍 No state update needed");
        return prevState;
      }

      const newState = {
        ...prevState,
        selectedModel: selectedModelOption,
        selectedModelMetadata: selectedModelMetadata,
        selectedWorkspace: selectedWorkspace
      };

      console.log("🔍 Updating state with:", {
        model: newState.selectedModel?.value,
        metadata: newState.selectedModelMetadata?.name,
        workspace: newState.selectedWorkspace?.value
      });

      return newState;
    });

  }, [props.sessionConfiguration, state.models, state.workspaces]);

  // Add a safety timeout as backup
  useEffect(() => {
    if (props.sessionConfiguration && !modelMatchingCompleteRef.current) {
      const safetyTimeout = setTimeout(() => {
        console.log("⚠️ Safety timeout - ensuring model matching is complete");
        if (!modelMatchingCompleteRef.current) {
          modelMatchingCompleteRef.current = true;
          setModelMatchingComplete(true);
        }
      }, 1000); // 1 second safety timeout

      return () => clearTimeout(safetyTimeout);
    }
  }, [props.sessionConfiguration]);

  // Add a debug effect to track when selectedModel changes
  useEffect(() => {
    console.log("🔍 selectedModel changed to:", state.selectedModel);
  }, [state.selectedModel]);

  // Debug effect to track loading overlay visibility
  useEffect(() => {
    const shouldShowOverlay = props.sessionConfiguration && !modelMatchingComplete;
    console.log("🔍 Loading overlay visibility:", {
      shouldShow: shouldShowOverlay,
      hasSessionConfig: !!props.sessionConfiguration,
      modelMatchingComplete,
      sessionId: props.session.id
    });
  }, [props.sessionConfiguration, modelMatchingComplete, props.session.id]);

  // DISABLED: This effect was overriding our session configuration handling
  // Handle session configuration changes and trigger model matching
  // This effect restores the model selection from session configuration when available
  /*
  useEffect(() => {
    // For new sessions (no session configuration), mark model matching as complete immediately
    if (!props.sessionConfiguration && state.models && !modelMatchingCompleteRef.current) {
      modelMatchingCompleteRef.current = true;
      setModelMatchingComplete(true);
      return;
    }
    
    // Only run model matching if we have session configuration, models are loaded, and matching hasn't completed
    if (props.sessionConfiguration?.modelId && props.sessionConfiguration?.provider && state.models && !modelMatchingCompleteRef.current) {
      // Create a unique key for this configuration
      const configKey = `${props.sessionConfiguration.modelId}-${props.sessionConfiguration.provider}`;
      
      // Skip if we've already processed this exact configuration
      if (lastProcessedConfigRef.current === configKey) {
        return;
      }
      
      lastProcessedConfigRef.current = configKey;
      
      const models = state.models;
      
      // Set up timeout for model matching (2 seconds)
      const timeout = setTimeout(() => {
        setModelMatchingWarning("Session model not found, using default Claude 3.5 Sonnet");
        modelMatchingCompleteRef.current = true;
        setModelMatchingComplete(true);
        // Find Claude 3.5 as fallback
        const claude35Option = models.find((model: any) => 
          model.name === "anthropic.claude-3-5-sonnet-20240620-v1:0"
        );
        if (claude35Option) {
          const selectedModelOption = {
            label: claude35Option.name,
            value: `${claude35Option.provider}::${claude35Option.name}`,
          };
          setState(prevState => ({
            ...prevState,
            selectedModel: selectedModelOption,
            selectedModelMetadata: getSelectedModelMetadata(models, selectedModelOption),
          }));
        }
      }, 2000);
      modelMatchingTimeoutRef.current = timeout;
      // Construct the model value in the correct format (provider::name) to match OptionsHelper.parseValue
      const sessionModelValue = `${props.sessionConfiguration.provider}::${props.sessionConfiguration.modelId}`;
      const sessionModelOption = models.find((model: any) => 
        `${model.provider}::${model.name}` === sessionModelValue
      );
      // If found, clear timeout and mark matching as complete
      if (sessionModelOption) {
        if (modelMatchingTimeoutRef.current) {
          clearTimeout(modelMatchingTimeoutRef.current);
          modelMatchingTimeoutRef.current = null;
        }
        modelMatchingCompleteRef.current = true;
        setModelMatchingComplete(true);
        const selectedModelOption = {
          label: sessionModelOption.name,
          value: sessionModelValue,
        };
        setState(prevState => ({
          ...prevState,
          selectedModel: selectedModelOption,
          selectedModelMetadata: getSelectedModelMetadata(models, selectedModelOption),
        }));
      }
    }
    // Add a fallback timeout for model matching if sessionConfiguration exists but modelId/provider is missing
    if (props.sessionConfiguration && (!props.sessionConfiguration.modelId || !props.sessionConfiguration.provider) && !modelMatchingCompleteRef.current) {
      // Set up timeout for model matching (2 seconds)
      const timeout = setTimeout(() => {
        setModelMatchingWarning("Session model configuration incomplete, using default Claude 3.5 Sonnet");
        modelMatchingCompleteRef.current = true;
        setModelMatchingComplete(true);
        // Find Claude 3.5 as fallback
        const models = state.models;
        const claude35Option = models?.find((model: any) => 
          model.name === "anthropic.claude-3-5-sonnet-20240620-v1:0"
        );
        if (claude35Option) {
          const selectedModelOption = {
            label: claude35Option.name,
            value: `${claude35Option.provider}::${claude35Option.name}`,
          };
          setState(prevState => ({
            ...prevState,
            selectedModel: selectedModelOption,
            selectedModelMetadata: getSelectedModelMetadata(models, selectedModelOption),
          }));
        }
      }, 2000);
      modelMatchingTimeoutRef.current = timeout;
    }
  }, [props.sessionConfiguration?.modelId, props.sessionConfiguration?.provider, state.models, props.sessionConfiguration]);
  */

  // Set model matching as complete for our new implementation
  useEffect(() => {
    if (state.models && !modelMatchingCompleteRef.current) {
      console.log("🔍 Marking model matching as complete");
      modelMatchingCompleteRef.current = true;
      setModelMatchingComplete(true);
    }
  }, [state.models]);

  // Reset model matching state when session changes to allow re-matching for new sessions
  useEffect(() => {
    console.log("🔍 Resetting model matching state for new session:", props.session.id);
    modelMatchingCompleteRef.current = false;
    setModelMatchingComplete(false);
    setModelMatchingWarning(undefined);
    lastProcessedConfigRef.current = null;
    sessionConfigProcessedRef.current = null; // Reset session config processing
    // Clear any existing timeout
    if (modelMatchingTimeoutRef.current) {
      clearTimeout(modelMatchingTimeoutRef.current);
      modelMatchingTimeoutRef.current = null;
    }
  }, [props.session.id]);

  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
            window.scrollY -
            document.documentElement.scrollHeight
        ) <= 10;

      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };

    window.addEventListener("scroll", onWindowScroll);

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    if (!ChatScrollState.userHasScrolled && props.messageHistory.length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messageHistory]);

  useEffect(() => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    const getSignedUrls = async () => {
      if (props.configuration?.images as SessionFile[]) {
        const files: SessionFile[] = [];
        for await (const file of props.configuration?.images ?? []) {
          const signedUrl = (
            await apiClient.sessions.getFileSignedUrl(file.key)
          ).data?.getFileURL;
          if (signedUrl) {
            files.push({
              ...file,
              url: signedUrl,
            });
          }
        }

        setImages(files);
      }
    };

    if (props.configuration.images?.length) {
      getSignedUrls().catch((e) => {
        console.log("Unable to get signed URL", e);
      });
    }
    if (props.configuration.documents?.length) {
      setDocuments(props.configuration?.documents);
    }
    if (props.configuration.videos?.length) {
      setVideos(props.configuration?.videos);
    }
    // add uploaded files blob for input file icon display
    const { images, documents, videos } = props?.configuration?.filesBlob ?? {};
    setFilesBlob([...(images || []), ...(documents || []), ...(videos || [])]);
  }, [appContext, props.configuration]);

  /* Updates the output modality when a model is selected and sets default workspace
   * for media generation models.
   */
  useEffect(() => {
    const metadata = state.selectedModelMetadata;
    if (!metadata?.outputModalities?.length) return;

    const defaultOutputModality = metadata
      .outputModalities[0] as ChabotOutputModality;
    setOutputModality(defaultOutputModality);

    const isMediaModel = isMediaGenerationModel(defaultOutputModality);
    if (isMediaModel) {
      // Only reset if not already set to the default workspace
      if (!state.selectedWorkspace || state.selectedWorkspace.value !== workspaceDefaultOptions[0].value) {
        setState((prevState) => ({
          ...prevState,
          selectedWorkspace: workspaceDefaultOptions[0],
        }));
      }
    }
  }, [state.selectedModelMetadata]);

  const getChatBotMode = (
    outputModality: ChabotOutputModality
  ): ChatBotMode => {
    const chatBotModeMap = {
      [ChabotOutputModality.Text]: ChatBotMode.Chain,
      [ChabotOutputModality.Image]: ChatBotMode.ImageGeneration,
      [ChabotOutputModality.Video]: ChatBotMode.VideoGeneration,
    } as { [key: string]: ChatBotMode };

    return chatBotModeMap[outputModality] ?? ChatBotMode.Chain;
  };

  const handleSendMessage = async (): Promise<void> => {
    console.log("[Send Button Clicked]", {
      selectedModel: state.selectedModel,
      selectedModelMetadata: state.selectedModelMetadata,
      selectedWorkspace: state.selectedWorkspace,
      readyState,
      running: props.running,
      value: state.value,
      models: state.models,
      applicationId: props.applicationId,
      sessionConfiguration: props.sessionConfiguration,
      modelMatchingComplete,
      sessionLoading: props.session.loading
    });
    if (!state.selectedModel && !props.applicationId) return;
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    if (!state.selectedModelMetadata && !props.applicationId) return; // Add null check for selectedModelMetadata
    ChatScrollState.userHasScrolled = false;

    let name, provider;
    if (!props.applicationId) {
      ({ name, provider } = OptionsHelper.parseValue(
        state.selectedModel?.value
      ));
    }

    const value = state.value.trim();
    const request: ChatBotRunRequest = props.applicationId
      ? {
          action: ChatBotAction.Run,
          modelInterface: "langchain", // We allow only langchain models in app creation
          data: {
            mode: getChatBotMode(outputModality),
            text: value,
            images: props.configuration.images ?? [],
            documents: props.configuration.documents ?? [],
            videos: props.configuration.videos ?? [],
            sessionId: props.session.id,
          },
          applicationId: props.applicationId ?? "",
        }
      : {
          action: ChatBotAction.Run,
          modelInterface: state.selectedModelMetadata?.interface as ModelInterface,
          data: {
            mode: getChatBotMode(outputModality),
            text: value,
            images: props.configuration.images ?? [],
            documents: props.configuration.documents ?? [],
            videos: props.configuration.videos ?? [],
            modelName: name,
            provider: provider,
            sessionId: props.session.id,
            workspaceId: state.selectedWorkspace?.value,
            modelKwargs: {
              streaming: props.configuration.streaming,
              maxTokens: props.configuration.maxTokens,
              temperature: props.configuration.temperature,
              topP: props.configuration.topP,
              seed: props.configuration.seed,
            },
          },
        };

    setState((state) => ({
      ...state,
      value: "",
    }));

    props.setConfiguration({
      ...props.configuration,
      filesBlob: {
        images: [],
        documents: [],
        videos: [],
      },
      images: [],
      documents: [],
      videos: [],
    });

    props.setRunning(true);
    messageHistoryRef.current = [
      ...messageHistoryRef.current,

      {
        type: ChatBotMessageType.Human,
        content: value,
        metadata: {
          ...props.configuration,
        },
        tokens: [],
      },
      {
        type: ChatBotMessageType.AI,
        tokens: [],
        content: "",
        metadata: {
          images: [],
          documents: [],
          videos: [],
        },
      },
    ];

    setImages([]);
    setDocuments([]);
    setVideos([]);

    props.setMessageHistory(messageHistoryRef.current);

    try {
      await API.graphql({
        query: sendQuery,
        variables: {
          data: JSON.stringify(request),
        },
      });
    } catch (err) {
      console.log(Utils.getErrorMessage(err));
      props.setRunning(false);
      messageHistoryRef.current[messageHistoryRef.current.length - 1].content =
        "**Error**, Unable to process the request: " +
        Utils.getErrorMessage(err);
      props.setMessageHistory(messageHistoryRef.current);
    }
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const modelsOptions = OptionsHelper.getSelectOptionGroups(state.models ?? []);

  const workspaceOptions = [
    ...(state.workspaces ?? []).map((workspace: any) => ({
      label: workspace.name,
      value: workspace.id,
    })),
    ...(appContext?.config.rag_enabled ? [
      {
        label: "Create new workspace",
        value: "__create__",
      },
    ] : []),
  ];

  const secondaryActions: ButtonGroupProps.ItemOrGroup[] = [
    {
      type: "icon-button",
      id: "record",
      iconName: listening ? "microphone-off" : "microphone",
      text: "Record",
      disabled: props.running || !browserSupportsSpeechRecognition,
    },
  ];
  if (
    (!props.applicationId &&
      state.selectedModelMetadata?.inputModalities.includes(
        ChabotInputModality.Image
      )) ||
    (props.applicationId && application?.allowImageInput)
  ) {
    secondaryActions.push({
      type: "icon-button",
      id: "images",
      iconSvg: (
        <svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="19" height="19" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      ),
      disabled: props.running,
      text: images?.length
        ? `Change images (${images?.length} added)`
        : "Add images",
    });
  }
  if (
    (!props.applicationId &&
      state.selectedModelMetadata?.inputModalities.includes(
        ChabotInputModality.Video
      )) ||
    (props.applicationId && application?.allowVideoInput)
  ) {
    secondaryActions.push({
      type: "icon-button",
      id: "videos",
      iconSvg: (
        <svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
          <rect width="18" height="19" x="3" y="2" strokeWidth="2" />
          <path d="M9 7l8 5-8 5V7z" />
        </svg>
      ),
      disabled: props.running,
      text: videos?.length
        ? `Change videos (${videos?.length} added)`
        : "Add videos",
    });
  }
  if (
    (!props.applicationId &&
      state.selectedModelMetadata?.inputModalities.includes(
        ChabotInputModality.Document
      )) ||
    (props.applicationId && application?.allowDocumentInput)
  ) {
    secondaryActions.push({
      type: "icon-button",
      id: "documents",
      iconName: "file",
      disabled: props.running,
      text: documents?.length
        ? `Change documents (${documents?.length} added)`
        : "Add documents",
    });
  }

  const outputModalityIcon = useMemo(() => {
    switch (outputModality) {
      case ChabotOutputModality.Text:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <path d="M5 5H11" />
            <path d="M8 5V11" />
            <path d="M11 11V11" />
          </svg>
        );
      case ChabotOutputModality.Image:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <circle cx="5.5" cy="5.5" r="1" />
            <path d="M14 10L10.5 7L3 13" />
            <path d="M12 13L8 9L5 12" />
          </svg>
        );
      case ChabotOutputModality.Video:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <path d="M2 6L14 6" />
            <path d="M5 3L6.5 6" />
            <path d="M8 3L9.5 6" />
            <path d="M11 3L12.5 6" />
            <path d="M6.5 8L10 9.75L6.5 11.5Z" />
          </svg>
        );
      default:
        return;
    }
  }, [outputModality]);

  /* Update this component to support video files */
  return (
    <div style={{ position: 'relative' }}>
      <SpaceBetween direction="vertical" size="l">
              {/* Loading overlay while model matching */}
        {props.sessionConfiguration && !modelMatchingComplete && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <StatusIndicator type="loading">Restoring session configuration...</StatusIndicator>
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
              Matching model and settings...
            </div>
          </div>
        </div>
      )}
      
      {/* Warning message if model matching failed */}
      {modelMatchingWarning && (
        <Alert
          statusIconAriaLabel="Warning"
          type="warning"
          header="Model Configuration"
          dismissible
          onDismiss={() => setModelMatchingWarning(undefined)}
        >
          {modelMatchingWarning}
        </Alert>
      )}
      
      <Box>
          <div>
            {imageDialogVisible && (
              <FileDialog
                sessionId={props.session.id}
                modality={ChabotInputModality.Image}
                header="Add images to your message"
                hint=".png, .jpg, .jpeg. Max 3.75MB."
                maxSize={3.75}
                allowedTypes={["image/png", "image/jpg", "image/jpeg"]}
                hideDialogs={() => {
                  setImageDialogVisible(false);
                  setDocumentDialogVisible(false);
                }}
                cancel={() => {
                  props.setConfiguration({
                    ...props.configuration,
                    images: [],
                  });
                  setImages([]);
                }}
                configuration={props.configuration}
                setConfiguration={props.setConfiguration}
              />
            )}
            {videoDialogVisible && (
              <FileDialog
                sessionId={props.session.id}
                modality={ChabotInputModality.Video}
                header="Add videos to your message"
                hint="video/mp4. Max 10MB."
                maxSize={10}
                allowedTypes={["video/mp4"]}
                hideDialogs={() => {
                  setImageDialogVisible(false);
                  setDocumentDialogVisible(false);
                  setVideoDialogVisible(false);
                }}
                cancel={() => {
                  props.setConfiguration({
                    ...props.configuration,
                    videos: [],
                  });
                  setVideos([]);
                }}
                configuration={props.configuration}
                setConfiguration={props.setConfiguration}
              />
            )}
            {documentDialogVisible && (
              <FileDialog
                sessionId={props.session.id}
                modality={ChabotInputModality.Document}
                header="Add documents to your message"
                hint=".pdf, .csv, .doc, .docx, .xls, .xlsx, .html,. txt, .md. Max 4.5MB."
                allowedTypes={[
                  "application/pdf",
                  "text/csv",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/vnd.ms-excel",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  "text/html",
                  "text/plain",
                  "text/markdown",
                ]}
                maxSize={4.5}
                hideDialogs={() => {
                  setImageDialogVisible(false);
                  setDocumentDialogVisible(false);
                }}
                cancel={() => {
                  props.setConfiguration({
                    ...props.configuration,
                    documents: [],
                  });
                  setDocuments([]);
                }}
                configuration={props.configuration}
                setConfiguration={props.setConfiguration}
              />
            )}
            <Box className={styles.prompt_input_wrapper}>
              <PromptInput
                data-locator="prompt-input"
                value={state.value}
                placeholder={
                  listening
                    ? "Listening..."
                    : props.running
                      ? "Generating a response"
                      : "Send a message"
                }
                actionButtonAriaLabel="Send"
                maxRows={6}
                minRows={1}
                autoFocus={true}
                disabled={props.running || (!!props.sessionConfiguration && !modelMatchingComplete)}
                onChange={(e) =>
                  setState((state) => ({ ...state, value: e.detail.value }))
                }
                onAction={handleSendMessage}
                actionButtonIconName="send"
                disableSecondaryActionsPaddings
                onKeyUp={(e) => {
                  if (e.detail.key === "ArrowUp") {
                    const messages = props.messageHistory.filter(
                      (i) => i.type === ChatBotMessageType.Human
                    );
                    if (state.value.length === 0 && messages.length > 0) {
                      // Set previous message if empty and key press up
                      setState((state) => ({
                        ...state,
                        value: messages[messages.length - 1].content,
                      }));
                    }
                  }
                }}
                secondaryActions={
                  <Box padding={{ left: "xxs", top: "xs" }}>
                    <ButtonGroup
                      ariaLabel="Chat actions"
                      items={secondaryActions}
                      variant="icon"
                      onItemClick={(item) => {
                        if (item.detail.id === "images") {
                          setImageDialogVisible(true);
                          setDocumentDialogVisible(false);
                          setVideoDialogVisible(false);
                        }
                        if (item.detail.id === "documents") {
                          setImageDialogVisible(false);
                          setDocumentDialogVisible(true);
                          setVideoDialogVisible(false);
                        }
                        if (item.detail.id === "videos") {
                          setVideoDialogVisible(true);
                          setImageDialogVisible(false);
                          setDocumentDialogVisible(false);
                        }
                        if (item.detail.id === "record") {
                          listening
                            ? SpeechRecognition.stopListening()
                            : SpeechRecognition.startListening();
                        }
                      }}
                    />
                  </Box>
                }
                secondaryContent={
                  filesBlob.length > 0 && (
                    <FileTokenGroup
                      items={filesBlob.map((file) => ({ file }))}
                      onDismiss={({ detail }) =>
                        setFilesBlob((files) =>
                          files.filter((_, index) => index !== detail.fileIndex)
                        )
                      }
                      alignment="horizontal"
                      i18nStrings={{
                        removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                        limitShowFewer: "Show fewer files",
                        limitShowMore: "Show more files",
                        errorIconAriaLabel: "Error",
                        warningIconAriaLabel: "Warning",
                      }}
                      readOnly
                      showFileSize
                      showFileThumbnail
                    />
                  )
                }
                disableActionButton={
                  readyState !== ReadyState.OPEN ||
                  (!state.models?.length && !props.applicationId) ||
                  (!state.selectedModel && !props.applicationId) ||
                  props.running ||
                  state.value.trim().length === 0 ||
                                      props.session.loading ||
                    (!!props.sessionConfiguration && !modelMatchingComplete)
                }
              />
              <span className={styles.icon}>{outputModalityIcon}</span>
            </Box>
          </div>
        </Box>
        {!props.applicationId && (
          <Box>
            <div className={styles.input_controls}>
              <div className={styles.input_controls_selects_2}>
                                  <Select
                    data-locator="select-model"
                    disabled={props.running || (!!props.sessionConfiguration && !modelMatchingComplete)}
                  statusType={state.modelsStatus}
                  loadingText="Loading models (might take few seconds)..."
                  placeholder="Select a model"
                  empty={
                    <div>
                      No models available. Please make sure you have access to
                      Amazon Bedrock or alternatively deploy a self hosted model
                      on SageMaker or add API_KEY to Secrets Manager
                    </div>
                  }
                  filteringType="auto"
                  selectedOption={state.selectedModel}
                  onChange={({ detail }) => {
                    setState((state) => ({
                      ...state,
                      selectedModel: detail.selectedOption,
                      selectedModelMetadata: getSelectedModelMetadata(
                        state.models,
                        detail.selectedOption
                      ),
                    }));
                    props.setConfiguration({
                      ...props.configuration,
                      filesBlob: {
                        images: [],
                        documents: [],
                        videos: [],
                      },
                      images: [],
                      documents: [],
                      videos: [],
                    });
                    setImages([]);
                    setDocuments([]);
                    setVideos([]);
                    setFilesBlob([]);
                    if (detail.selectedOption?.value) {
                      StorageHelper.setSelectedLLM(detail.selectedOption.value);
                    }
                  }}
                  options={modelsOptions}
                />
                <Select
                  disabled={props.running || !appContext?.config.rag_enabled}
                  loadingText="Loading workspaces (might take few seconds)..."
                  statusType={state.workspacesStatus}
                  placeholder={appContext?.config.rag_enabled 
                    ? "Select a workspace (RAG data source)" 
                    : "RAG is not enabled"}
                  filteringType="auto"
                  selectedOption={state.selectedWorkspace || workspaceDefaultOptions[0]}
                  options={workspaceOptions}
                  onChange={({ detail }) => {
                    if (detail.selectedOption?.value === "__create__") {
                      navigate("/rag/workspaces/create");
                    } else {
                      setState((state) => ({
                        ...state,
                        selectedWorkspace: detail.selectedOption,
                      }));
                    }
                  }}
                  empty={appContext?.config.rag_enabled 
                    ? "No Workspaces available" 
                    : "RAG is not enabled"}
                />
              </div>
              <div className={styles.input_controls_right}>
                <SpaceBetween
                  direction="horizontal"
                  size="xxs"
                  alignItems="center"
                >
                  <div style={{ paddingTop: "1px" }}>
                    <ConfigDialog
                      sessionId={props.session.id}
                      visible={configDialogVisible}
                      setVisible={setConfigDialogVisible}
                      configuration={props.configuration}
                      setConfiguration={props.setConfiguration}
                      outputModality={outputModality}
                    />
                    <Button
                      iconName="settings"
                      variant="icon"
                      onClick={() => setConfigDialogVisible(true)}
                    />
                  </div>
                  <StatusIndicator
                    type={
                      readyState === ReadyState.OPEN
                        ? "success"
                        : readyState === ReadyState.CONNECTING ||
                            readyState === ReadyState.UNINSTANTIATED
                          ? "in-progress"
                          : "error"
                    }
                  >
                    {readyState === ReadyState.OPEN
                      ? "Connected"
                      : connectionStatus}
                  </StatusIndicator>
                </SpaceBetween>
              </div>
            </div>
          </Box>
        )}
      </SpaceBetween>
    </div>
  );
}

function getSelectedModelOption(
  models: Model[]
): SelectProps.Option | null {
  if (models.length === 0) return null;

  // Try to find Claude 3.5 Sonnet as the default model
  const bedrockModels = models.filter((m) => m.provider === "bedrock");
  const defaultModel = bedrockModels.find((m) => m.name === "anthropic.claude-3-5-sonnet-20240620-v1:0") ||
                      bedrockModels.find((m) => m.name === "anthropic.claude-3-5-sonnet") ||
                      bedrockModels.find((m) => m.name === "anthropic.claude-v2") ||
                      bedrockModels.find((m) => m.name === "anthropic.claude-v1") ||
                      bedrockModels.find((m) => m.name === "amazon.titan-tg1-large") ||
                      bedrockModels[0];

  if (defaultModel) {
    return {
      label: defaultModel.name,
      value: `${defaultModel.provider}::${defaultModel.name}`,
    };
  }

  return {
    label: models[0].name,
    value: `${models[0].provider}::${models[0].name}`,
  };
}
