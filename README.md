# City of Boston GenAI Sandbox - Feb 2025

This is a simple chatbot playground that uses the City of Boston's GenAI service to answer questions. It is built with the AWS CDK and uses cloud native GenAI services like Bedrock, OpenSearch and SageMaker.

This is a rebranding of the [AWS GenAI Chatbot](https://github.com/aws-samples/aws-genai-llm-chatbot) to be used by the City of Boston, with additional features and integrations.

# Local Development Quick Start

This project is deployed using the AWS CDK. The `cdk.json` file tells the CDK how to deploy the stack. Below is a quick start guide to deploy the chatbot to your AWS account.
Remember to check this file for the latest instructions: [docs/guide/deploy.md](https://github.com/aws-samples/aws-genai-llm-chatbot/blob/main/docs/guide/deploy.md).

Verify that your environment satisfies the following prerequisites:

1. An [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
2. An [IAM User](https://console.aws.amazon.com/iamv2/home?#/users/create) with **AdministratorAccess** policy granted (for production, we recommend restricting access as needed)
3. [NodeJS 18 or 20](https://nodejs.org/en/download/) installed

   - If you are using [`nvm`](https://github.com/nvm-sh/nvm) you can run the following before proceeding
     ```
     nvm install 18 && nvm use 18
     ```
     or
     ```
     nvm install 20 && nvm use 20
     ```

4. [AWS CLI](https://aws.amazon.com/cli/) installed and configured to use with your AWS account
5. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) installed
6. [Docker](https://docs.docker.com/get-docker/) installed
   - N.B. [`buildx`](https://github.com/docker/buildx) is also required. For Windows and macOS `buildx` [is included](https://github.com/docker/buildx#windows-and-macos) in [Docker Desktop](https://docs.docker.com/desktop/)
7. [Python 3+](https://www.python.org/downloads/) installed

**Step 1.** <a id="deployment-dependencies-installation"></a> Install the project dependencies and build the project.

```bash
npm ci && npm run build
```

**Step 2.** (Optional) Run the unit tests

```bash
npm run test && pip install -r pytest_requirements.txt && pytest tests
```

**Step 3.** Once done, run the configuration command to help you set up the solution with the features you need:

```bash
npm run config
```

You'll be prompted to configure the different aspects of the solution, such as:

- The LLMs or MLMs to enable (we support all models provided by Bedrock that [were enabled](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) along with SageMaker hosted Idefics, FalconLite, Mistral and more to come).
- Setup of the RAG system: engine selection (i.e. Aurora w/ pgvector, OpenSearch, Kendra).
- Embeddings selection.
- Limit accessibility to website and backend to VPC (private chatbot).
- Add existing Amazon Kendra indices as RAG sources

\***NOTE**: In order to enable OIDC authentication, you must enter `Y` when prompted to enable advanced settings. You will find an option to enable OIDC authentication in the Cognito User Pool. A couple things to be aware of:

- When you enable OIDC authentication, you will need to update the Cognito User Pool to include the `email` attribute and a custom `chatbot_role` attribute in the OIDC callback. In an organization, this would require you to liason with the identity provider team to get these attributes added to the OIDC callback. If this takes too long and you just want to get the chatbot up and running, you can remove the attribute mappings for all but the default 'username' attribute. This is done by commenting out the attribute mappings in the `lib/authentication.ts` file. Doing this will require administrators to manually add users to the appropriate user groups based on the `chatbot_role` attribute in the Cognito User Pool. Users' emails will also not show when they view their profile in the chatbot, but they will still be able to log in.

- By default, the cdk script will create a new cognito user pool, identity provider and cognito domain. Usually the identity provider team in an organization require a redirect URI to be set for the identity provider, which is the cognito domain with the path `/oauth2/idpresponse`. If you don't want to change this every time you have a fresh deploy (if you already have a cognito user pool or cognito domain you'd like to use), you can set the `existing_cognito_user_pool` and `existing_cognito_domain` variables to their corresponding values in the `bin/config.json` file. Warning, this file is gitignored and partially overwritten each time you run the `npm run config` command.

- If your OIDC provider requires custom endpoints, you can manually set the `OIDCAuthorizationEndpoint`, `OIDCJWKSURI`, `OIDCTokenEndpoint`, and `OIDCUserInfoEndpoint` variables in the `bin/config.json` file under the `cognitoFederation` object.

For more details about the options, please refer to the [configuration page](./config.md)

When done, answer `Y` to create or update your configuration.

Your configuration is now stored under `bin/config.json`. You can re-run the `npm run config` command as needed to update your `config.json`

**Step 4.** (Optional) Bootstrap AWS CDK on the target account and region

> **Note**: This is required if you have never used AWS CDK on this account and region combination. ([More information on CDK bootstrapping](https://docs.aws.amazon.com/cdk/latest/guide/cli.html#cli-bootstrap)).

```bash
npm run cdk bootstrap aws://{targetAccountId}/{targetRegion}
```

You can now deploy by running:

```bash
npm run cdk deploy
```

> **Note**: This step duration can vary greatly, depending on the Constructs you are deploying.

You can view the progress of your CDK deployment in the [CloudFormation console](https://console.aws.amazon.com/cloudformation/home) in the selected region.

## Redeploy with one command:

```bash
npm ci && npm run build && npm run cdk deploy
```

# License

This library is licensed under the MIT-0 License. See the LICENSE file.

- [Changelog](CHANGELOG.md) of the project.
- [License](LICENSE) of the project.
- [Code of Conduct](CODE_OF_CONDUCT.md) of the project.
- [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

Although this repository is released under the  MIT-0 license, its front-end and SQL implementation use the following third party projects:
- [psycopg2-binary](https://github.com/psycopg/psycopg2)
- [jackspeak](https://github.com/isaacs/jackspeak)
- [package-json-from-dist](https://github.com/isaacs/package-json-from-dist)
- [path-scurry](https://github.com/isaacs/path-scurry)

These projects' licensing includes the LGPL v3 and  BlueOak-1.0.0 licenses.