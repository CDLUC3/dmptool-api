import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import type { DMPToolDMPType } from '@dmptool/types';
import type { AccessiblePlan, ConfigurationOptions, Plan, User } from '../../types.js';

const createDMP = jest.fn();
const getDMPs = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const planToDMPCommonStandard = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const queryTable = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const randomHex = jest.fn();
const updateDMP = jest.fn();
const isDmpId = jest.fn();

jest.unstable_mockModule('@dmptool/utils', () => ({
  createDMP,
  DMP_LATEST_VERSION: 'latest',
  getDMPs,
  planToDMPCommonStandard,
  queryTable,
  randomHex,
  updateDMP,
}));

jest.unstable_mockModule('../../utils.js', () => ({
  isDmpId,
}));

const {
  callerHasPermission,
  generateDMPId,
  handleMissingMaDMP,
  loadMaDMPFromDynamo,
  loadPlan,
  loadPlansForCaller,
  loadPlansForUser,
  maDMPHelpers,
  persistMaDMPRecord,
  userHasPermission,
} = await import('../maDMP.js');

const config = {
  applicationName: 'DMP Tool API',
  deploymentEnv: 'test',
  dmpIdBaseUrl: 'https://doi.org',
  dmpIdShoulder: '10.1234/',
  domainName: 'localhost:4060',
  landingPageDomain: 'localhost',
  landingPagePort: 4060,
  rds: { host: 'rds' },
  dynamo: { tableName: 'dmps' },
} as unknown as ConfigurationOptions;

const buildRequest = (
  overrides: Partial<FastifyRequest> = {},
  configOverrides: Partial<ConfigurationOptions> = {},
): FastifyRequest => ({
  dmptoolConfig: { ...config, ...configOverrides },
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  },
  ...overrides,
}) as unknown as FastifyRequest;

const dmp = (overrides: Partial<DMPToolDMPType['dmp']> = {}): DMPToolDMPType => ({
  dmp: {
    dmp_id: { identifier: 'dmp-1', type: 'url' },
    privacy: 'private',
    contact: {
      affiliation: [{ affiliation_id: { identifier: 'contact-affiliation', type: 'other' } }],
    },
    ...overrides,
  },
} as DMPToolDMPType);

const accessiblePlan: AccessiblePlan = {
  id: 1,
  dmpId: 'dmp-1',
  accessLevel: 'read',
};

