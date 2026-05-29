import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FastifyRequest } from 'fastify';
import { VersionedTemplate } from '../../../../models/VersionedTemplate.js';
import { Project } from '../../../../models/Project.js';
import { Plan } from '../../../../models/Plan.js';
import {newFastifyError} from "../../../../handlers/error.js";

const mockSaveMembersWorkflow = jest.fn();
const mockLoadMaDMPFromDynamo = jest.fn();

jest.unstable_mockModule('../memberWorkflow.js', () => ({
  saveMembersWorkflow: mockSaveMembersWorkflow,
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

const makeRequestWithoutCaller = (): FastifyRequest =>
  ({
    ...makeRequest(),
    caller: undefined,
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

const makePlan = (overrides: Record<string, unknown> = {}): Plan =>
  ({
    id: undefined,
    dmpId: '10.99999/abc',
    errors: {},
    warnings: {},
    save: jest.fn().mockResolvedValue(true as never),
    saveAlternateIdentifiers: jest.fn().mockResolvedValue(true as never),
    hasErrors: jest.fn().mockReturnValue(false),
    errorsToString: jest.fn().mockReturnValue(''),
    ...overrides,
  }) as unknown as Plan;

const makeProject = (overrides: Record<string, unknown> = {}): Project =>
  ({
    id: 55,
    errors: {},
    save: jest.fn().mockResolvedValue(true as never),
    errorsToString: jest.fn().mockReturnValue(''),
    ...overrides,
  }) as unknown as Project;

let createPlanWorkflow: (
  request: FastifyRequest,
  body: import('@dmptool/types').DMPToolDMPType
) => Promise<unknown>;
let updateDmpWorkflow: (
  request: FastifyRequest,
  dmpId: string,
  ifUnmodifiedSince: string,
  currentDmp: import('@dmptool/types').DMPToolDMPType
) => Promise<unknown>;
let deleteDmpWorkflow: (
  request: FastifyRequest,
  dmpId: string,
  ifUnmodifiedSince: string,
  currentDmpModifiedDate: string
) => Promise<boolean>;

beforeEach(async () => {
  mockSaveMembersWorkflow.mockReset();
  mockLoadMaDMPFromDynamo.mockReset();
  mockSaveMembersWorkflow.mockImplementation(async (_request, _project, plan) => plan);

  const workflowModule = await import('../planWorkflow.js');
  createPlanWorkflow = workflowModule.createPlanWorkflow;
  updateDmpWorkflow = workflowModule.updateDmpWorkflow;
  deleteDmpWorkflow = workflowModule.deleteDmpWorkflow;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('updateDmpWorkflow', () => {
  it('returns the current DMP when update preconditions are valid', async () => {
    const currentDmp = {
      dmp: {
        modified: '2021-01-01 00:00:00Z',
      },
    } as never;

    const result = await updateDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.12345/abc'),
      '2021-01-01T00:00:00Z',
      currentDmp
    );

    expect(result).toBe(currentDmp);
  });

  it('rejects when update modified-date preconditions do not match', async () => {
    const expected = newFastifyError(
      'conflict',
      'The DMP has been modified since the time specified in the If-Unmodified-Since header'
    );
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.12345/abc'),
        '2021-01-02T00:00:00Z',
        {
          dmp: {
            modified: '2021-01-01 00:00:00Z',
          },
        } as never
      )
    ).rejects.toEqual(expected);
  });
});

describe('deleteDmpWorkflow', () => {
  it('returns true when delete preconditions are valid', async () => {
    const result = await deleteDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.12345/abc'),
      '2021-01-01T00:00:00Z',
      '2021-01-01 00:00:00Z'
    );

    expect(result).toBe(true);
  });

  it('rejects when delete modified-date preconditions do not match', async () => {
    const expected = newFastifyError(
      'conflict',
      'The DMP has been modified since the time specified in the If-Unmodified-Since header'
    );
    await expect(
      deleteDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.12345/abc'),
        '2021-01-02T00:00:00Z',
        '2021-01-01 00:00:00Z'
      )
    ).rejects.toEqual(expected);
  });
});

describe('createPlanWorkflow', () => {
  it('returns 400 when incoming dmp id belongs to local shoulder', async () => {
    const expected = newFastifyError('generic_error', 'Invalid DMP id');
    await expect(createPlanWorkflow(makeRequest(), makeBody('10.99999/local-id')))
      .rejects.toEqual(expected);
  });

  it('returns 500 when template cannot be found', async () => {
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue(undefined);

    const expected = newFastifyError('generic_error', 'Missing template');
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('returns 400 when plan already exists', async () => {
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue({ id: 99 } as never);

    const expected = newFastifyError('dmp_already_exists', 'DMP already exists');
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('returns 400 when project save fails for a new project', async () => {
    const plan = makePlan();
    const project = makeProject({
      id: undefined,
      errors: { title: 'invalid' },
      errorsToString: jest.fn().mockReturnValue('title: invalid'),
      save: jest.fn().mockResolvedValue(false as never),
    });

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    const expected = newFastifyError('invalid_dmp', 'title: invalid');
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('returns 400 when plan save fails', async () => {
    const plan = makePlan({
      dmpId: undefined,
      errors: { graphQL: 'bad plan' },
      save: jest.fn().mockResolvedValue(false as never),
      errorsToString: jest.fn().mockReturnValue('graphQL: bad plan'),
    });

    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    const expected = newFastifyError('invalid_dmp', 'graphQL: bad plan');
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('returns 500 when plan save succeeds but dmp id is not assigned', async () => {
    const plan = makePlan({ dmpId: undefined });
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    const expected = newFastifyError('generic_error', 'Unable to generate DMP id.');
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('continues when non-fatal artifact persistence fails but no model errors are present', async () => {
    const request = makeRequest();
    const plan = makePlan({ saveAlternateIdentifiers: jest.fn().mockResolvedValue(false as never) });
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);

    const result = await createPlanWorkflow(request, makeBody());

    expect(result).toEqual({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);
    expect(request.log.error).toHaveBeenCalledWith(
      { planId: plan.id, alternateIdentifiers: expect.any(Array) },
      'Unable to save alternate identifiers for the new plan'
    );
  });

  it('returns 400 when member/artifact processing leaves the plan with errors', async () => {
    const plan = makePlan({
      errors: { members: 'bad data' },
      hasErrors: jest.fn().mockReturnValue(true),
      errorsToString: jest.fn().mockReturnValue('members: bad data'),
    });
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    mockSaveMembersWorkflow.mockResolvedValue(plan as never);

    const expected = newFastifyError('invalid_dmp', 'members: bad data');
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('returns 500 when maDMP cannot be loaded after successful saves', async () => {
    const plan = makePlan();
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue(undefined as never);

    const expected = newFastifyError(
      'generic_error',
      'Your DMP was created but we could not generate a valid JSON response. Try "GET /dmps/10.99999/abc"'
    );
    await expect(createPlanWorkflow(makeRequest(), makeBody())).rejects.toEqual(expected);
  });

  it('returns 201 with maDMP payload when workflow succeeds', async () => {
    const plan = makePlan();
    const project = makeProject();

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
    mockLoadMaDMPFromDynamo.mockResolvedValue(newMaDMP as never);

    const result = await createPlanWorkflow(makeRequest(), makeBody());

    expect(result).toEqual(newMaDMP);
  });

  it('uses default caller provenance and does not duplicate alternate identifiers', async () => {
    const request = makeRequestWithoutCaller();
    const body = {
      dmp: {
        title: 'My DMP',
        dmp_id: { identifier: 'external-id-1', type: 'other' },
        alternate_identifier: [{ identifier: 'external-id-1', type: 'other' }],
        contact: { name: 'Test Contact' },
        contributor: [],
        narrative: { template: { id: 12 } },
      },
    } as unknown as import('@dmptool/types').DMPToolDMPType;
    const plan = makePlan();
    const project = makeProject();

    const planSpy = jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 12 } as never);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({ dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } } } as never);

    await createPlanWorkflow(request, body);

    const normalizedDmp = planSpy.mock.calls[0][2];
    expect(normalizedDmp.provenance).toBe('default-caller');
    expect(normalizedDmp.alternate_identifier).toHaveLength(1);
    expect(normalizedDmp.alternate_identifier[0].identifier).toBe('external-id-1');
    expect(plan.saveAlternateIdentifiers).toHaveBeenCalledWith(request, normalizedDmp.alternate_identifier);
  });

  it('adds a warning when the requested template is not found and default is used', async () => {
    const plan = makePlan();
    const project = makeProject();
    const body = makeBody('external-id-2');

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 999 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    mockSaveMembersWorkflow.mockResolvedValue(plan as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({ dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } } } as never);

    await createPlanWorkflow(makeRequest(), body);

    expect(plan.warnings).toEqual(
      expect.objectContaining({
        template: expect.stringContaining('default template was used instead'),
      })
    );
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
        narrative: { template: { id: 12 } },
      },
    } as unknown as import('@dmptool/types').DMPToolDMPType;

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(makePlan());
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(makeProject());
    mockSaveMembersWorkflow.mockResolvedValue(makePlan() as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({ dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } } } as never);

    await createPlanWorkflow(request, body);

    expect(body.dmp.provenance).toBeUndefined();
    expect(Array.isArray(body.dmp.alternate_identifier)).toBe(true);
    expect(body.dmp.alternate_identifier).toHaveLength(0);
  });
});
