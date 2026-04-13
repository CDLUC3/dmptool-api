import { jest } from '@jest/globals';
import { LogLevel } from "fastify";

// Mock the configuration.ts (so it doesn't pick up the dotenv file)
// ESM requires us to use jest.unstable_mockModule
jest.unstable_mockModule('../configuration.ts', () => ({
  configurationOptions: {
    nodeEnv: 'test',
    deploymentEnt: 'tst',
    logLevel: 'info' as LogLevel,

    pathPrefix: '/api/test/v3',

    port: 4060,
    uiPort: 3000,

    domainName: 'localhost:4060',
    domainWithProtocol: `http://localhost:4060`,

    jwtSecret: 'test-secret',
    jwtCookieName: 'test-cookie',

    dmpIdBaseUrl: 'https://doi.org',
    dmpIdShoulder: '00.00000/A1',

    payloadSizeLimit: 1,
  },
}));
