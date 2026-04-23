import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import type { SwaggerOptions } from '@fastify/swagger';
import { baseConfigurationOptions } from "../../configuration.js";
import { FastifySwaggerUiOptions } from "@fastify/swagger-ui";

// Config for the fastify-swagger plugin which generates the OpenAPI spec
export const v3SwaggerConfig: SwaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'DMP Tool REST API',
      description: 'Swagger API for testing the DMP Tool REST API',
      version: '3'
    },
    servers: [{ url: baseConfigurationOptions.domainWithProtocol }],
    tags: [{ name: 'DMP', description: 'DMP related end-points' }],
    components: {
      securitySchemes: {
        apiKeyHeader: {
          type: 'apiKey',
          name: 'authorization',
          in: 'header'
        },
        apiKeyCookie: {
          type: 'apiKey',
          name: 'dmspt',
          in: 'cookie'
        }
      }
    },
    externalDocs: {
      url: 'https://github.com/CDLUC3/dmptool-api',
      description: 'Find more info on the DMP Tool API repository'
    }
  }
};

// Config for the fastify-swagger-ui plugin which serves the Swagger UI
export const v3SwaggerUIConfig: FastifySwaggerUiOptions = {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  },
  uiHooks: {
    onRequest: function (_request: FastifyRequest, _reply: FastifyReply, next: HookHandlerDoneFunction) {
      next()
    },
    preHandler: function (_request: FastifyRequest, _reply: FastifyReply, next: HookHandlerDoneFunction) {
      next()
    }
  },
  staticCSP: true,
  transformStaticCSP: (header: string): string => header,
  transformSpecification: (
    swaggerObject: Readonly<Record<string, unknown>>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: FastifyRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reply: FastifyReply
  ) => {
    return swaggerObject
  },
  transformSpecificationClone: true
};
