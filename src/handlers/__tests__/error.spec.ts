import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  FastifyError, FastifyReply, FastifyRequest,
  FastifySchemaValidationError
} from 'fastify';
import { notFoundHandler, errorHandler } from '../error.js';
import { ConfigurationOptions } from '../../types.js';

describe('notFoundHandler', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  const dmpIdShoulder = '10.12345';

  beforeEach(() => {
    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as Partial<FastifyReply>;
  });

  it('should return 404 error for route without DMP ID', () => {
    mockRequest = {
      url: '/api/v3/dmps',
      method: 'GET',
    };

    notFoundHandler(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply,
      dmpIdShoulder
    );

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      status_code: '404',
      error_code: 'dmp_not_found',
      message: 'Route GET:/api/v3/dmps not found.',
    });
  });

  it('should return 404 error with URL encoding hint when DMP ID is in URL', () => {
    mockRequest = {
      url: '/api/v3/dmps/10.12345/abc123',
      method: 'GET',
    };

    notFoundHandler(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply,
      dmpIdShoulder
    );

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      status_code: '404',
      error_code: 'dmp_not_found',
      message: 'Route GET:/api/v3/dmps/10.12345/abc123 not found. Make sure the DMP id is URL encoded.',
    });
  });
});

describe('errorHandler', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockConfig: ConfigurationOptions;

  beforeEach(() => {
    mockConfig = {
      nodeEnv: 'test',
      deploymentEnv: 'test',
      logLevel: 'info',
      pathPrefixes: {v3: '/api/v3'},
      port: 3000,
      applicationName: 'test-app',
      defaultCaller: 'test',
      domainWithProtocol: 'http://localhost',
      domainName: 'localhost',
      jwtSecret: 'secret',
      dmpIdBaseUrl: 'http://localhost',
      dmpIdShoulder: '10.12345',
      payloadSizeLimit: 10,
      narrativeDownloadDomain: 'localhost',
      narrativeDownloadPort: 3001,
      landingPageDomain: 'localhost',
      landingPagePort: 3002,
    };

    mockRequest = {
      dmptoolConfig: mockConfig,
      log: {
        fatal: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
      } as unknown,
    } as Partial<FastifyRequest>;

    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as Partial<FastifyReply>;
  });

  describe('unhandled errors', () => {
    it('should handle unhandled Error (not FastifyError)', () => {
      const error = new Error('Unhandled error');

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error
      );

      expect(mockRequest.log?.fatal).toHaveBeenCalledWith(expect.stringContaining('Unhandled Exception!'));
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 500,
        error_code: 'generic_error',
      }));
    });
  });

  describe('validation errors', () => {
    it('should handle header validation errors', () => {
      const error: Partial<FastifyError> = {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        message: 'Invalid header value',
        validation: [{ message: 'test' }] as FastifySchemaValidationError[],
        validationContext: 'headers',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockRequest.log?.warn).toHaveBeenCalledWith(
        {error},
        'Validation exception!'
      );
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'bad_request',
        message: 'Headers: Invalid header value',
      });
    });

    it('should handle querystring validation errors', () => {
      const error: Partial<FastifyError> = {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        message: 'Invalid query parameter',
        validation: [{message: 'test'}] as FastifySchemaValidationError[],
        validationContext: 'querystring',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'invalid_query_string',
        message: 'Query string: Invalid query parameter',
      });
    });

    it('should handle params validation errors', () => {
      const error: Partial<FastifyError> = {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        message: 'Invalid parameter',
        validation: [{message: 'test'}] as FastifySchemaValidationError[],
        validationContext: 'params',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'bad_request',
        message: 'Parameters: Invalid parameter',
      });
    });

    it('should handle body validation errors', () => {
      const error: Partial<FastifyError> = {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        message: 'Invalid body, body must match a schema in anyOf',
        validation: [{message: 'test'}] as FastifySchemaValidationError[],
        validationContext: 'body',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'dmp_invalid',
        message: 'Invalid DMP record: Invalid body',
      });
    });
  });

  describe('fastify errors', () => {
    it('should handle FST_ERR_CTP_EMPTY_JSON_BODY error', () => {
      const error: Partial<FastifyError> = {
        statusCode: 400,
        code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
        message: 'Empty JSON body',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 400,
        error_code: 'dmp_invalid',
        error_message: 'The DMP is invalid. Please use /dmps/validate for more information.: Empty JSON body',
      });
    });

    it('should handle FST_ERR_NOT_FOUND error', () => {
      const error: Partial<FastifyError> = {
        statusCode: 404,
        code: 'FST_ERR_NOT_FOUND',
        message: 'Not found',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 404,
        error_code: 'dmp_not_found',
        error_message: 'The DMP could not be found.',
      });
    });

    it('should handle JWT errors with FST_JWT_ prefix', () => {
      const error: Partial<FastifyError> = {
        statusCode: 401,
        code: 'FST_JWT_INVALID',
        message: 'Invalid JWT',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 401,
        error_code: 'authentication_required',
        error_message: 'Authentication required to perform the specified request.',
      });
    });

    it('should map 403 to authentication required with insufficient permissions message', () => {
      const error: Partial<FastifyError> = {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Forbidden',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 403,
        error_code: 'insufficient_permissions',
        error_message: 'Insufficient permissions to perform this action',
      });
    });

    it('should handle FST_ERR_CTP_INVALID_PARSE_TYPE error', () => {
      const error: Partial<FastifyError> = {
        statusCode: 406,
        code: 'FST_ERR_CTP_INVALID_PARSE_TYPE',
        message: 'Invalid parse type',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(406);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 406,
        error_code: 'not_acceptable',
        error_message: 'Unknown DMP standard, unable to fulfill request.',
      });
    });

    it('should handle FST_ERR_CTP_INVALID_MEDIA_TYPE error', () => {
      const error: Partial<FastifyError> = {
        statusCode: 415,
        code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
        message: 'Invalid media type',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(415);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 415,
        error_code: 'unsupported_media_type',
        error_message: 'Invalid DMP MIME type. Try `Content-Type: application/json` instead.',
      });
    });

    it('should handle FST_ERR_CTP_BODY_TOO_LARGE error', () => {
      const error: Partial<FastifyError> = {
        statusCode: 413,
        code: 'FST_ERR_CTP_BODY_TOO_LARGE',
        message: 'Body too large',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(413);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 413,
        error_code: 'payload_too_large',
      }));
    });

    it('should handle 4xx errors with custom message', () => {
      const error: Partial<FastifyError> = {
        statusCode: 422,
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(422);
      expect(mockReply.send).toHaveBeenCalledWith({
        status_code: 422,
        error_code: 'custom_error',
        error_message: 'The request is invalid.',
      });
    });

    it('should handle 500 error with generic message', () => {
      const error: Partial<FastifyError> = {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Some internal error',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockRequest.log?.fatal).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          errOut: expect.objectContaining({ status_code: 500, error_code: 'generic_error' }),
        }),
        'Fastify fatal exception!'
      );
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 500,
        error_code: 'generic_error',
      }));
    });

    it('should handle error with no statusCode defaulting to 500', () => {
      const error: Partial<FastifyError> = {
        code: 'SOME_ERROR',
        message: 'Error without status code',
      };

      errorHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        error as FastifyError
      );

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 500,
        error_code: 'generic_error',
      }));
    });
  });
});
