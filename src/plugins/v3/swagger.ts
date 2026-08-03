import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import type { SwaggerOptions } from '@fastify/swagger';
import { baseConfigurationOptions } from "../../configuration.js";
import { FastifySwaggerUiOptions } from "@fastify/swagger-ui";

// Config for the fastify-swagger plugin which generates the OpenAPI spec
export const v3SwaggerConfig: SwaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'DMP Tool REST API',
      description: `
Welcome to the DMP Tool Rest API Swagger UI. Please use this page to test the different REST API endpoints while building your integration.

### 🔒 Authentication and Authorization Notes
- Any endpoint that requires authentication has a lock symbol next to it's expand/collapse arrow.
- To authenticate, visit the DMP Tool UI and login. This will set the necessary cookies you need to access these endpoints.

### 💡 Content Negotiation Note
This API supports both the **RDA Common Standard** and the **DMP Tool extended** schemas.

- The [RDA Common Standard](https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard) is a community standard for machine-actionable DMPs.
- The [DMP Tool extended format](https://github.com/CDLUC3/dmptool-types/blob/main/schemas/dmptoolDmp.schema.json) combines the RDA Common Standard with [properties specific to the DMP Tool](https://github.com/CDLUC3/dmptool-types/blob/main/schemas/dmpExtension.schema.json).

You can switch between these two formats for each endpoint by scrolling down to the **Responses** section of the endpoint and changing the **Media type** dropdown underneath the \`200\` HTTP status code. Changing this dropdown automatically updates the \`Accept\` header sent with your request.

### Additional Information

There are some properties that the RDA Common Standard allows but we do not currently support! For a list of those properties, examples of valid DMP JSON (for both schema formats), and detailed descriptions, please see the:
    `,
      version: '3'
    },
    servers: [{ url: baseConfigurationOptions.domainWithProtocol }],
    tags: [{ name: 'DMP', description: 'DMP related end-points' }],
    components: {
      securitySchemes: {
        apiKeyHeader: {
          type: 'apiKey',
          name: 'authorization',
          in: 'header'
        },
        apiKeyCookie: {
          type: 'apiKey',
          name: 'dmspt',
          in: 'cookie'
        }
      }
    },
    externalDocs: {
      url: 'https://github.com/CDLUC3/dmptool-api',
      description: 'DMP Tool API repository'
    },
  }
};

// Config for the fastify-swagger-ui plugin which serves the Swagger UI
export const v3SwaggerUIConfig: FastifySwaggerUiOptions = {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  },
  uiHooks: {
    onRequest: function (_request: FastifyRequest, _reply: FastifyReply, next: HookHandlerDoneFunction) {
      next()
    },
    preHandler: function (_request: FastifyRequest, _reply: FastifyReply, next: HookHandlerDoneFunction) {
      next()
    }
  },
  staticCSP: true,
  transformStaticCSP: (header: string): string => header,
  transformSpecification: (
    swaggerObject: Readonly<Record<string, unknown>>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: FastifyRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reply: FastifyReply
  ) => {
    // Reparse to clone the original object
    const doc = JSON.parse(JSON.stringify(swaggerObject));

    // By default, Swagger is referencing components like this: `"$ref": "#/$defs/AffiliationID"`
    // but there is no `$defs` defined at the top level so we need to do some work
    // here to get them where we need them to be

    // Add the top level components if it doesn't exist
    if (!doc.components) doc.components = {};
    if (!doc.components.schemas) doc.components.schemas = {};

    // Walk through the paths to find local `$defs` and move them to top level components.schemas
    if (doc.paths) {
      for (const path in doc.paths) {
        for (const method in doc.paths[path]) {
          const operation = doc.paths[path][method];

          // Check for requestBody json schemas
          const bodySchema = operation.requestBody?.content?.['application/json']?.schema;
          if (bodySchema && bodySchema.$defs) {
            // Move the definition and then delete the current block
            Object.assign(doc.components.schemas, bodySchema.$defs);
            delete bodySchema.$defs;
          }

          // Check for responses json schemas
          if (operation.responses) {
            for (const statusCode in operation.responses) {
              const resSchema = operation.responses[statusCode]?.content?.['application/json']?.schema;
              if (resSchema && resSchema.$defs) {
                // Move the definition and then delete the current block
                Object.assign(doc.components.schemas, resSchema.$defs);
                delete resSchema.$defs;
              }
            }
          }
        }
      }
    }

    // Fix the string references pointing to the old layout
    // Convert '#/$defs/SchemaName' into '#/components/schemas/SchemaName'
    let docString = JSON.stringify(doc);
    docString = docString.replace(/#\/\$defs\//g, '#/components/schemas/');

    return JSON.parse(docString);
  },
  transformSpecificationClone: true,
};
