import { jest } from '@jest/globals';

// Setup any global variables or mocks here
process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_ENT = 'tst'

process.env.LOG_LEVEL = 'error'

process.env.API_PATH_PREFIX = '/api/test/v3'

process.env.APP_PORT = '4060';
process.env.UI_PORT = '3000'

process.env.APPLICATION_NAME = 'test-api';
process.env.DOMAIN_NAME = 'localhost:4060';

process.env.JWT_SECRET = 'test-secret';

process.env.DMP_ID_BASE = 'https://doi.org'
process.env.DMP_ID_SHOULDER = '00.00000/A1'

process.env.RDS_HOST = '127.0.0.1'
process.env.RDS_PORT = '3006'
process.env.RDS_USERNAME = 'tester'
process.env.RDS_PASSWORD = '123abc'
process.env.RDS_DATABASE = 'test'

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

    applicationName: process.env.APPLICATION_NAME,
    domainName: process.env.DOMAIN_NAME,
    domainWithProtocol: `http://${process.env.DOMAIN_NAME}`,

    jwtSecret: process.env.JWT_SECRET,

    dmpIdBaseUrl: process.env.DMP_ID_BASE,
    dmpIdShoulder: process.env.DMP_ID_SHOULDER,

    rdsHost: process.env.RDS_HOST,
    rdsPort: process.env.RDS_PORT,
    rdsUser: process.env.RDS_USERNAME,
    rdsPassword: process.env.RDS_PASSWORD,
    rdsDatabase: process.env.RDS_DATABASE,
  }
}));
