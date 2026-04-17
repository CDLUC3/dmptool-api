import type {
  FastifyError,
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
import { DMPToolDMPType } from "@dmptool/types";
import {
  convertMySQLDateTimeToRFC3339,
  DMP_LATEST_VERSION,
  DMPExists, DynamoConnectionParams,
  randomHex
} from "@dmptool/utils";
import { AccessiblePlan, Plan, User } from "../types.js";
import {
  callerHasPermission,
  handleMissingMaDMP,
  loadMaDMPFromDynamo,
  loadPlan,
  loadPlansForCaller,
  loadPlansForUser, userHasPermission,
} from "../models/maDMP.js";
import { errorHandler, notFoundHandler } from "../handlers/error.js";
import {Logger} from "pino";

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
const routesPlugin = async function (
  fastify: FastifyInstance
): Promise<void> {
  // Add the basic request information for logging purposes
  fastify.addHook('preHandler', async (request: FastifyRequest): Promise<void> => {
    const requestId = randomHex(16);

    request.log = request.log.child({
      app: request.dmptoolConfig.applicationName?.toLowerCase()?.replace(' ', '-'),
      env: request.dmptoolConfig.deploymentEnv,
      // Generate a random request ID to help us follow a request through the logs
      requestId,
      caller: request.caller,
      user: request.user as User,
      url: request.url,
    });

    // Update the nested loggers that will be passed through to the @dmptool/utils
    if (request.dmptoolConfig.dynamo) request.dmptoolConfig.dynamo.logger = request.log as Logger;
    if (request.dmptoolConfig.rds) request.dmptoolConfig.rds.logger = request.log as Logger;
    if (request.dmptoolConfig.ssm) request.dmptoolConfig.ssm.logger = request.log as Logger;
  });

  // Define error handlers (based on the RDA Common API specification)
  // They are defined here so that it is specific to the prefix (e.g. `/api/v3`)
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
      const query = request.query as { version: string };
      const id: string = params ? params.id : '';
      const version: string = query ? query.version : '';

      // If no id was provided, or it is not a valid DMP ID, return a 400 Bad Request
      if (!id || !isDmpId(request.dmptoolConfig, encodeURIComponent(id))) {
        return reply.code(400).send({
          status_code: 400,
          error_code: 'dmp_invalid',
          message: 'Invalid DMP ID'
        });
      }

      // TODO: Fetch the DMP from the DynamoDB table (use the Accept header to
      //       determine whether we should return the RDA Common Standard or
      //       the full DMP with DMP Tool extensions)
      //       Only return "public" DMPs if the user is not authenticated
      //       --
      //       FOR NOW - just return a mock DMP based on the Accept header

      // TODO: Implement authorization check if its not a public DMP

      // First: load high-level info about the DMP from the MySQL database
      const plan: Plan | undefined = await loadPlan(request, id);
      if (!plan) {
        request.log.warn({ dmpId: id }, "No Plan found");
        // We return 404 here so that we're not signaling which DMP ids are valid
        reply.code(404).send({
          status_code: 404,
          error_code: "dmp_not_found",
          message: "DMP not found"
        });
        return;
      }

      // Second: load the DMP ids that the user or caller has access to
      const plans: AccessiblePlan[] = request.user
        ? await loadPlansForUser(request)
        : await loadPlansForCaller(request);

      request.log.debug(
        { dmpId: id, planId: plan.id, nbrAccessiblePlans: plans.length },
        'Retrieved Plan data from RDS'
      );

      // Third: fetch the latest maDMP record for the Plan from the DynamoDB table
      let maDMP: DMPToolDMPType | undefined = await loadMaDMPFromDynamo(
        request,
        plan.dmpId,
        DMP_LATEST_VERSION
      );
      request.log.debug(
        { dmpId: id, maDMPModified: maDMP?.dmp?.modified },
        'Retrieved maDMP metadata from DynamoDB'
      );

      // Four: Determine if the maDMP was missing or is out of date or missing the narrative.
      // If so, generate the current maDMP and update the DynamoDB record.
      const rdsDate: string | null = convertMySQLDateTimeToRFC3339(plan?.modified);
      if (!maDMP || rdsDate !== maDMP?.dmp?.modified || !maDMP?.dmp?.narrative) {
        const outdated: boolean = maDMP?.dmp?.modified && rdsDate !== maDMP?.dmp?.modified
        request.log.debug(
          { dmpId: id },
          `DMP metadata is ${outdated ? 'outdated' : 'missing'}`
        );
        maDMP = await handleMissingMaDMP(request, plan, outdated);
      }

      // If the maDMP record could not be generated or retrieved, we need to bail out
      if (!maDMP || !maDMP.dmp) {
        request.log.error({ dmpId: id }, "Unable to generate narrative for DMP");
        reply.code(500).send({
          status_code: 500,
          error_code: "generic_error",
          message: "Unable to process your request. Please try again later."
        });
        return;
      }

      // Determine if the caller has permission to view the DMP
      const hasPermission = request.user
        ? userHasPermission(maDMP, plans, request.user as User)
        : callerHasPermission(maDMP, plans, request.caller || '');

      if (!hasPermission) {
        request.log.debug({ dmpId: id }, "User/Caller does not have permission to view the DMP");
        // We return 404 here so that we're not signaling which DMP ids are valid
        reply.code(404).send({
          status_code: 404,
          error_code: "dmp_not_found",
          message: "DMP not found"
        });
        return;
      }

      reply.code(200).send(maDMP);
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

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('Routes have been registered.');
  });
};

export default routesPlugin;
