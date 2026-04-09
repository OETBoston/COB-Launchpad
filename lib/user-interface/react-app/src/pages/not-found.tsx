import useOnFollow from "../common/hooks/use-on-follow";
import {
  Alert,
  Box,
  BreadcrumbGroup,
  Button,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
} from "@cloudscape-design/components";
import { Auth } from "aws-amplify";
import BaseAppLayout from "../components/base-app-layout";
import { CHATBOT_NAME } from "../common/constants";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../common/user-context";
import { userHasChatbotAppAccess } from "../common/types";
import styles from "../styles/chat.module.scss";

/** Ping SSO single logout — full sign-out so the next login picks up new groups. */
const SSO_LOGOUT_URL = "https://sso.boston.gov/idp/startSLO.ping";

/** Time to read the page before automatic redirect; keeps users informed via countdown. */
const AUTO_LOGOUT_SECONDS = 30;

function AccessDeniedNoRoles() {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_LOGOUT_SECONDS);
  const hasRedirected = useRef(false);

  const redirectToSsoLogout = useCallback(async () => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;
    try {
      await Auth.signOut();
    } catch {
      /* Local session may already be invalid; still send user to IdP SLO */
    }
    window.location.assign(SSO_LOGOUT_URL);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0) {
      void redirectToSsoLogout();
    }
  }, [secondsLeft, redirectToSsoLogout]);

  return (
    <div className={styles.appChatContainer}>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Your account does not have permission to use this application yet. If you recently completed training or were added to the correct security groups, your sign-in session may still show the old status until you sign out and sign back in."
          >
            Access not available for this account
          </Header>
        }
      >
        <SpaceBetween size="l">
          <Alert type="error" header="No application role on your account">
            We do not see an assigned role for this app in your current session. If
            you believe you should have access, confirm with your administrator that
            you are in the correct security groups, then sign out completely and sign
            in again so your permissions refresh.
          </Alert>

          <Container
            header={
              <Header variant="h2" description="Follow these steps after access has been granted in your identity system.">
                Next steps
              </Header>
            }
          >
            <SpaceBetween size="l">
              <Box variant="p">
                When your training is complete and you have been granted membership in
                the proper security groups, you must <Box variant="strong">log out and
                log back in</Box>. A new login loads your updated groups into your
                session; staying signed in can keep showing the previous access level.
              </Box>

              <Alert type="info" header="Automatic sign-out">
                To make this easy, this page will redirect you to the City single
                sign-out page in{" "}
                <Box variant="strong" display="inline">
                  {secondsLeft}
                </Box>{" "}
                second{secondsLeft === 1 ? "" : "s"} so you can sign in again with a
                fresh session. This is expected—nothing is wrong with your device.
                You can also sign out immediately using the button below.
              </Alert>

              <Box>
                <SpaceBetween direction="horizontal" size="xs">
                  <Box
                    fontSize="heading-m"
                    fontWeight="bold"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    Signing you out in {secondsLeft} second
                    {secondsLeft === 1 ? "" : "s"}
                  </Box>
                </SpaceBetween>
              </Box>

              <Button
                variant="primary"
                iconName="external"
                onClick={() => void redirectToSsoLogout()}
              >
                Log out now (sign back in after)
              </Button>

              <Box variant="small" color="text-body-secondary">
                Still need help after signing back in? Contact Michael Huang at{" "}
                <Box variant="strong" display="inline">
                  michael.huang@boston.gov
                </Box>
                .
              </Box>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </div>
  );
}

export default function NotFound() {
  const onFollow = useOnFollow();
  const userContext = useContext(UserContext);

  /* Without any of admin / workspace_manager / chatbot_user, routes in app.tsx are not mounted —
     user lands here; they may have other Cognito groups, so length > 0 still means "no app access". */
  if (!userHasChatbotAppAccess(userContext.userRoles)) {
    return <AccessDeniedNoRoles />;
  }

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "Not Found",
              href: "/not-found",
            },
          ]}
          expandAriaLabel="Show path"
          ariaLabel="Breadcrumbs"
        />
      }
      content={
        <ContentLayout
          header={
            <Header variant="h1" description="The link may be incorrect or the page may have been removed.">
              Page not found
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Container>
              <Alert type="info" header="We could not find this page">
                Check the URL or use the navigation menu to open a section you have access to.
              </Alert>
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
