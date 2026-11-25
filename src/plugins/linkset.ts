import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const catalogContentType = 'application/linkset+json;profile="https://www.rfc-editor.org/info/rfc9727"';

function getCanonicalCatalogUrl(site: string): string {
  return `${site}/.well-known/api-catalog`;
}

/**
 * Sets the appropriate headers for the linkset response
 *
 * @param reply the Fastify reply object
 * @param site the site URL
 * @returns the Fastify reply object with the appropriate headers set
 */
function setCatalogHeaders(reply: FastifyReply, site: string): FastifyReply {
  return reply
    .code(200)
    .header('Content-Type', catalogContentType)
    .header('Link', `<${getCanonicalCatalogUrl(site)}>; rel="api-catalog"`)
    .header('Cache-Control', 'public, max-age=86400');
}

/**
 * Encapsulates the well-known linkset file that helps machines understand the
 * API. See [RFC9264](https://datatracker.ietf.org/doc/rfc9264/) for more details.
 *
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 */
const linksetPlugin = async function (
  fastify: FastifyInstance
): Promise<void> {
  // Support for HEAD requests to the linkset endpoint, which is required for some clients
  fastify.head(
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
      const site: string = fastify.dmptoolConfig.domainWithProtocol.replace(/\/+$/, '');;
      await setCatalogHeaders(reply, site).send();
    }
  );

  // Support for GET requests to the linkset endpoint
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
      const site: string = fastify.dmptoolConfig.domainWithProtocol.replace(/\/+$/, '');

      await setCatalogHeaders(reply, site).send({
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

  // Simple status check to make sure the plugin is registered
  fastify.addHook('onReady', async () => {
    fastify.log.info('Linkset Plugin has been registered.');
  });
}

export default linksetPlugin;
