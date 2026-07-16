import fp from 'fastify-plugin';
import Ajv from 'ajv';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import { Negotiator } from '@fastify/accept-negotiator';
import {
  ERROR_CODE_NOT_ACCEPTABLE,
  newFastifyError
} from "../../handlers/error.js";
import {
  DMP_TOOL_CONTENT_TYPE,
  RDA_COMMON_STANDARD_CONTENT_TYPE,
  negotiatedDmpContent
} from "./routeSchema.js";

// AJV is used here to prune the data object by removing additional properties.
// This is done to remove DMP Tool specific properties from the payload when
// we need to return the RDA Common Standard format.
//
// The "useDefaults" flag allows the interpreter to notice that our Zod schema
// provides defaults for required fields in the DMP Tool extensions, so it doesn't
// need to throw an error it if they are missing in the JSON
const ajvRDA = new Ajv({ removeAdditional: 'all', useDefaults: true });
const ajvDMPTool = new Ajv({ useDefaults: true });

/**
 * We always generate the full RDA Common Standard with the DMP Tool extensions.
 * This function strips off the DMP Tool extensions if the caller just wants the
 * RDA Common Standard.
 *
 * @param compiler The AJV compiler to use
 * @param data The data object to prune
 * @param schema The schema to use for validation and pruning
 * @returns The pruned data object
 */
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

/**
 * Provides serialization logic for requests. We are wrapping this in fastify-plugin
 * to ensure that its hooks are registered and available within the context of
 * the v3Routes plugin.
 *
 * @param fastify The Fastify instance
 */
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
      throw newFastifyError(ERROR_CODE_NOT_ACCEPTABLE, 'Unsupported Accept Header');
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

    // If we are not in prod mode, send headers telling the client not to aggressively cache
    /*
    if (process.env.NODE_ENV !== 'production') {
      await reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      await reply.header('Pragma', 'no-cache');
      await reply.header('Expires', '0');
    }
    */

    // If the payload is a DMP
    if (payload && typeof payload === 'object' && 'dmp' in payload) {
      // Fastify will always use the default content-type regardless of what the
      // caller requested, so we need to re-negotiate it here
      const rawAcceptHeader: string | undefined = request.headers['accept'];
      let targetType: string = RDA_COMMON_STANDARD_CONTENT_TYPE;

console.log('RAW ACCEPT', rawAcceptHeader);

      if (rawAcceptHeader && rawAcceptHeader !== '*/*') {
        const negotiator = new Negotiator({
          supportedValues: supportedAcceptHeaders,
          cache: new Map()
        });
        const negotiated = negotiator.negotiate(rawAcceptHeader);
        if (negotiated === DMP_TOOL_CONTENT_TYPE) {
          targetType = DMP_TOOL_CONTENT_TYPE;
        }
      }

console.log('NEGOTIATED ACCEPT', targetType);

      // Explicitly force the reply type here so Fastify uses the correct output
      // serialization schema
      await reply.type(targetType);

      const schema = negotiatedDmpContent[targetType as keyof typeof negotiatedDmpContent];
      // Use the target type to determine which Ajv validator to use
      const ajv = targetType === DMP_TOOL_CONTENT_TYPE ? ajvDMPTool : ajvRDA;

      if (schema) {

console.log('BEFORE PRUNING:', JSON.stringify(payload).substring(0, 200));

        const pruned = pruneDataWithAjv(ajv, payload, schema);

console.log('AFTER PRUNING:', JSON.stringify(pruned));

        return JSON.stringify(pruned);
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
