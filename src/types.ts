import { ConfigurationOptionsType } from "./configuration.js";

// Add our config to the FastifyInstance and FastifyRequest
declare module 'fastify' {
  export interface FastifyInstance {
    dmptoolConfig: ConfigurationOptionsType;
  }

  export interface FastifyRequest {
    dmptoolConfig: ConfigurationOptionsType;
  }
}
