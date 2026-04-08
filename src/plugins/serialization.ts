import fp from "fastify-plugin";
import type {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import { Negotiator } from '@fastify/accept-negotiator';
import {
  DMP_TOOL_CONTENT_TYPE,
  RDA_COMMON_STANDARD_CONTENT_TYPE,
  negotiatedDmpResponseContent
} from "../serializer.js";

export const serializationPlugin = fp(async function (
  fastify: FastifyInstance
): Promise<void> {
  const supportedAcceptHeaders = [DMP_TOOL_CONTENT_TYPE, RDA_COMMON_STANDARD_CONTENT_TYPE];

  fastify.addHook('onSend', async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ): Promise<unknown> => {
    // If the payload is a DMP
    if (payload && typeof payload === 'string' && payload.startsWith('{"dmp":')) {
      const negotiator = new Negotiator({
        supportedValues: supportedAcceptHeaders,
        cache: new Map()
      });

      const acceptHeader: string | null = negotiator.negotiate(request.headers['accept'] || '');
      const targetType: string = acceptHeader || RDA_COMMON_STANDARD_CONTENT_TYPE;

      // Set the Content-Type header to the negotiated value (default to RDA)
      reply.type(targetType);

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
});
