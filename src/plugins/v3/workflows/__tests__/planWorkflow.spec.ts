import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { VersionedTemplate } from '../../../../models/VersionedTemplate.js';
import { Project } from '../../../../models/Project.js';
import { Plan } from '../../../../models/Plan.js';

const mockSaveMembersWorkflow = jest.fn();
const mockSaveFundingWorkflow = jest.fn();
const mockLoadMaDMPFromDynamo = jest.fn();

jest.unstable_mockModule('../memberWorkflow.js', () => ({
  saveMembersWorkflow: mockSaveMembersWorkflow,
}));

jest.unstable_mockModule('../fundingWorkflow.js', () => ({
  saveFundingWorkflow: mockSaveFundingWorkflow,
}));

jest.unstable_mockModule('../../../../models/maDMP.js', () => ({
  loadMaDMPFromDynamo: mockLoadMaDMPFromDynamo,
}));

const makeRequest = (): FastifyRequest =>
  ({
    caller: 'test-caller',
    dmptoolConfig: {
      defaultCaller: 'default-caller',
      dmpIdShoulder: '10.99999/',
      applicationName: 'DMPTool',
    },
    log: {
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    },
  }) as unknown as FastifyRequest;

const makeBody = (id = 'external-dmp-id') =>
  ({
    dmp: {
      title: 'My DMP',
      dmp_id: { identifier: id, type: 'other' },
      alternate_identifier: [],
      contact: { name: 'Test Contact' },
      contributor: [],
      narrative: { template: { id: 12 } },
    },
  }) as unknown as import('@dmptool/types').DMPToolDMPType;

describe('createPlanWorkflow', () => {
  let createPlanWorkflow: (
    request: FastifyRequest,
    body: import('@dmptool/types').DMPToolDMPType
  ) => Promise<unknown>;

  beforeEach(async () => {
    mockSaveMembersWorkflow.mockReset();
    mockSaveFundingWorkflow.mockReset();
    mockLoadMaDMPFromDynamo.mockReset();
    mockSaveMembersWorkflow.mockImplementation(async (_r, _project, plan) => plan);
    mockSaveFundingWorkflow.mockImplementation(async (_r, _project, plan) => plan);

    const workflowModule = await import('../planWorkflow.js');
    createPlanWorkflow = workflowModule.createPlanWorkflow;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 400 when incoming dmp id belongs to local shoulder', async () => {
    const result = await createPlanWorkflow(makeRequest(), makeBody('10.99999/local-id'));

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'The DMPTool is responsible for assigning DMP ids.',
      logLevel: 'warn',
    });
  });

  it('returns 500 when template cannot be found', async () => {
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue(undefined);

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to find a template',
      logLevel: 'fatal',
    });
  });

  it('returns 400 when more than one project is supplied', async () => {
    const body = makeBody();
    body.dmp.project = [{ title: 'One' }, { title: 'Two' }] as never;

    const result = await createPlanWorkflow(makeRequest(), body);

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'Only one project is currently supported per DMP.',
      logLevel: 'warn',
    });
  });

  it('returns 400 when plan already exists', async () => {
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue({ id: 99 } as never);

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_already_exists',
      message: 'DMP already exists',
      logLevel: 'warn',
    });
  });

  it('returns 400 when project save fails for a new project', async () => {
    const plan = { id: undefined, errors: {} } as unknown as Plan;
    const project = {
      id: undefined,
      errors: { title: 'invalid' },
      save: jest.fn().mockResolvedValue(false as never),
    } as unknown as Project;

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    jest.spyOn(Project, 'errorsToString').mockReturnValue('title: invalid');

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'title: invalid',
      logLevel: 'error',
    });
  });

  it('returns 400 when plan save fails', async () => {
    const plan = {
      id: undefined,
      dmpId: undefined,
      errors: { graphQL: 'bad plan' },
      save: jest.fn().mockResolvedValue(false as never),
      saveAlternateIdentifiers: jest.fn().mockResolvedValue(true as never),
    } as unknown as Plan;

    const project = {
      id: 55,
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
    } as unknown as Project;

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    jest.spyOn(Plan, 'errorsToString').mockReturnValue('graphQL: bad plan');

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'graphQL: bad plan',
      logLevel: 'error',
    });
  });

  it('treats lenient artifact errors as non-fatal and only fails if downstream retrieval fails', async () => {
    const plan = {
      id: undefined,
      dmpId: '10.99999/abc',
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
      saveAlternateIdentifiers: jest.fn().mockResolvedValue(false as never),
    } as unknown as Plan;

    const project = {
      id: 55,
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
    } as unknown as Project;

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(true);
    jest.spyOn(Plan, 'errorsToString').mockReturnValue('alternateIdentifiers: failed');

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to complete your request at this time. Please try again later.',
      logLevel: 'fatal',
    });
  });

  it('returns 500 when maDMP cannot be loaded after successful saves', async () => {
    const plan = {
      id: undefined,
      dmpId: '10.99999/abc',
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
      saveAlternateIdentifiers: jest.fn().mockResolvedValue(true as never),
    } as unknown as Plan;

    const project = {
      id: 55,
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
    } as unknown as Project;

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(false);
    mockLoadMaDMPFromDynamo.mockResolvedValue(undefined as never);

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to complete your request at this time. Please try again later.',
      logLevel: 'fatal',
    });
  });

  it('returns 201 with maDMP payload when workflow succeeds', async () => {
    const plan = {
      id: undefined,
      dmpId: '10.99999/abc',
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
      saveAlternateIdentifiers: jest.fn().mockResolvedValue(true as never),
    } as unknown as Plan;

    const project = {
      id: 55,
      errors: {},
      save: jest.fn().mockResolvedValue(true as never),
    } as unknown as Project;

    const newMaDMP = {
      dmp: {
        title: 'My DMP',
        dmp_id: { identifier: '10.99999/abc', type: 'other' },
      },
    };

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(false);
    mockLoadMaDMPFromDynamo.mockResolvedValue(newMaDMP as never);

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual({
      ok: true,
      statusCode: 201,
      data: newMaDMP,
    });
  });

  it('does not mutate the incoming body object', async () => {
    const request = makeRequest();
    const body = {
      dmp: {
        title: 'My DMP',
        dmp_id: { identifier: 'external-id-1', type: 'other' },
        alternate_identifier: [],
        contact: { name: 'Test Contact' },
        contributor: [],
      },
    } as unknown as import('@dmptool/types').DMPToolDMPType;

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue(undefined);

    await createPlanWorkflow(request, body);

    expect(body.dmp.provenance).toBeUndefined();
    expect(Array.isArray(body.dmp.alternate_identifier)).toBe(true);
    expect(body.dmp.alternate_identifier).toHaveLength(0);
  });
});
