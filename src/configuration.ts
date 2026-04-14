import dotenv from 'dotenv';
import { LogLevel } from 'fastify';
import { ConfigurationOptions } from "./types.js";

dotenv.config();

const API_PATH_PREFIX: string = process.env.API_PATH_PREFIX || 'api/';
const PORT: number = Number(process.env.PORT) || 4060;
const UI_PORT: number = Number(process.env.UI_PORT) || 3000;
const SHOULDER: string = process.env.DMP_ID_SHOULDER || '0.00000/Z0';
const DOMAIN_NAME: string = process.env.DOMAIN_NAME || `localhost:${UI_PORT}`;
const DOMAIN_WITH_PROTOCOL: string = DOMAIN_NAME.startsWith('http')
  ? DOMAIN_NAME
  : `${DOMAIN_NAME.includes('localhost') ? 'http' : 'https'}://${DOMAIN_NAME}`;

export const LOG_LEVEL: string = process.env.LOG_LEVEL || 'info';

/**
 * Configuration options for the application. These are loaded on startup
 */
export const configurationOptions: ConfigurationOptions = {
  nodeEnv: process.env.NODE_ENV || 'development',
  deploymentEnv: process.env.DEPLOYMENT_ENV || 'dev',
  logLevel: LOG_LEVEL as LogLevel,

  pathPrefix: API_PATH_PREFIX,

  port: PORT,
  uiPort: UI_PORT,

  domainWithProtocol: DOMAIN_WITH_PROTOCOL,
  domainName: DOMAIN_NAME.replace(/https?:\/\//, ''),

  jwtSecret: process.env.JWT_SECRET || 'secret',
  jwtCookieName: process.env.JWT_COOKIE_NAME,

  dmpIdBaseUrl: process.env.DMP_ID_BASE_URL || 'https://doi.org',
  dmpIdShoulder: SHOULDER,

  payloadSizeLimit: Number(process.env.DMP_PAYLOAD_SIZE_LIMIT_MB) || 100,
}
