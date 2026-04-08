import { jest } from '@jest/globals';

// Setup any global variables or mocks here
process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_ENT = 'tst'

process.env.LOG_LEVEL = 'error'

process.env.API_PATH_PREFIX = '/api/test/v3'

process.env.APP_PORT = '4060';
process.env.UI_PORT = '3000'

process.env.DOMAIN_NAME = 'localhost:4060';

process.env.JWT_SECRET = 'test-secret';

process.env.DMP_ID_BASE = 'https://doi.org'
process.env.DMP_ID_SHOULDER = '00.00000/A1'

jest.mock('dotenv');

// Mock the configuration.ts (so it doesn't pick up the dotenv file)
jest.mock('../configuration.ts', () => ({
  configurationOptions: {
    nodeEnv: process.env.NODE_ENV,
    deploymentEnt: process.env.DEPLOYMENT_ENT,
    logLevel: process.env.LOG_LEVEL,

    pathPrefix: process.env.API_PATH_PREFIX,

    port: process.env.APP_PORT,
    uiPort: process.env.UI_PORT,

    domainName: process.env.DOMAIN_NAME,
    domainWithProtocol: `http://${process.env.DOMAIN_NAME}`,

    jwtSecret: process.env.JWT_SECRET,

    dmpIdBaseUrl: process.env.DMP_ID_BASE,
    dmpIdShoulder: process.env.DMP_ID_SHOULDER,
  }
}));
