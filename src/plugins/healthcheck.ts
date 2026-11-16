import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Plugin that adds a health check endpoint
 */
const healthcheckPlugin = async function (fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api-healthcheck',
    async (_request: FastifyRequest, reply: FastifyReply
    ): Promise<void> => {
      reply.code(200).send({status_code: '200', message: 'OK'});
    }
  );
}

export default healthcheckPlugin;
