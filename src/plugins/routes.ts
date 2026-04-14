import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import {
  DELETE_DMP_OPTIONS,
  GET_DMP_OPTIONS,
  GET_DMPS_OPTIONS,
  POST_DMP_OPTIONS,
  PUT_DMP_OPTIONS,
} from "../routeOptions.js";
import { isDmpId } from "../utils.js";
import { convertMySQLDateTimeToRFC3339 } from "@dmptool/utils";

// TODO: Delete these mock responses once the models and business logic are in place
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

/**
 * Encapsulates the routes
 *
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
export const routesPlugin = async function (
  fastify: FastifyInstance
): Promise<void> {
  // Define the 404 handler (based on the RDA Common API specification)
  // This is defined here so that it can be used by these routes. Placing it in
  // the errorPlugin results in conflicts with the community plugins
  fastify.setNotFoundHandler((request, reply) => {
    const hasDmpId: boolean = request.url.includes(fastify.dmptoolConfig.dmpIdShoulder);
    const msg = 'Make sure the DMP id is URL encoded.'
    reply.status(404).send({
      status_code: '404',
      error_code: 'not_found',
      message: `Route ${request.method}:${request.url} not found.${hasDmpId ? ` ${msg}` : ''}`,
    });
  });

  /**
   * Load balancer health check endpoint
   */
  fastify.get(
    '/healthcheck',
    async (_request: FastifyRequest, reply: FastifyReply
    ): Promise<void> => {
      reply.code(200).send({ status_code: '200', message: 'OK' });
    }
  );

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
      reply.code(200).send({ total_count: 1, items: [{ dmp: TEST_DMP }]})
    }
  );

  /**
   * Create a new DMP
   */
  fastify.post(
    `/dmps`,
    {
      ...POST_DMP_OPTIONS,
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 20
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // TODO: Check for authorization and create the DMP (use the Accept header
      //       to determine whether we should return the RDA Common Standard or
      //       the full DMP with DMP Tool extensions)
      //       --
      //       FOR NOW - just return a mock DMP based on the Accept header
      reply.code(201).send({ dmp: TEST_DMP });
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
      const id: string = params ? encodeURIComponent(params.id) : '';

      // If no id was provided, or it is not a valid DMP ID, return a 400 Bad Request
      if (!id || !isDmpId(request.dmptoolConfig, id)) {
        return reply.code(400).send({
          status_code: '400',
          error_code: 'dmp_invalid',
          message: 'Invalid DMP ID'
        });
      }

      // TODO: Handle the `version` in the query string to fetch historical copies

      // TODO: Fetch the DMP from the DynamoDB table (use the Accept header to
      //       determine whether we should return the RDA Common Standard or
      //       the full DMP with DMP Tool extensions)
      //       Only return "public" DMPs if the user is not authenticated
      //       --
      //       FOR NOW - just return a mock DMP based on the Accept header

      // TODO: Implement authorization check if its not a public DMP

      reply.code(200).send({ dmp: TEST_DMP });
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
      const params = request.params as { id: string };
      let modCheck = request.headers['if-unmodified-since'] as string;
      const id: string = params ? encodeURIComponent(params.id) : '';

      // If no id was provided, or it is not a valid DMP ID, return a 400 Bad Request
      if (!id || !isDmpId(request.dmptoolConfig, id)) {
        return reply.code(400).send({
          status_code: '400',
          error_code: 'dmp_invalid',
          message: 'Invalid DMP ID'
        });
      }

      // TODO: Fetch the DMP from the DynamoDB table and check authorization
      //       if authorized, update the DMP (use the Accept header to
      //       determine whether we should return the RDA Common Standard or
      //       the full DMP with DMP Tool extensions)
      //       --
      //       FOR NOW - just return a mock DMP based on the Accept header

      // Convert the If-Unmodified-Since date in the header and the DMP modified date to RFC3339 format
      modCheck = convertMySQLDateTimeToRFC3339(modCheck) as string;
      const modified = convertMySQLDateTimeToRFC3339(TEST_DMP.modified) as string;

      // Check the `If-Unmodified-Since` header and return a 409 Conflict if the
      // DMP has been `modified` since the time specified in the header
      if (modCheck !== modified) {
        return reply.code(409).send({
          status_code: '409',
          error_code: 'conflict',
          message: 'The DMP has been modified since the time specified in the If-Unmodified-Since header'
        });
      }

      // Append a `Last-Modified` header to the response and set its value
      // equal to the `modified` field of the DMP. This is used to verify that
      // the DMP has not changed since the client last fetched it.
      reply.code(200)
        .header('Last-Modified', TEST_DMP.modified)
        .send({ dmp: TEST_DMP });
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
      let modCheck = request.headers['if-unmodified-since'] as string;

      // TODO: Fetch the DMP from the DynamoDB table, check authorization and
      //       then delete if authorized
      //       --
      //       FOR NOW - just return a mock success code

      // Convert the If-Unmodified-Since date in the header and the DMP modified date to RFC3339 format
      modCheck = convertMySQLDateTimeToRFC3339(modCheck) as string;
      const modified = convertMySQLDateTimeToRFC3339(TEST_DMP.modified) as string;

      // Check the `If-Unmodified-Since` header and return a 409 Conflict if the
      // DMP has been `modified` since the time specified in the header
      if (modCheck !== modified) {
        return reply.code(409).send({
          status_code: '409',
          error_code: 'conflict',
          message: 'The DMP has been modified since the time specified in the If-Unmodified-Since header'
        })
      }

      reply.code(204).send();
    }
  );
}
