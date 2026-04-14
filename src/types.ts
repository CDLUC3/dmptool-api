// Add our config to the FastifyInstance and FastifyRequest
import { LogLevel } from "fastify";

declare module 'fastify' {
  export interface FastifyInstance {
    dmptoolConfig: ConfigurationOptions;
  }

  export interface FastifyRequest {
    dmptoolConfig: ConfigurationOptions;
  }
}

// The structure of an API error
export interface ApiError {
  status_code: number;
  error_code: string;
  message: string;
}

// The structure of the configuration options for this API
export interface ConfigurationOptions {
  nodeEnv: string;
  deploymentEnv: string;
  logLevel: LogLevel;

  pathPrefix: string;

  port: number;
  uiPort: number;

  domainWithProtocol: string;
  domainName: string;

  jwtSecret: string;
  jwtCookieName?: string;

  dmpIdBaseUrl: string;
  dmpIdShoulder: string;

  payloadSizeLimit: number;
}
