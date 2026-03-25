import { RouteShorthandOptions } from 'fastify';
import { RDACommonStandardDMPJSONSchema, ExtensionJSONSchema } from '@dmptool/types';

type RouteSchema = NonNullable<RouteShorthandOptions['schema']>;

type RouteSchemaOverride = Partial<RouteSchema>;

// Representation of an empty object
const emptyObjectSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
} as const;

// Representation of an incoming request.
// This allows us to define the shape of the request body, querystring, headers,
// and params in a single place.
const createRouteSchema = (overrides: RouteSchemaOverride = {}): RouteSchema => ({
  body: emptyObjectSchema,             // validates the request body for POST/PUT/PATCH
  querystring: emptyObjectSchema,      // validates the query string
  headers: emptyObjectSchema,          // validates the request headers
  params: emptyObjectSchema,           // validates the route parameters
  ...overrides
});

// Representation of a basic maDMP record following the RDA Common Standard.
const RDACommonStandardDMPSchema: RouteSchema = createRouteSchema({
  body: RDACommonStandardDMPJSONSchema
});

// Representation of the DMP Tool extensions to a maDMP record
const DMPToolExtensionSchema: RouteSchema = createRouteSchema({
  body: ExtensionJSONSchema
});

// The combined schema for a maDMP record
const CombinedDMPSchema = {
  ...RDACommonStandardDMPSchema,
  ...DMPToolExtensionSchema
}

// We accept the RDA Common Standard with or without the DMP Tool extensions
const DMPSchema: RouteSchema = createRouteSchema({
  body: {
    type: 'object',
    properties: {
      dmp: [RDACommonStandardDMPSchema, CombinedDMPSchema]
    },
    required: ['dmp'],
    additionalProperties: false
  }
});

// TODO: Refactor this for each route once the API has been created
export const EXAMPLE_CREATE_DMP_ROUTE_OPTIONS: RouteShorthandOptions = {
  schema: createRouteSchema({
    body: DMPSchema
  })
};
