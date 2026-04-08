import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Encapsulates the well-known linkset file that helps machines understand the
 * API. See [RFC9264](https://datatracker.ietf.org/doc/rfc9264/) for more details.
 *
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
export const linksetPlugin = async function (
  fastify: FastifyInstance
): Promise<void> {
  fastify.get(
    `/.well-known/api-catalog`,
    {
      logLevel: fastify.dmptoolConfig.logLevel,
      config: {
        rateLimit: {
          max: 60
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const site: string = fastify.dmptoolConfig.domainWithProtocol;

      reply.code(200)
        .header('Content-Type', 'application/linkset+json')
        .send({
          linkset: [
            {
              anchor: `${site}/.well-known/api-catalog`,
              item: [
                { href: `${site}/api/v3` },
              ]
            },
            {
              anchor: `${site}/api/v3`,
              'service-desc': [
                {
                  href: `${site}/api/v3/documentation/yaml`,
                  type: "application/vnd.oai.openapi"
                }
              ],
              'service-doc': [
                {
                  href: `${site}/api/v3/documentation`,
                  type: "text/html"
                }
              ]
            }
          ]
        });
    }
  );
}
