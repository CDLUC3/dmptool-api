import dotenv from 'dotenv';
import { Logger } from 'pino';
import { stringToInteger } from "./utils.js";
import {FastifyInstance, LogLevel} from 'fastify';
import { ConfigurationOptions } from "./types.js";
import { EnvironmentEnum, getSSMParameter, SsmConnectionParams } from "@dmptool/utils";

dotenv.config();

const AWS_REGION: string = process.env.AWS_REGION || 'us-west-2';
const SHOULDER: string = process.env.DMP_ID_SHOULDER || '0.00000/Z0';

const API_V3_PATH_PREFIX: string = process.env.API_V3_PATH_PREFIX || '/api/routes';
const API_PORT: number = stringToInteger(process.env.API_PORT) || 4060;
const API_DOMAIN: string = process.env.API_DOMAIN || `localhost:${API_PORT}`;
const API_DOMAIN_WITH_PROTOCOL: string = API_DOMAIN.startsWith('http')
  ? API_DOMAIN
  : `${API_DOMAIN.includes('localhost') ? 'http' : 'https'}://${API_DOMAIN}`;

const NARRATIVE_DOWNLOAD_PORT: number = stringToInteger(process.env.NARRATIVE_DOWNLOAD_PORT) || 4030;
const LANDING_PAGE_PORT: number = stringToInteger(process.env.LANDING_PAGE_PORT) || 4020;

export const LOG_LEVEL: string = process.env.LOG_LEVEL || 'info';

/**
 * Configuration options for the application. These are loaded on startup
 */
export const baseConfigurationOptions: ConfigurationOptions = {
  // The Node environment (development, test, production)
  nodeEnv: process.env.NODE_ENV || 'development',
  // The deployment environment (dev, stg, prd)
  deploymentEnv: process.env.DEPLOYMENT_ENV || 'dev',
  // The desired logging level (trace, debug, info, warn, error, fatal)
  logLevel: LOG_LEVEL as LogLevel,

  // The prefix to the API endpoints (e.g. /api/v1)
  pathPrefixes: {
    v3: API_V3_PATH_PREFIX
  },

  // The port the API will listen to (e.g. 4060)
  port: API_PORT,

  // The name of this application
  applicationName: process.env.APPLICATION_NAME || 'my-api',
  // The identifier of the default system that will be used to set the provenance
  // of data the system will use the true identifier of the system that is sending
  // the request when possible
  defaultCaller: process.env.DEFAULT_CALLER || 'some-system',

  // The domain of the API (e.g. https://api.example.com))
  domainWithProtocol: API_DOMAIN_WITH_PROTOCOL,
  domainName: API_DOMAIN.replace(/https?:\/\//, ''),

  // The secret required to decode the JWT token
  jwtSecret: process.env.JWT_SECRET || 'secret',
  // The name of the cookie that contains the JWT token
  jwtCookieName: process.env.JWT_COOKIE_NAME,

  // The base URL of registered DMP Ids (e.g. https://doi.org))
  dmpIdBaseUrl: process.env.DMP_ID_BASE_URL || 'https://doi.org',
  // The DOI shoulder to use for DMP Ids (e.g. 0.00000/Z0)
  dmpIdShoulder: SHOULDER,

  // The maximum size of a maDMP JSON payload (in MB)
  payloadSizeLimit: stringToInteger(process.env.DMP_PAYLOAD_SIZE_LIMIT_MB) || 10,

  // The domain and port where the DMP narrative can be downloaded from
  narrativeDownloadDomain: process.env.NARRATIVE_DOWNLOAD_DOMAIN || 'localhost',
  narrativeDownloadPort: NARRATIVE_DOWNLOAD_PORT,

  landingPageDomain: process.env.LANDING_PAGE_DOMAIN || 'localhost',
  landingPagePort: LANDING_PAGE_PORT,
}

/**
 * Splice the Fastify logger into the RDS and Dynamo configuration options
 *
 * @param fastify the Fastify instance
 * @returns the configuration options
 * @throws Error if the SSM or RDS configuration is missing
 */
export const loadFullConfigurationOptions = async (
  fastify: FastifyInstance
): Promise<ConfigurationOptions> => {
  const baseConfig: ConfigurationOptions = baseConfigurationOptions;
  const env: EnvironmentEnum = baseConfig.deploymentEnv as EnvironmentEnum;
  const ssmConfig: SsmConnectionParams = {
    logger: fastify.log as Logger,
    region: AWS_REGION,
    useTLS: process.env.SSM_ENDPOINT === undefined,
    endpoint: process.env.SSM_ENDPOINT,
  };

  // Verify that the SSM configuration is provided
  if (!ssmConfig) {
    fastify.log.error('SSM configuration is required');
    throw new Error('No SSM configuration provided');
  }

  const rdsUser: string | undefined = await getSSMParameter(ssmConfig, 'RdsUsername', env);
  const rdsPwd: string | undefined = await getSSMParameter(ssmConfig, 'RdsPassword', env);

  // Verify that the RDS configuration is provided
  if (!rdsUser || !rdsPwd) {
    fastify.log.error('RDS configuration is required');
    throw new Error('No RDS configuration provided');
  }

  return {
    ...baseConfig,
    // The configuration options for the SSM parameter store
    ssm: ssmConfig,
    // The configuration options for the RDS database
    rds: {
      logger: fastify.log as Logger,
      host: process.env.RDS_HOST || '127.0.0.1',
      port: stringToInteger(process.env.RDS_PORT) || 3306,
      user: rdsUser,
      password: rdsPwd,
      database: process.env.RDS_DATABASE || 'dmp',
    },
    // The configuration options for the DynamoDB database
    dynamo: {
      logger: fastify.log as Logger,
      region: AWS_REGION,
      tableName: process.env.DYNAMODB_TABLE_NAME || 'dmp',
      endpoint: process.env.DYNAMODB_ENDPOINT,
      maxAttempts: stringToInteger(process.env.DYNAMO_MAX_ATTEMPTS) || 3
    }
  };
}

