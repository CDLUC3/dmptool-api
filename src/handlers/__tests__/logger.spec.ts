import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockRandomHex = jest.fn();

jest.mock('@dmptool/utils', () => ({
  randomHex: (args: number) => mockRandomHex(args),
}));

import { Logger } from "pino";
import { FastifyRequest } from "fastify";
import { User, ConfigurationOptions } from "../../types.js";

let decorateLog: (request: FastifyRequest) => void;

describe("decorateLog", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockChildLogger: Partial<Logger>;
  let mockParentLogger: Partial<Logger>;
  const mockRequestId = "abc123def456";

  beforeAll(async () => {
    // Dynamically import the file under test
    const module = await import("../logger.js");
    decorateLog = module.decorateLog;
  })

  beforeEach(() => {
    jest.clearAllMocks();

    // Explicitly reset the return value
    mockRandomHex.mockReturnValue(mockRequestId);

    mockChildLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    mockParentLogger = {
      child: jest.fn().mockReturnValue(mockChildLogger),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    mockRequest = {
      log: mockParentLogger as Logger,
      url: "/api/test",
      caller: "test-caller",
      user: {
        id: 1,
        email: "test@example.com",
        role: "admin",
      } as User,
      dmptoolConfig: {
        applicationName: "Test App",
        deploymentEnv: "test",
        nodeEnv: "test",
        logLevel: "info",
        pathPrefixes: {v3: "/v3"},
        port: 3000,
        defaultCaller: "default",
        domainWithProtocol: "http://test.com",
        domainName: "test.com",
        jwtSecret: "secret",
        dmpIdBaseUrl: "http://dmp.test",
        dmpIdShoulder: "shoulder",
        payloadSizeLimit: 10,
        narrativeDownloadDomain: "download.test",
        narrativeDownloadPort: 3001,
        landingPageDomain: "landing.test",
        landingPagePort: 3002,
      } as ConfigurationOptions,
    };
  });

  it("should generate a requestId and create a child logger", () => {
    decorateLog(mockRequest as FastifyRequest);

    expect(mockRandomHex).toHaveBeenCalledWith(16);
    expect(mockParentLogger.child).toHaveBeenCalledTimes(1);
    expect(mockRequest.log).toBe(mockChildLogger);
  });

  it("should pass all request properties to child logger", () => {
    decorateLog(mockRequest as FastifyRequest);

    expect(mockParentLogger.child).toHaveBeenCalledWith({
      app: "test-app",
      env: "test",
      requestId: mockRequestId,
      caller: "test-caller",
      user: mockRequest.user,
      url: "/api/test",
    });
  });

  it("should update dynamo logger when present in config", () => {
    if (!mockRequest.dmptoolConfig) {
      throw new Error("dmptoolConfig is required for this test");
    }

    mockRequest.dmptoolConfig.dynamo = {
      logger: mockParentLogger as Logger,
      tableName: "test-table",
      region: "us-east-1",
    } as ConfigurationOptions["dynamo"];

    decorateLog(mockRequest as FastifyRequest);

    expect(mockRequest.dmptoolConfig.dynamo?.logger).toBe(mockChildLogger);
  });

  it("should update rds logger when present in config", () => {
    if (!mockRequest.dmptoolConfig) {
      throw new Error("dmptoolConfig is required for this test");
    }

    mockRequest.dmptoolConfig.rds = {
      logger: mockParentLogger as Logger,
      host: "localhost",
      port: 5432,
      database: "test",
      username: "user",
      password: "pass",
    } as unknown as ConfigurationOptions["rds"];

    decorateLog(mockRequest as FastifyRequest);

    expect(mockRequest.dmptoolConfig.rds?.logger).toBe(mockChildLogger);
  });

  it("should update ssm logger when present in config", () => {
    if (!mockRequest.dmptoolConfig) {
      throw new Error("dmptoolConfig is required for this test");
    }

    mockRequest.dmptoolConfig.ssm = {
      logger: mockParentLogger as Logger,
      region: "us-east-1",
    };

    decorateLog(mockRequest as FastifyRequest);

    expect(mockRequest.dmptoolConfig.ssm?.logger).toBe(mockChildLogger);
  });

  it("should update all nested loggers when present", () => {
    if (!mockRequest.dmptoolConfig) {
      throw new Error("dmptoolConfig is required for this test");
    }

    mockRequest.dmptoolConfig.dynamo = {
      logger: mockParentLogger as Logger,
      tableName: "test-table",
      region: "us-east-1",
    } as ConfigurationOptions["dynamo"];
    mockRequest.dmptoolConfig.rds = {
      logger: mockParentLogger as Logger,
      host: "localhost",
      port: 5432,
      database: "test",
      username: "user",
      password: "pass",
    } as unknown as ConfigurationOptions["rds"];
    mockRequest.dmptoolConfig.ssm = {
      logger: mockParentLogger as Logger,
      region: "us-east-1",
    };

    decorateLog(mockRequest as FastifyRequest);

    expect(mockRequest.dmptoolConfig.dynamo?.logger).toBe(mockChildLogger);
    expect(mockRequest.dmptoolConfig.rds?.logger).toBe(mockChildLogger);
    expect(mockRequest.dmptoolConfig.ssm?.logger).toBe(mockChildLogger);
  });

  it("should format app name to lowercase and replace spaces with hyphens", () => {
    if (!mockRequest.dmptoolConfig) {
      throw new Error("dmptoolConfig is required for this test");
    }

    mockRequest.dmptoolConfig.applicationName = "My Test Application";

    decorateLog(mockRequest as FastifyRequest);

    expect(mockParentLogger.child).toHaveBeenCalledWith(
      {
        app: "my-test application",
        caller: "test-caller",
        env: "test",
        requestId: mockRequestId,
        url: "/api/test",
        user: {
          email: "test@example.com",
          id: 1,
          role: "admin",
        }
      }
    );
  });
});
