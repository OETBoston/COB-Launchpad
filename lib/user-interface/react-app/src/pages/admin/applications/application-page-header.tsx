import {
  Button,
  Header,
  HeaderProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import RouterButton from "../../../components/wrappers/router-button";

import { Utils } from "../../../common/utils";

interface ApplicationPageHeaderProps extends HeaderProps {
  title?: string;
  createButtonText?: string;
  getApplications: () => Promise<void>;
}

export function ApplicationPageHeader({
  title = "Applications",
  ...props
}: ApplicationPageHeaderProps) {
  const onRefreshClick = async () => {
    try {
      await props.getApplications();
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    }
  };

  return (
    <Header
      variant="awsui-h1-sticky"
      actions={
        <SpaceBetween size="xs" direction="horizontal">
          <Button iconName="refresh" onClick={onRefreshClick} />
          <RouterButton
            data-testid="header-btn-manage"
            variant="primary"
            href="/admin/applications/manage"
          >
            Create Application
          </RouterButton>
        </SpaceBetween>
      }
      {...props}
    >
      {title}
    </Header>
  );
}
