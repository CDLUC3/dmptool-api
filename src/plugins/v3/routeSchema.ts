import { FastifySchema, RouteShorthandOptions } from 'fastify';
import {
  DMPToolDMPJSONSchema,
  RDACommonStandardDMPJSONSchema
} from '@dmptool/types';

export const RDA_COMMON_STANDARD_CONTENT_TYPE = 'application/vnd.org.rd-alliance.dmp-common.v1.2+json';
export const DMP_TOOL_CONTENT_TYPE = 'application/vnd.org.dmptool.v1.2+json';

// Custom request body structure for Swagger
interface SwaggerRequestBodySpec {
  description?: string;
  required?: boolean;
  content: typeof negotiatedDmpContent; // Explicitly matches your content object
}

// Extend the base FastifySchema with an intersection type so we can include
// swaggerRequestBody which allows use to get content negotiation working in the Swagger UI
export interface DMPToolRouteOptions extends RouteShorthandOptions {
  schema?: FastifySchema & {
    swaggerRequestBody?: SwaggerRequestBodySpec;
  };
}

// The RDA Common Standard supports a large number of languages.
const getDmpLanguageEnum = () => {
  const langSchema = (
    RDACommonStandardDMPJSONSchema.properties?.dmp as typeof RDACommonStandardDMPJSONSchema['dmp']
  )?.properties?.language;
  return langSchema?.enum || [];
};

// Representation of an empty object
const emptyObjectSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
} as const;

// Representation of an error object
const errorObjectSchema = {
  type: 'object',
  properties: {
    status_code: {
      type: 'number'
    },
    error_code: {
      type: 'string'
    },
    error_message: {
      type: 'string'
    }
  },
  required: ['error_code'],
}

// The internal `dmp` object from the RDA Common Standard and DMP Tool JSON schemas
const baseRDADmpDefs = RDACommonStandardDMPJSONSchema.$defs || {};
const baseDMPToolDmpDefs = DMPToolDMPJSONSchema.$defs || {};

// The standard error responses for the DMP Tool API
const standardErrors = {
  400: errorObjectSchema,       // Bad Request
  401: errorObjectSchema,       // Unauthorized
  404: errorObjectSchema,       // Not Found
  406: errorObjectSchema,       // Not Acceptable (unknown MIME type in Accept header)
  409: errorObjectSchema,       // Conflict (DMP timestamps did not match)
  429: errorObjectSchema,       // Too Many Requests (Rate Limiting)
  500: errorObjectSchema,       // Internal Server Error
} as const;

// The API supports two different representations of a DMP:
// 1. The RDA Common Standard
// 2. The DMP Tool with extensions
//
// The `Accept` header is used to determine which representation to return.
//
// The `Content-Type` header is used to indicate the format of the response.
//
// The `Accept` header is used to negotiate the response format. The default is
// the RDA Common Standard format (NO DMP Tool extensions).
//
export const negotiatedDmpContent = {
  [RDA_COMMON_STANDARD_CONTENT_TYPE]: {
    $defs: baseRDADmpDefs,
    type: 'object',
    properties: {
      dmp: {
        $ref: '#/$defs/DMPData',
      },
      unevaluatedProperties: false
    },
    additionalProperties: false,
    required: ['dmp'],
  },
  [DMP_TOOL_CONTENT_TYPE]: {
    $defs: baseDMPToolDmpDefs,
    type: 'object',
    properties: {
      dmp: {
        allOf: [
          { $ref: '#/$defs/DMPData' },
          { $ref: '#/$defs/DMPToolExtension' }
        ],
        unevaluatedProperties: false
      }
    },
    additionalProperties: false,
    required: ['dmp'],
  }
}

// The schema for a maDMP record
//
// This schema is used to validate the incoming request body for POST/PUT/PATCH
// requests.
//
// The schema is based on the RDA Common Standard and DMP Tool JSON schemas.
//
// The schema is designed to be flexible enough to accept both the RDA Common
// Standard and the DMP Tool JSON schemas.
//
const maDMPBody = {
  // Hoist ALL definitions from both JSON Schema sources to the root (Fastify needs them)
  $defs: {
    ...RDACommonStandardDMPJSONSchema.$defs,
    ...DMPToolDMPJSONSchema.$defs,
  },
  anyOf: [
    // RDA Common Standard
    {
      type: 'object',
      properties: {
        dmp: { $ref: '#/$defs/DMPData' }
      },
      required: ['dmp'],
      // additionalProperties: false // Note that this will reject DMP Tool extensions
    },
    // RDA Common Standard with DMP Tool extensions
    {
      type: 'object',
      properties: {
        dmp: {
          allOf: [
            { $ref: '#/$defs/DMPData' },
            { $ref: '#/$defs/DMPToolExtension' }
          ],
          unevaluatedProperties: false
        },
      },
      required: ['dmp']
    },
  ]
};

