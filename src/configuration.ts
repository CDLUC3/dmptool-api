import dotenv from 'dotenv';
import { LogLevel } from 'fastify';

dotenv.config();

const DEFAULT_NODE_ENV = 'development';
const DEFAULT_DEPLOYMENT_ENV = 'dev';
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_API_PATH_PREFIX = 'api/'
const DEFAULT_PORT = 4060;
const DEFAULT_DOMAIN_NAME = `localhost`;
const DEFAULT_DMP_ID_BASE_URL = 'https://doi.org';
const DEFAULT_DMP_ID_SHOULDER = '00.00000/Z0';

const API_PATH_PREFIX: string = process.env.API_PATH_PREFIX || DEFAULT_API_PATH_PREFIX;
const PORT: number = Number(process.env.PORT) || DEFAULT_PORT;
const UI_PORT: number = Number(process.env.UI_PORT) || 3000;
const SHOULDER: string = process.env.DMP_ID_SHOULDER || DEFAULT_DMP_ID_SHOULDER;
const DOMAIN_NAME: string = process.env.DOMAIN_NAME || `${DEFAULT_DOMAIN_NAME}:${UI_PORT}`;
const DOMAIN_WITH_PROTOCOL: string = DOMAIN_NAME.startsWith('http')
  ? DOMAIN_NAME
  : `${DOMAIN_NAME.includes('localhost') ? 'http' : 'https'}://${DOMAIN_NAME}`;

export const LOG_LEVEL: string = process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL;

/**
 * Configuration options for the application. These are loaded on startup
 */
export const configurationOptions = {
  nodeEnv: process.env.NODE_ENV || DEFAULT_NODE_ENV,
  deploymentEnv: process.env.DEPLOYMENT_ENV || DEFAULT_DEPLOYMENT_ENV,
  logLevel: LOG_LEVEL as LogLevel,

  pathPrefix: API_PATH_PREFIX,

  port: PORT,
  uiPort: UI_PORT,

  domainWithProtocol: DOMAIN_WITH_PROTOCOL,
  domainName: DOMAIN_NAME.replace(/https?:\/\//, ''),

  jwtSecret: process.env.JWT_SECRET,

  dmpIdBaseUrl: process.env.DMP_ID_BASE_URL || DEFAULT_DMP_ID_BASE_URL,
  dmpIdShoulder: SHOULDER
}

export type ConfigurationOptionsType = typeof configurationOptions;
