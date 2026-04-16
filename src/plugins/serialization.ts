import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Negotiator } from '@fastify/accept-negotiator';
import {
  DMP_TOOL_CONTENT_TYPE,
  RDA_COMMON_STANDARD_CONTENT_TYPE,
  negotiatedDmpResponseContent
} from "../routeOptions.js";

const serializationPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  const supportedAcceptHeaders = [
    DMP_TOOL_CONTENT_TYPE,
    RDA_COMMON_STANDARD_CONTENT_TYPE,
    'application/json',
    // TODO: Allow HTML as well for now for testing purposes. We may want to
    //       remove this in the future.
    'text/html'
  ];

  // Validate the incoming Accept header
  fastify.addHook('onRequest', async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> => {
    const rawAcceptHeader = request.headers['accept'];

    // Check if the header is missing OR is the wildcard */*.
    // If so default to RDA_COMMON_STANDARD
    if (!rawAcceptHeader || rawAcceptHeader === '*/*') {
      reply.type(RDA_COMMON_STANDARD_CONTENT_TYPE);
      return;
    }

    // Use the Negotiator to parse through the accept headers
    const negotiator = new Negotiator({
      supportedValues: supportedAcceptHeaders,
      cache: new Map()
    });
    const acceptHeader: string | null = negotiator.negotiate(request.headers['accept'] || '');

    // If it returned null, then an Accept header we don't support was provided
    if (!acceptHeader) {
      return reply.status(406).send({
        status_code: 406,
        error_code: 'not_acceptable',
        message: 'The server does not support any of the requested content types.'
      });
    } else {
      // If the target type is DMP Tool, set the Content-Type header to DMP Tool
      // Otherwise, set the Content-Type header to RDA Common Standard
      const targetType: string = acceptHeader === DMP_TOOL_CONTENT_TYPE
        ? acceptHeader
        : RDA_COMMON_STANDARD_CONTENT_TYPE;
      reply.type(targetType);
    }
  });

  // Serialize the outgoing payload and set the Content-Type header
  fastify.addHook('onSend', async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ): Promise<unknown> => {
    // If the payload is a DMP
    if (payload && typeof payload === 'string' && payload.startsWith('{"dmp":')) {
      let targetType: string = reply.getHeader('content-type')?.toString() ?? RDA_COMMON_STANDARD_CONTENT_TYPE;
      targetType = targetType.split(';').map(t => t.trim())[0];

      // Load the schema for the content type
      const schema = negotiatedDmpResponseContent[targetType as keyof typeof negotiatedDmpResponseContent];
      if (schema) {
        const data = JSON.parse(payload);
        // Add the serialization schema to the reply
        const serializer = reply.compileSerializationSchema(schema, reply.statusCode.toString(), targetType);
        return serializer(data);
      }

      return payload;
    }
  });

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('Serialization Plugin has been registered.');
  });
});

export default serializationPlugin;