const allowableQueryParameters = {
  type: 'object',
  properties: {
    scope: {
      type: 'string',
      default: 'public',
      enum: [
        'affiliation',
        'mine',
        'public'
      ]
    },
    created_before: {
      type: 'string',
      format: 'date-time'
    },
    created_after: {
      type: 'string',
      format: 'date-time'
    },
    modified_before: {
      type: 'string',
      format: 'date-time'
    },
    modified_after: {
      type: 'string',
      format: 'date-time'
    },
    languages: {
      type: 'array',
      items: getDmpLanguageEnum().length > 0
        ? { type: 'string', enum: getDmpLanguageEnum() }
        : { type: 'string' }
    },
    contact_ids: {
      type: 'array',
      items: {
        type: 'string'
      },
    },
    contributor_ids: {
      type: 'array',
      items: {
        type: 'string'
      },
    },
    dataset_ids: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    metadata_standard_ids: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    dmp_ids: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    funder_ids: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    grant_ids: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    query: {
      type: 'string'
    },
    ethical_issues_exist: {
      type: 'boolean'
    },
    embargo_before: {
      type: 'string',
      format: 'date'
    },
    embargo_after: {
      type: 'string',
      format: 'date'
    },
    offset: {
      type: 'integer',
      minimum: 0,
      default: 0
    },
    count: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    sort: {
      type: 'array',
      default: ['created,desc'],
      items: {
        type: 'string',
        enum: [
          'title,asc',
          'title,desc',
          'created,asc',
          'created,desc',
          'modified,asc',
          'modified,desc',
          'language,asc',
          'language,desc',
          'embargo,asc',
          'embargo,desc',
          'keyword,asc',
          'keyword,desc'
        ]
      }
    }
  }
};

// GET /dmps/:id
export const GET_DMP_OPTIONS: RouteShorthandOptions = {
  schema: {
    operationId: 'getDMP',
    summary: 'Get a DMP',
    description: 'Get based on its DMP id.',
    tags: ['DMP'],
    // Security names are defined in the Swagger Plugin
    security: [{ apiKeyHeader: [], apiKeyCookie: [] }],
    params: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The DMP Id (e.g. `11.22222/abc123`)'
        }
      }
    },
    querystring: {
      type: 'object',
      properties: {
        version: {
          type: 'string',
          format: 'date-time',
          description: 'A timestamp in the `YYYY-MM-DD hh:mm:ss.SSSZ` format'
        }
      }
    },
    response: {
      200: {
        // 1. Give Fastify a fallback root schema so it doesn't default to empty
        type: 'object',
        additionalProperties: true,
        // 2. Keep the content block as-is so Swagger UI can continue to document both models perfectly!
        content: {
          [RDA_COMMON_STANDARD_CONTENT_TYPE]: {
            schema: negotiatedDmpContent[RDA_COMMON_STANDARD_CONTENT_TYPE]
          },
          [DMP_TOOL_CONTENT_TYPE]: {
            schema: negotiatedDmpContent[DMP_TOOL_CONTENT_TYPE]
          }
        },
        headers: {
          'Last-Modified': {
            description: 'The last modified date of the DMP',
            schema: {
              type: 'string'
            }
          }
        }
      },
      ...standardErrors
    }
  }
};

