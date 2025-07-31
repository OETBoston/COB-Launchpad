import { useParams } from "react-router-dom";
import Chat from "../../components/chatbot/chat";
import BaseAppLayout from "../../components/base-app-layout";
import { Container, Header, HelpPanel } from "@cloudscape-design/components";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { useContext } from "react";

export default function ApplicationChat() {
  const { applicationId, sessionId } = useParams();
  const [description, setDescription] = useState<string | undefined>();
  const [name, setName] = useState<string | undefined>();
  const appContext = useContext(AppContext);

  useEffect(() => {
    if (!appContext || !applicationId) return;

    const fetchApplication = async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.applications.getApplication(applicationId);
        if (result.data?.getApplication) {
          if (result.data.getApplication.description) {
            setDescription(result.data.getApplication.description);
          }
          if (result.data.getApplication.name) {
            setName(result.data.getApplication.name);
          }
        }
      } catch (error) {
        console.error("Error fetching application:", error);
      }
    };

    fetchApplication();
  }, [appContext, applicationId]);

  const handleMessageSent = async () => {
    // Trigger a custom event that NavigationPanel can listen to
    const event = new CustomEvent('chatMessageSent');
    window.dispatchEvent(event);
  };

  return (
    <BaseAppLayout
      content={
        <Container>
          <Chat 
            sessionId={sessionId} 
            applicationId={applicationId} 
            description={description}
            name={name}
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
