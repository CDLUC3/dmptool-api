import type {
  FastifyInstance, FastifyReply, FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { configurationOptions } from "../configuration.js";

/**
 * Plugin that registers the Swagger plugin to generate the OpenAPI specification
 * and Swagger UI.
 *
 * @param {FastifyInstance} fastify Encapsulated Fastify Instance
 */
export const swaggerPlugin = async function (
  fastify: FastifyInstance
): Promise<void> {
  // Register the Swagger plugin to help generate the OpenAPI specification
  await fastify.register(import('@fastify/swagger'), {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'DMP Tool REST API',
        description: 'Swagger API for testing the DMP Tool REST API',
        version: '0.1.0'
      },
      servers: [
        {
          url: configurationOptions.domainWithProtocol
        }
      ],
      tags: [
        { name: 'DMP', description: 'DMP related end-points' }
      ],
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
  });

  // TODO: For some reason Swagger is not generating the correct OpenAPI specification
  //       the UI loads but there are no endpoints

  // Set up the Swagger UI
  await fastify.register(import('@fastify/swagger-ui'), {
    routePrefix: `${configurationOptions.pathPrefix}/documentation`,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      swaggerObject: Readonly<Record<string, any>>,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _request: FastifyRequest,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _reply: FastifyReply
    ) => {
      return swaggerObject
    },
    transformSpecificationClone: true
  })
}
