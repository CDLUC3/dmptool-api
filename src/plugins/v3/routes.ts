import Ajv from 'ajv';
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  FastifySchemaValidationError
} from 'fastify';
import { ValidationFunction } from "fastify/types/request.js";
import { FastifyRouteSchemaDef } from "fastify/types/schema.js";
import {
  DELETE_DMP_OPTIONS,
  DMP_TOOL_CONTENT_TYPE,
  GET_DMP_OPTIONS,
  GET_DMPS_OPTIONS,
  POST_DMP_OPTIONS,
  POST_VALIDATE_OPTIONS,
  PUT_DMP_OPTIONS,
  RDA_COMMON_STANDARD_CONTENT_TYPE,
} from "./routeSchema.js";
import { DMPToolDMPType } from "@dmptool/types";
import v3SerializationPlugin from "./serialization.js";
import { v3SwaggerConfig, v3SwaggerUIConfig } from "./swagger.js";
import {
  ERROR_CODE_INTERNAL_SERVER,
  ERROR_CODE_INVALID_DMP,
  ERROR_CODE_UNAUTHENTICATED, ERROR_MSG_INTERNAL_SERVER,
  ERROR_MSG_UNAUTHENTICATED,
  errorHandler,
  newFastifyError,
  notFoundHandler
} from "../../handlers/error.js";
import { decorateLog } from "../../handlers/logger.js";
import { isDmpId } from "../../utils.js";
import { ConfigurationOptions } from "../../types.js";
import {
  createPlanWorkflow, deleteDmpWorkflow, getPlanWorkflow,
  updateDmpWorkflow
} from "./workflows/planWorkflow.js";

const isAuthenticatedUser = (request: FastifyRequest): boolean => {
  return !!request.user && typeof request.user === 'object' && Object.keys(request.user as object).length > 0;
}

// TODO: Delete this mock responses once the models and business logic are in place
const TEST_DMP = {
  // These are RDA Common Standard fields and should always be returned
  title: 'Test DMP',
  dmp_id: {
    identifier: 'test-dmp-id',
    type: 'other'
  },
  created: '2021-01-01 03:11:23Z',
  modified: '2021-01-01 02:23:11Z',
  ethical_issues_exist: 'unknown',
  language: 'eng',
  contact: {
    name: 'Test Contact',
    mbox: 'tester@example.com',
    contact_id: [{
      identifier: '123456789',
      type: 'other'
    }]
  },
  dataset: [{
    title: 'Test Dataset',
    dataset_id: {
      identifier: '123',
      type: 'other'
    },
    personal_data: 'unknown',
    sensitive_data: 'no',
  }],

  // If the Accept header is `application/vnd.org.rd-alliance.dmp-common.v1.2+json` then
  // these fields should not be returned, if it is `application/vnd.org.dmptool.v1.2+json`
  // then these fields should be returned
  rda_schema_version: "1.2",
  provenance: 'dmptool',
  status: 'draft',
  privacy: 'public',
  featured: 'no',
};

// Needed to use AJV directly for the `POST /dmps/validate` endpoint, otherwise
// it just returns the first error.
//
// Note that useDefaults allows the interpreter to see that we have defaults set
// in Zod so it won't flag that the value is missing/empty
const ajvWithFullErrors = new Ajv({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true
});