// POST /dmps/query
export const GET_DMPS_OPTIONS: RouteShorthandOptions = {
  schema: {
    operationId: 'listDMPs',
    summary: 'List/Search for DMPs.',
    description: 'This endpoint lists all DMPs or allows for creating a filtered list. When filters are provided,\n' +
      '        all filters are applied (using the AND relationship). For filters supporting lists, the individual values are applied\n' +
      '        as an OR relationship.\n' +
      '\n' +
      '        For items accepting more than one value you may pass multiple values by repeating the parameter in the\n' +
      '        query string for each item.',
    tags: ['DMP'],
    // Security names are defined in the Swagger Plugin
    security: [{ apiKeyHeader: [], apiKeyCookie: [] }],
    querystring: allowableQueryParameters,
    response: {
      200: {
        type: 'object',
        properties: {
          total_count: {
            type: 'integer'
          },
          items: {
            type: 'array',
            items: {
              // Define the generic type here, the serializationPlugin will return the
              // correct object
              type: 'object',
              properties: {
                dmp: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          }
        }
      },
      ...standardErrors
    }
  }
}

// POST /dmps
export const POST_DMP_OPTIONS: DMPToolRouteOptions = {
  schema: {
    operationId: 'createDMP',
    summary: 'Create a DMP',
    description: 'Create or import a DMP from a JSON-formatted DMP object.',
    tags: ['DMP'],
    // Security names are defined in the Swagger Plugin
    security: [{ apiKeyHeader: [], apiKeyCookie: [] }],
    swaggerRequestBody: {
      description: 'DMP Object Data',
      required: true,
      content: negotiatedDmpContent
    },
    body: maDMPBody,
    response: {
      201: {
        content: {
          [RDA_COMMON_STANDARD_CONTENT_TYPE]: {
            schema: negotiatedDmpContent[RDA_COMMON_STANDARD_CONTENT_TYPE]
          },
          [DMP_TOOL_CONTENT_TYPE]: {
            schema: negotiatedDmpContent[DMP_TOOL_CONTENT_TYPE]
          }
        },
        headers: {
          'Last-Modified': {
            description: 'The last modified date of the DMP',
            schema: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      },
      ...standardErrors
    }
  }
};

// PUT /dmps/:id
export const PUT_DMP_OPTIONS: DMPToolRouteOptions = {
  schema: {
    operationId: 'updateDMP',
    summary: 'Overwrite a DMP',
    description: 'Completely overwrite a DMP with the specified data.',
    tags: ['DMP'],
    // Security names are defined in the Swagger Plugin
    security: [{ apiKeyHeader: [], apiKeyCookie: [] }],
    params: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The DMP Id'
        }
      }
    },
    headers: {
      type: 'object',
      properties: {
        'If-Unmodified-Since': {
          type: 'string',
          description: 'The last modified date of the DMP'
        }
      },
      required: ['If-Unmodified-Since']
    },
    swaggerRequestBody: {
      description: 'DMP Object Data',
      required: true,
      content: negotiatedDmpContent
    },
    body: maDMPBody,
    response: {
      200: {
        content: {
          [RDA_COMMON_STANDARD_CONTENT_TYPE]: {
            schema: negotiatedDmpContent[RDA_COMMON_STANDARD_CONTENT_TYPE]
          },
          [DMP_TOOL_CONTENT_TYPE]: {
            schema: negotiatedDmpContent[DMP_TOOL_CONTENT_TYPE]
          }
        },
        headers: {
          'Last-Modified': {
            description: 'The last modified date of the DMP',
            schema: {
              type: 'string'
            }
          }
        }
      },
      ...standardErrors
    }
  }
};

// DELETE /dmps/:id
export const DELETE_DMP_OPTIONS: RouteShorthandOptions = {
  schema: {
    operationId: 'deleteDMP',
    summary: 'Delete a DMP',
    description: 'Delete a DMP based on its ID. The DMP will be tomb-stoned instead if the DMP id is a registered DOI.',
    tags: ['DMP'],
    // Security names are defined in the Swagger Plugin
    security: [{ apiKeyHeader: [], apiKeyCookie: [] }],
    params: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The DMP Id'
        }
      }
    },
    headers: {
      type: 'object',
      properties: {
        'If-Unmodified-Since': {
          type: 'string',
          description: 'The last modified date of the DMP'
        }
      },
      required: ['If-Unmodified-Since']
    },
    response: {
      204: emptyObjectSchema,
      ...standardErrors
    }
  }
};

// POST /dmps/validate
export const POST_VALIDATE_OPTIONS: RouteShorthandOptions = {
  schema: {
    operationId: 'validateDMP',
    summary: 'Validate a DMP\'s JSON',
    description: 'Verify that a JSON document is a valid DMP object.',
    tags: ['DMP'],
    body: {
      content: {
        'application/json': {
          schema: {
            $defs: baseRDADmpDefs,
            type: 'object',
            properties: {
              dmp: {
                $ref: '#/$defs/DMPData'
              }
            },
            required: ['dmp'],
          }
        },
        [RDA_COMMON_STANDARD_CONTENT_TYPE]: {
          schema: {
            $defs: baseRDADmpDefs,
            type: 'object',
            properties: {
              dmp: {
                $ref: '#/$defs/DMPData'
              }
            },
            required: ['dmp'],
          }
        },
        [DMP_TOOL_CONTENT_TYPE]: {
          schema: {
            $defs: baseDMPToolDmpDefs,
            type: 'object',
            properties: {
              dmp: {
                allOf: [
                  { $ref: '#/$defs/DMPData' },
                  { $ref: '#/$defs/DMPToolExtension' }
                ],
                unevaluatedProperties: false
              }
            },
            required: ['dmp'],
          }
        }
      }
    },
    response: {
      200: {
        status_code: 200,
        message: {
          type: 'string'
        }
      },
      ...standardErrors
    }
  }
};
