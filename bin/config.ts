import { error } from "console";
import { SupportedRegion, SystemConfig } from "../lib/shared/types";
import { existsSync, readFileSync } from "fs";

export function getConfig(): SystemConfig {
  if (existsSync("./bin/config.json")) {
    return JSON.parse(
      readFileSync("./bin/config.json").toString("utf8")
    ) as SystemConfig;
  }

  error("No config file found");
  process.exit(1);
  // Default config
  return {
    prefix: "Oct2025",
    /* vpc: {
       vpcId: "vpc-00000000000000000",
       createVpcEndpoints: true,
       vpcDefaultSecurityGroup: "sg-00000000000"
    },*/
    createCMKs: true,
    retainOnDelete: false,
    ddbDeletionProtection: false,
    privateWebsite: false,
    certificate: "arn:aws:acm:us-east-1:811289587868:certificate/9289690e-e98b-4b19-a336-35c36dfb7a82",
    advancedMonitoring: false,
    logRetention: 7,
    rateLimitPerIP: 400,
    domain: "ai-launchpad.boston.gov",
    cognitoFederation: {
      enabled: true,
      autoRedirect: true,
      customProviderName: "Boston",
      customProviderType: "OIDC",
      customOIDC: {
        OIDCClient: "GenAI",
        OIDCSecret: "arn:aws:secretsmanager:us-east-1:811289587868:secret:prod/2025-genai-sandbox/cognito-vhJzEb",
        OIDCIssuerURL: "https://sso.boston.gov"
      },
      cognitoDomain: "llm-cb-c0fc39ec80aebc2d"
    },
    cfGeoRestrictEnable: false,
    cfGeoRestrictList: [],
    bedrock: {
      enabled: true,
      region: SupportedRegion.US_EAST_1,
      guardrails: {
        enabled: true,
        identifier: "oct2025-launchpad-guardrail",
        version: "DRAFT"
      }
    },
    llms: {
      rateLimitPerIP: 100,
      sagemaker: [],
      huggingfaceApiSecretArn: ""
    },
    rag: {
      crossEncodingEnabled: true,
      enabled: true,
      deployDefaultSagemakerModels: false,
      engines: {
        aurora: {
          enabled: false
        },
        opensearch: {
          enabled: true
        },
        kendra: {
          enabled: false,
          createIndex: false,
          external: [],
          enterprise: false
        },
        knowledgeBase: {
          enabled: false,
          external: []
        }
      },
      embeddingsModels: [
        {
          provider: "bedrock",
          name: "amazon.titan-embed-text-v1",
          dimensions: 1536,
          default: false
        },
        {
          provider: "bedrock",
          name: "amazon.titan-embed-image-v1",
          dimensions: 1024,
          default: false
        },
        {
          provider: "bedrock",
          name: "cohere.embed-english-v3",
          dimensions: 1024,
          default: true
        },
        {
          provider: "bedrock",
          name: "cohere.embed-multilingual-v3",
          dimensions: 1024,
          default: false
        },
        {
          provider: "openai",
          name: "text-embedding-ada-002",
          dimensions: 1536,
          default: false
        }
      ],
      crossEncoderModels: [
        {
          provider: "sagemaker",
          name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
          default: true
        }
      ]
    }
  }
}

export const config: SystemConfig = getConfig();
