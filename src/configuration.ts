import dotenv from 'dotenv';
import { LogLevel } from 'fastify';
import { stringToInteger } from "./utils.js";

dotenv.config();

const API_PATH_PREFIX: string = process.env.API_PATH_PREFIX || 'api/';
const PORT: number = stringToInteger(process.env.PORT) || 4060;
const UI_PORT: number = stringToInteger(process.env.UI_PORT) || 3000;
const SHOULDER: string = process.env.DMP_ID_SHOULDER || '00.00000/Z0';
const DOMAIN_NAME: string = process.env.DOMAIN_NAME || `localhost:${UI_PORT}`;
const DOMAIN_WITH_PROTOCOL: string = DOMAIN_NAME.startsWith('http')
  ? DOMAIN_NAME
  : `${DOMAIN_NAME.includes('localhost') ? 'http' : 'https'}://${DOMAIN_NAME}`;

export const LOG_LEVEL: string = process.env.LOG_LEVEL || 'info';

/**
 * Configuration options for the application. These are loaded on startup
 */
export const configurationOptions = {
  nodeEnv: process.env.NODE_ENV || 'development',
  deploymentEnv: process.env.DEPLOYMENT_ENV || 'dev',
  logLevel: LOG_LEVEL as LogLevel,

  pathPrefix: API_PATH_PREFIX,

  port: PORT,
  uiPort: UI_PORT,

  applicationName: process.env.APPLICATION_NAME || 'my-api',
  domainWithProtocol: DOMAIN_WITH_PROTOCOL,
  domainName: DOMAIN_NAME.replace(/https?:\/\//, ''),

  jwtSecret: process.env.JWT_SECRET,

  dmpIdBaseUrl: process.env.DMP_ID_BASE_URL || 'https://doi.org',
  dmpIdShoulder: SHOULDER,

  rdsHost: process.env.RDS_HOST || '127.0.0.1',
  rdsPort: stringToInteger(process.env.RDS_PORT) || 3306,
  rdsUser: process.env.RDS_USERNAME || 'root',
  rdsPassword: process.env.RDS_PASSWORD || '',
  rdsDatabase: process.env.RDS_DATABASE || 'dmp',
}

export type ConfigurationOptionsType = typeof configurationOptions;
