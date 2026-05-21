import { jest } from '@jest/globals';
import { LogLevel } from "fastify";

// Mock the configuration.ts (so it doesn't pick up the dotenv file)
// ESM requires us to use jest.unstable_mockModule
jest.unstable_mockModule('../configuration.ts', () => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }

  const baseConfig = {
    nodeEnv: 'test',
    deploymentEnv: 'tst',
    logLevel: 'info' as LogLevel,

    pathPrefixes: {
      v3: '/api/v3'
    },

    port: 4060,
    uiPort: 3000,

    applicationName: 'DMP Tool API',
    defaultCaller: 'test-caller',

    domainName: 'localhost:4060',
    domainWithProtocol: `http://localhost:4060`,

    jwtSecret: 'test-secret',
    jwtCookieName: 'test-cookie',

    dmpIdBaseUrl: 'https://doi.org',
    dmpIdShoulder: '00.00000/A1',

    payloadSizeLimit: 1,

    narrativeDownloadDomain: 'localhost',
    narrativeDownloadPort: 4030,
    landingPageDomain: 'localhost',
    landingPagePort: 4060,
  }

  const graphQLConfig = {
    uri: 'http://localhost:4000',
  }

  const ssmConfig = {
    logger,
    region: 'us-east-1',
    useTLS: true,
    endpoint: '127.0.0.1',
  }

  const rdsConfig = {
    logger,
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'testing',
    database: 'dmptool',
  }

  const dynamoConfig = {
    logger,
    region: 'us-east-1',
    tableName: 'dmptool',
    endpoint: '127.0.0.1:8000',
    maxAttempts: 3,
  }

  return {
    __esModule: true,
    baseConfigurationOptions: baseConfig,
    loadFullConfigurationOptions: jest.fn().mockImplementation(() => Promise.resolve({
      ...baseConfig,
      ssm: ssmConfig,
      rds: rdsConfig,
      dynamo: dynamoConfig,
      graphQL: graphQLConfig
    }))
  }
});
