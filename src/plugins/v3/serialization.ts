import fp from 'fastify-plugin';
import Ajv from 'ajv';
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Negotiator } from '@fastify/accept-negotiator';
import {
  DMP_TOOL_CONTENT_TYPE,
  RDA_COMMON_STANDARD_CONTENT_TYPE,
  negotiatedDmpContent
} from "./routeSchema.js";

// AJV is used here to prune the data object by removing additional properties.
// This is done to remove DMP Tool specific properties from the payload when
// we need to return the RDA Common Standard format.
const ajvRDA = new Ajv({ removeAdditional: 'all', useDefaults: true });
const ajvDMPTool = new Ajv({ useDefaults: true });

const pruneDataWithAjv = (
  compiler: typeof ajvRDA,
  data: unknown,
  schema: object
): unknown => {
  // Validate the payload against the appropriate schema
  const validate = compiler.compile(schema);

  // Clone payload to avoid mutating the original source
  const dataToPrune = JSON.parse(JSON.stringify(data));
  validate(dataToPrune);

  // Return the pruned object
  return dataToPrune;
}

// Wrapping this in fastify-plugin to ensure that its hooks are registered and
// available within the context of the v3Routes plugin.
const v3SerializationPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  const supportedAcceptHeaders = [
    DMP_TOOL_CONTENT_TYPE,
    RDA_COMMON_STANDARD_CONTENT_TYPE,
    'application/json'
  ];

  // Validate the incoming Accept header and set the Content-Type header
  fastify.addHook('onRequest', async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> => {
    // If the caller is accessing the Swagger UI, don't try to negotiate anything
    if (request.url.startsWith('/api/v3/documentation')) {
      return;
    }

    const rawAcceptHeader = request.headers['accept'];

    // Check if the header is missing OR is the wildcard */*.
    // If so default to RDA_COMMON_STANDARD
    if (!rawAcceptHeader || rawAcceptHeader === '*/*') {
      reply.type(RDA_COMMON_STANDARD_CONTENT_TYPE);
      return;
    }

    // Use the Negotiator to parse through the Accept headers
    const negotiator = new Negotiator({
      supportedValues: supportedAcceptHeaders,
      cache: new Map()
    });
    const acceptHeader: string | null = negotiator.negotiate(request.headers['accept'] || '');

    // If it returned null, then an Accept header we don't support was provided
    if (!acceptHeader) {
      // Use return and send here to short-circuit the rest of the hooks
      return reply.status(406).send({
        status_code: 406,
        error_code: 'not_acceptable',
        message: 'The server does not support any of the requested content types.'
      });
    }

    const targetType = acceptHeader === DMP_TOOL_CONTENT_TYPE
      ? acceptHeader
      : RDA_COMMON_STANDARD_CONTENT_TYPE;

    reply.type(targetType);
  });

  // Serialize the outgoing payload
  fastify.addHook('preSerialization', async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ): Promise<unknown> => {
    // If we are handling an error, don't try to change anything
    if (reply.statusCode >= 400) return payload;

    // If the caller is accessing the Swagger UI, don't try to change anything
    if (request.url.startsWith('/api/v3/documentation')) {
      return payload;
    }

    // If the payload is a DMP
    if (payload && typeof payload === 'object' && 'dmp' in payload) {
      const targetType = (reply.getHeader('content-type') as string)?.split(';')[0]
        || RDA_COMMON_STANDARD_CONTENT_TYPE;

      const schema = negotiatedDmpContent[targetType as keyof typeof negotiatedDmpContent];
      // Use the target type to determine which Ajv validator to use
      const ajv = targetType === DMP_TOOL_CONTENT_TYPE ? ajvDMPTool : ajvRDA;

      if (schema) {
        return pruneDataWithAjv(ajv, payload, schema);
      }
    }

    // Otherwise just return the payload as-is
    return payload;
  });

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('V3 Serialization Plugin has been registered.');
  });
});

export default v3SerializationPlugin;