const plan: Plan = {
  id: 1,
  dmpId: 'dmp-1',
  modified: '2026-01-01',
  visibility: 'PRIVATE',
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('generateDMPId', () => {
  it('returns the first available generated identifier', async () => {
    const request = buildRequest();
    randomHex.mockReturnValue('available');
    queryTable.mockResolvedValue({ results: [], fields: [] });

    await expect(generateDMPId(request)).resolves.toBe('https://doi.org10.1234/available');
    expect(randomHex).toHaveBeenCalledWith(8);
    expect(queryTable).toHaveBeenCalledWith(
      config.rds,
      'SELECT dmpId FROM plans WHERE dmpId = ?',
      ['https://doi.org10.1234/available'],
    );
  });

  it('retries collisions and uses a temporary identifier after five attempts', async () => {
    const request = buildRequest();
    randomHex
      .mockReturnValueOnce('first')
      .mockReturnValueOnce('retry-1')
      .mockReturnValueOnce('retry-2')
      .mockReturnValueOnce('retry-3')
      .mockReturnValueOnce('retry-4')
      .mockReturnValueOnce('fallback');
    queryTable.mockResolvedValue({ results: [{}], fields: [] });

    await expect(generateDMPId(request)).resolves.toBe('TEMP-APIfallback');
    expect(queryTable).toHaveBeenCalledTimes(5);
    expect(randomHex).toHaveBeenNthCalledWith(2, 16);
    expect(request.log.fatal).toHaveBeenCalledWith('Unable to generate a unique DMP ID.');
  });
});

describe('permission checks', () => {
  it('allows public DMPs without a user or caller', () => {
    const publicDmp = dmp({ privacy: 'public' });

    expect(userHasPermission(publicDmp, [], undefined as unknown as User)).toBe(true);
    expect(callerHasPermission(publicDmp, [], '')).toBe(true);
  });

  it('denies private DMPs without a user or caller', () => {
    const privateDmp = dmp();

    expect(userHasPermission(privateDmp, [], undefined as unknown as User)).toBe(false);
    expect(callerHasPermission(privateDmp, [], '')).toBe(false);
  });

  it('allows superadmins, affiliated admins, and plan collaborators', () => {
    const privateDmp = dmp({
      contributor: [{
        affiliation: [{ affiliation_id: { identifier: 'contributor-affiliation', type: 'other' } }],
      }],
    });

    expect(userHasPermission(privateDmp, [], { role: 'SUPERADMIN' })).toBe(true);
    expect(userHasPermission(privateDmp, [], {
      role: 'ADMIN',
      affiliationId: 'contributor-affiliation',
    })).toBe(true);
    expect(userHasPermission(privateDmp, [accessiblePlan], { role: 'USER' })).toBe(true);
  });

  it('denies users and callers without matching access', () => {
    const privateDmp = dmp();

    expect(userHasPermission(privateDmp, [], { role: 'ADMIN', affiliationId: 'other' })).toBe(false);
    expect(callerHasPermission(privateDmp, [], 'client-id')).toBe(false);
    expect(callerHasPermission(privateDmp, [accessiblePlan], 'client-id')).toBe(true);
  });
});

describe('plan loaders', () => {
  it('returns empty lists when the request lacks a user or caller', async () => {
    const request = buildRequest();

    await expect(loadPlansForUser(request)).resolves.toEqual([]);
    await expect(loadPlansForCaller(request)).resolves.toEqual([]);
    expect(queryTable).not.toHaveBeenCalled();
  });

  it('loads user and caller plans and normalizes non-array query results', async () => {
    const userRequest = buildRequest({ user: { email: 'user@example.com' } });
    const callerRequest = buildRequest({ caller: 'client-id' });
    queryTable
      .mockResolvedValueOnce({ results: [accessiblePlan], fields: [] })
      .mockResolvedValueOnce({ results: undefined, fields: [] });

    await expect(loadPlansForUser(userRequest)).resolves.toEqual([accessiblePlan]);
    await expect(loadPlansForCaller(callerRequest)).resolves.toEqual([]);
    expect(queryTable).toHaveBeenNthCalledWith(
      1,
      config.rds,
      expect.stringContaining('SELECT DISTINCT p.id, p.dmpId, pcs.accessLevel'),
      ['user@example.com'],
    );
    expect(queryTable).toHaveBeenNthCalledWith(
      2,
      config.rds,
      expect.stringContaining('SELECT DISTINCT p.id, p.dmpId, pcs.accessLevel'),
      ['client-id'],
    );
  });

  it('rejects invalid DMP IDs without querying', async () => {
    isDmpId.mockReturnValue(false);

    await expect(loadPlan(buildRequest(), 'invalid')).resolves.toBeUndefined();
    expect(queryTable).not.toHaveBeenCalled();
  });

  it('loads a plan by a project URL, DOI URL, or relative DOI', async () => {
    isDmpId.mockReturnValue(true);
    queryTable.mockResolvedValue({ results: [plan], fields: [] });
    const request = buildRequest();

    await expect(loadPlan(request, '123')).resolves.toEqual(plan);
    await expect(loadPlan(request, 'projects/123')).resolves.toEqual(plan);
    await expect(loadPlan(request, 'projects%2F123')).resolves.toEqual(plan);
    await expect(loadPlan(request, 'https://doi.org/10.1234/dmp-1')).resolves.toEqual(plan);
    await expect(loadPlan(request, '10.1234/dmp-1')).resolves.toEqual(plan);
    await expect(loadPlan(request, '10.1234%2Fdmp-1')).resolves.toEqual(plan);

    expect(queryTable).toHaveBeenNthCalledWith(
      1,
      config.rds,
      'SELECT id, dmpId, modified, visibility FROM plans WHERE id = ?',
      ['123'],
    );
    expect(queryTable).toHaveBeenNthCalledWith(
      2,
      config.rds,
      'SELECT id, dmpId, modified, visibility FROM plans WHERE id = ?',
      ['123'],
    );
    expect(queryTable).toHaveBeenNthCalledWith(
      3,
      config.rds,
      'SELECT id, dmpId, modified, visibility FROM plans WHERE id = ?',
      ['123'],
    );
    expect(queryTable).toHaveBeenNthCalledWith(
      4,
      config.rds,
      'SELECT id, dmpId, modified, visibility FROM plans WHERE dmpId = ?',
      ['https://doi.org/10.1234/dmp-1'],
    );
    expect(queryTable).toHaveBeenNthCalledWith(
      5,
      config.rds,
      'SELECT id, dmpId, modified, visibility FROM plans WHERE dmpId = ?',
      ['https://doi.org/10.1234/dmp-1'],
    );
    expect(queryTable).toHaveBeenNthCalledWith(
      6,
      config.rds,
      'SELECT id, dmpId, modified, visibility FROM plans WHERE dmpId = ?',
      ['https://doi.org/10.1234/dmp-1'],
    );
  });

  it('returns undefined when a valid plan lookup has no array result', async () => {
    isDmpId.mockReturnValue(true);
    queryTable.mockResolvedValue({ results: undefined, fields: [] });

    await expect(loadPlan(buildRequest(), '10.1234/dmp-1')).resolves.toBeUndefined();
  });
});

describe('maDMP persistence', () => {
  it('loads the first DynamoDB maDMP and logs whether it has a narrative', async () => {
    const request = buildRequest();
    const maDmp = dmp({ narrative: {} as DMPToolDMPType['dmp']['narrative'] });
    getDMPs.mockResolvedValue([maDmp]);

    await expect(loadMaDMPFromDynamo(request, 'dmp-1', '3')).resolves.toEqual(maDmp);
    expect(getDMPs).toHaveBeenCalledWith(config.dynamo, 'localhost:4060', 'dmp-1', '3', true);
    expect(request.log.debug).toHaveBeenLastCalledWith(
      'Fetched maDMP record for dmp-1. Has narrative? true',
    );
  });

  it('returns undefined when DynamoDB has no maDMP', async () => {
    getDMPs.mockResolvedValue([]);

    await expect(loadMaDMPFromDynamo(buildRequest(), 'dmp-1')).resolves.toBeUndefined();
    expect(getDMPs).toHaveBeenCalledWith(config.dynamo, 'localhost:4060', 'dmp-1', 'latest', true);
  });

  it('creates new maDMP records and updates outdated records', async () => {
    const request = buildRequest();
    const maDmp = dmp();

    await persistMaDMPRecord(request, 'example.org', 'dmp-1', maDmp);
    await persistMaDMPRecord(request, 'example.org', 'dmp-1', maDmp, true);

    expect(createDMP).toHaveBeenCalledWith(
      config.dynamo, 'example.org', 'dmp-1', maDmp, 'latest', false,
    );
    expect(updateDMP).toHaveBeenCalledWith(
      config.dynamo, 'localhost:4060', 'dmp-1', maDmp, 100, false,
    );
  });

  it('throws when maDMP generation lacks an RDS connection', async () => {
    const request = buildRequest({}, { rds: undefined });

    await expect(handleMissingMaDMP(request, plan, false)).rejects.toThrow(
      'Unable to generate maDMP record. Please try again later.',
    );
    expect(request.log.error).toHaveBeenCalledWith('RDS connection is not configured');
  });

  it('generates and persists a valid maDMP', async () => {
    const request = buildRequest();
    const maDmp = dmp();
    planToDMPCommonStandard.mockResolvedValue(maDmp);

    await expect(handleMissingMaDMP(request, plan, true)).resolves.toEqual(maDmp);
    expect(planToDMPCommonStandard).toHaveBeenCalledWith(
      config.rds, 'DMP Tool API', 'localhost:4060', 'test', 1, true,
    );
    expect(updateDMP).toHaveBeenCalledWith(
      config.dynamo, 'localhost:4060', 'dmp-1', maDmp, 100, false,
    );
  });

  it('returns unpersisted generation results without a DMP', async () => {
    const request = buildRequest();
    planToDMPCommonStandard.mockResolvedValue(undefined);

    await expect(handleMissingMaDMP(request, plan, false)).resolves.toBeUndefined();
    expect(createDMP).not.toHaveBeenCalled();
    expect(updateDMP).not.toHaveBeenCalled();
  });

  it('exposes the workflow helpers', () => {
    expect(maDMPHelpers).toEqual({
      loadPlan,
      loadMaDMPFromDynamo,
      handleMissingMaDMP,
    });
  });
});
