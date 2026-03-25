import { RouteShorthandOptions } from 'fastify';
import { RDACommonStandardDMPJSONSchema, ExtensionJSONSchema } from '@dmptool/types';

type RouteSchema = NonNullable<RouteShorthandOptions['schema']>;

type RouteSchemaOverride = Partial<RouteSchema['response']>;

// Representation of an empty object
const emptyObjectSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
} as const;

// Representation of a response.
const createResponseSchema = (overrides: RouteSchemaOverride = {}): RouteSchema => ({
  response: {
    200: emptyObjectSchema,              // validates a successful response
    301: emptyObjectSchema,              // validates a redirect response
    400: emptyObjectSchema,              // validates a bad request response
    401: emptyObjectSchema,              // validates an unauthorized response
    403: emptyObjectSchema,              // validates a forbidden response
    404: emptyObjectSchema,              // validates a not found response
    500: emptyObjectSchema,              // validates an internal server error response
    ...overrides
  }
});

// The RDA common standard combined with the DMP Tool extensions
const CombinedDMPSchema = {
  ...RDACommonStandardDMPJSONSchema,
  ...ExtensionJSONSchema
}

// Representation of a successful response containing a maDMP record in
// the RDA Common Standard format with the DMP Tool extensions
const DMPToolDMPSchema: RouteSchema = createResponseSchema({
  200: {
    type: 'object',
    properties: {
      dmp: [RDACommonStandardDMPJSONSchema, CombinedDMPSchema]
    },
    required: ['dmp'],
    additionalProperties: false
  }
});

// TODO: Refactor this for each route once the API has been created
export const EXAMPLE_CREATE_DMP_RESPONSE_OPTIONS: RouteShorthandOptions = {
  schema: createResponseSchema({
    DMPToolDMPSchema
  })
};