/**
 * Encapsulates the routes
 *
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
const v3RoutesPlugin = async function (
  fastify: FastifyInstance
): Promise<void> {
  const config: ConfigurationOptions = fastify.dmptoolConfig;

  // Swagger is a community plugin, we only register it in non-prod environments
  if (config.deploymentEnv !== 'prd') {
    await fastify.register(import('@fastify/swagger'), v3SwaggerConfig);
    await fastify.register(import('@fastify/swagger-ui'), v3SwaggerUIConfig);

    // Kind of annoying, but Swagger UI returns a 404 if the trailing slash is omitted
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply): Promise<undefined> => {
      if (request.url === '/api/v3/documentation') {
        return reply.redirect('/api/v3/documentation/', 301);
      }
    });
  }

  // Register the content types we support (`application/json` is supported by default)
  fastify.addContentTypeParser(
    [RDA_COMMON_STANDARD_CONTENT_TYPE, DMP_TOOL_CONTENT_TYPE],
    { parseAs: 'string' },
    fastify.getDefaultJsonParser('error', 'ignore')
  );

  // Add the basic request information for logging purposes
  fastify.addHook('preHandler', async (request: FastifyRequest): Promise<void> => {
    decorateLog(request);
  });

  // Define error handlers (based on the RDA Common API specification)
  // They are defined here so that it is specific to the prefix (e.g. `/api/routes`)
  // Fastify has collision issues if they are defined at the top level
  fastify.setNotFoundHandler((
    request: FastifyRequest,
    reply: FastifyReply,
  ): void => {
    notFoundHandler(request, reply, fastify.dmptoolConfig.dmpIdShoulder);
  });

  fastify.setErrorHandler((
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ): void => {
    errorHandler(request, reply, error);
  });

  fastify.register(v3SerializationPlugin, { logLevel: config.logLevel });

  /**
   * Search for DMPs based on filters
   */
  fastify.get(
    `/dmps`,
    {
      ...GET_DMPS_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 60
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {

      // TODO: Query for DMPs matching the filters provided (use the Accept
      //       header to determine whether we should return the RDA Common Standard
      //       or the full DMP with DMP Tool extensions)
      //       Only return "public" DMPs if the user is not authenticated
      //       --
      //       FOR NOW - just return a mock DMP based on the Accept header
      await reply.code(200).send({ total_count: 1, items: [{ dmp: TEST_DMP }]})
    }
  );

  fastify.post(
    '/dmps',
    {
      ...POST_DMP_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 20
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!isAuthenticatedUser(request)) {
        request.log.debug('An attempt to create a new DMP was made by an unauthenticated caller');
        throw newFastifyError(ERROR_CODE_UNAUTHENTICATED, ERROR_MSG_UNAUTHENTICATED);
      }

      request.log.debug({ body: request.body }, 'POST /dmps called.')
      const result: DMPToolDMPType = await createPlanWorkflow(request, request.body as DMPToolDMPType);
      request.log.debug(
        { dmpId: result?.dmp?.dmp_id?.identifier, title: result?.dmp?.title },
        'POST: maDMP has been created'
      );

      // Should never happen, an error will normally be thrown, but just in case
      // the response was undefined, throw an error
      if (!result) {
        request.log.fatal('An unknown error occurred during DMP creation');
        throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, 'Unable to create DMP');
      }

      await reply.code(201).send(result);
    }
  );

  /**
   * Fetch a DMP based on its ID.
   * @param id
   */
  fastify.get(
    `/dmps/:id(.+)`,
    {
      ...GET_DMP_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const params = request.params as { id: string };
      const query = request.query as { version: string };
      const id: string = params ? params.id : '';
      const version: string = query ? query.version : '';

      request.log.debug({ id, version }, 'GET /dmps/:id(.+) called.')

      // If no id was provided, or it is not a valid DMP ID, return a 400 Bad Request
      if (!id || !isDmpId(request.dmptoolConfig, encodeURIComponent(id))) {
        request.log.error({ dmpId: params.id }, 'Invalid DMP ID');
        throw newFastifyError(ERROR_CODE_INVALID_DMP, 'Invalid DMP id');
      }

      // Fetch the requested maDMP record
      const maDMP: DMPToolDMPType = await getPlanWorkflow(request, id, version);

      // Return the maDMP record along with the Last-Modified header so the caller can send a subsequent update
      await reply.code(200)
        .header('Last-Modified', maDMP.dmp.modified)
        .send(maDMP);
    }
  );

  /**
   * Update a DMP based on its ID.
   */
  fastify.put(
    `/dmps/:id(.+)`,
    {
      ...PUT_DMP_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 20
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!isAuthenticatedUser(request)) {
        request.log.debug('An attempt to update an existing DMP was made by an unauthenticated caller');
        throw newFastifyError(ERROR_CODE_UNAUTHENTICATED, ERROR_MSG_UNAUTHENTICATED);
      }

      const params = request.params as { id: string };
      const id: string = params ? params.id : '';
      const payload = request.body as DMPToolDMPType;
      const modCheck = request.headers['if-unmodified-since'] as string;

      request.log.debug({ dmpId: id }, 'PUT /dmps/:id(.+) called.')

      // If no id was provided, or it is not a valid DMP ID, return a 400 Bad Request
      if (!id || !isDmpId(request.dmptoolConfig, encodeURIComponent(id))) {
        request.log.error({ dmpId: params.id }, 'Invalid DMP ID');
        throw newFastifyError(ERROR_CODE_INVALID_DMP, 'Invalid DMP id');
      }

      // Replace the maDMP record
      const updatedDMP: DMPToolDMPType = await updateDmpWorkflow(request, id, modCheck, payload);
      request.log.debug({ dmpId: id, title: updatedDMP.dmp?.title }, 'PUT: maDMP has been replaced');

      // Return the maDMP record along with the Last-Modified timestamp
      await reply.code(200)
        .header('Last-Modified', updatedDMP.dmp.modified)
        .send(updatedDMP);
    }
  );

  /**
   * Delete a DMP based on its ID.
   */
  fastify.delete(
    `/dmps/:id(.+)`,
    {
      ...DELETE_DMP_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 5
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!isAuthenticatedUser(request)) {
        request.log.debug('An attempt to delete an existing DMP was made by an unauthenticated caller');
        throw newFastifyError(ERROR_CODE_UNAUTHENTICATED, ERROR_MSG_UNAUTHENTICATED);
      }

      const params = request.params as { id: string };
      const id: string = params ? params.id : '';
      const modCheck = request.headers['if-unmodified-since'] as string;

      request.log.debug({ dmpId: id }, 'DELETE /dmps/:id(.+) called.')

      // If no id was provided, or it is not a valid DMP ID, return a 400 Bad Request
      if (!id || !isDmpId(request.dmptoolConfig, encodeURIComponent(id))) {
        request.log.error({ dmpId: params.id }, 'Invalid DMP ID');
        throw newFastifyError(ERROR_CODE_INVALID_DMP, 'Invalid DMP id');
      }

      // Replace the maDMP record
      if (!(await deleteDmpWorkflow(request, id, modCheck))) {
        request.log.error({ dmpId: id }, 'Unable to delete the maDMP');
        throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, ERROR_MSG_INTERNAL_SERVER);
      }

      request.log.debug({ dmpId: id }, 'DELETE: maDMP has been deleted');
      await reply.code(204).send();
    }
  );

  /**
   * Validate a DMP JSON document.
   *
   * @param body The DMP JSON document to validate
   * @returns A 200 OK response if the DMP is valid, otherwise a 400 Bad Request response
   */
  fastify.post(
    '/dmps/validate',
    {
      ...POST_VALIDATE_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 10
        }
      },
      // Override the validator for just this route.
      // This one will return ALL errors, not just the first one.
      validatorCompiler: ({ schema }: FastifyRouteSchemaDef<NoInfer<FastifySchema>>) => {
        const validate = ajvWithFullErrors.compile(schema) as ValidationFunction;
        return (data: DMPToolDMPType) => {
          const isValid: boolean = validate(data);
          if (isValid) {
            return { value: data };
          }

          return {
            error: (validate.errors ?? []) as FastifySchemaValidationError[]
          };
        };
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await reply.code(200).send({
        status_code: 200,
        message: 'DMP is valid'
      });
    }
  );

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('V3 have been registered.');
  });
};

export default v3RoutesPlugin;
