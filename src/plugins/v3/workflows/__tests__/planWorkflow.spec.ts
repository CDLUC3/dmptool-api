import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { convertMySQLDateTimeToRFC3339 } from '@dmptool/utils';
import { VersionedTemplate } from '../../../../models/VersionedTemplate.js';
import { Project } from '../../../../models/Project.js';
import { Plan } from '../../../../models/Plan.js';
import { ResearchDomain } from '../../../../models/ResearchDomain.js';
import { DEFAULT_LANGUAGE, LanguageMapThreeToFive } from '../../../../utils.js';
import { newFastifyError } from '../../../../handlers/error.js';

const mockSaveMembersWorkflow = jest.fn();
const mockSaveFundingWorkflow = jest.fn();
const mockCreateNarrativeWorkflow = jest.fn();
const mockLoadMaDMPFromDynamo = jest.fn();
const mockHandleMissingMaDMP = jest.fn();
const mockLoadPlan = jest.fn();

jest.unstable_mockModule('../memberWorkflow.js', () => ({
  saveMembersWorkflow: mockSaveMembersWorkflow,
}));

jest.unstable_mockModule('../fundingWorkflow.js', () => ({
  saveFundingWorkflow: mockSaveFundingWorkflow,
}));

jest.unstable_mockModule('../narrativeWorkflow.js', () => ({
  createNarrativeWorkflow: mockCreateNarrativeWorkflow,
}));

jest.unstable_mockModule('../../../../models/maDMP.js', () => ({
  loadMaDMPFromDynamo: mockLoadMaDMPFromDynamo,
  handleMissingMaDMP: mockHandleMissingMaDMP,
  loadPlan: mockLoadPlan,
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

const makeCreateBody = (id = 'external-dmp-id') =>
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

const makeUpdatePayload = (overrides: Record<string, unknown> = {}) =>
  ({
    title: 'Updated title',
    description: 'Updated description',
    status: 'draft',
    visibility: 'public',
    language: 'eng',
    isTestProject: true,
    project: [
      {
        title: 'Project title',
        description: 'Project description',
        start: '2026-01-01',
        end: '2026-12-31',
      },
    ],
    alternate_identifier: [],
    ...overrides,
  }) as unknown as import('@dmptool/types').DMPToolDMPType['dmp'];

const makePlan = (overrides: Record<string, unknown> = {}): Plan =>
  ({
    id: undefined,
    dmpId: '10.99999/abc',
    projectId: 55,
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
let getPlanWorkflow: (
  request: FastifyRequest,
  dmpId: string,
  version?: string
) => Promise<unknown>;
let updateDmpWorkflow: (
  request: FastifyRequest,
  dmpId: string,
  ifUnmodifiedSince: string,
  payload: import('@dmptool/types').DMPToolDMPType['dmp']
) => Promise<unknown>;
let deleteDmpWorkflow: (
  request: FastifyRequest,
  dmpId: string,
  ifUnmodifiedSince: string
) => Promise<boolean>;

beforeEach(async () => {
  mockSaveMembersWorkflow.mockReset();
  mockSaveFundingWorkflow.mockReset();
  mockCreateNarrativeWorkflow.mockReset();
  mockLoadMaDMPFromDynamo.mockReset();
  mockHandleMissingMaDMP.mockReset();
  mockLoadPlan.mockReset();

  mockSaveFundingWorkflow.mockImplementation(async (_request, _project, plan) => plan);
  mockSaveMembersWorkflow.mockImplementation(async (_request, _project, plan) => plan);
  mockCreateNarrativeWorkflow.mockImplementation(async (_request, plan) => plan);

  const workflowModule = await import('../planWorkflow.js');
  createPlanWorkflow = workflowModule.createPlanWorkflow;
  getPlanWorkflow = workflowModule.getPlanWorkflow;
  updateDmpWorkflow = workflowModule.updateDmpWorkflow;
  deleteDmpWorkflow = workflowModule.deleteDmpWorkflow;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getPlanWorkflow', () => {
  it('returns 404 when the plan cannot be loaded from RDS', async () => {
    mockLoadPlan.mockResolvedValue(undefined as never);

    const expected = newFastifyError('not_found', 'DMP not found');
    await expect(getPlanWorkflow(makeRequest(), '10.12345/abc')).rejects.toEqual(expected);
  });

  it('returns the current maDMP when DynamoDB metadata is up to date', async () => {
    const modified = '2026-01-01 00:00:00Z';
    const normalized = convertMySQLDateTimeToRFC3339(modified) as string;
    const maDMP = { dmp: { modified: normalized, narrative: { text: 'ok' } } };

    mockLoadPlan.mockResolvedValue({ dmpId: '10.12345/abc', modified } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue(maDMP as never);

    const result = await getPlanWorkflow(makeRequest(), '10.12345/abc');
    expect(result).toEqual(maDMP);
    expect(mockHandleMissingMaDMP).not.toHaveBeenCalled();
  });

  it('rebuilds maDMP when DynamoDB metadata is missing and returns it', async () => {
    const rebuilt = { dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'rebuilt' } } };

    mockLoadPlan.mockResolvedValue({
      dmpId: '10.12345/abc',
      modified: '2026-01-01 00:00:00Z',
    } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue(undefined as never);
    mockHandleMissingMaDMP.mockResolvedValue(rebuilt as never);

    const result = await getPlanWorkflow(makeRequest(), '10.12345/abc');

    expect(result).toEqual(rebuilt);
    expect(mockHandleMissingMaDMP).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dmpId: '10.12345/abc' }),
      undefined
    );
  });

  it('returns 500 when maDMP could not be rebuilt', async () => {
    mockLoadPlan.mockResolvedValue({
      dmpId: '10.12345/abc',
      modified: '2026-01-01 00:00:00Z',
    } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue(undefined as never);
    mockHandleMissingMaDMP.mockResolvedValue(undefined as never);

    const expected = newFastifyError('generic_error', 'Internal server error');
    await expect(getPlanWorkflow(makeRequest(), '10.12345/abc')).rejects.toEqual(expected);
  });
});

describe('updateDmpWorkflow', () => {
  it('returns replaced maDMP when update succeeds', async () => {
    const request = makeRequest();
    const plan = makePlan({ id: 44, projectId: 55 });
    const project = makeProject({ id: 55 });
    const current = { dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } } };
    const replaced = { dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } } };

    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValueOnce(current as never).mockResolvedValueOnce(replaced as never);

    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);
    jest.spyOn(ResearchDomain, 'findByURI').mockResolvedValue({ id: 77 } as never);

    const payload = makeUpdatePayload({
      project: [
        {
          title: 'Project title',
          description: 'Project description',
          start: '2026-01-01',
          end: '2026-12-31',
          researchDomain: {
            research_domain_identifier: { identifier: 'https://example.org/domain/77' },
          },
        },
      ],
    });

    const result = await updateDmpWorkflow(
      request,
      encodeURIComponent('10.99999/abc'),
      '2026-01-01T00:00:00Z',
      payload
    );

    expect(result).toEqual(replaced);
    expect(plan.languageId).toBe(LanguageMapThreeToFive.eng);
    expect(project.isTestProject).toBe(true);
  });

  it('uses default language when incoming language is invalid', async () => {
    const plan = makePlan({ id: 44, projectId: 55 });
    const project = makeProject({ id: 55 });
    const current = { dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } } };
    const replaced = { dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } } };

    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValueOnce(current as never).mockResolvedValueOnce(replaced as never);

    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);
    const researchDomainSpy = jest.spyOn(ResearchDomain, 'findByURI').mockResolvedValue(undefined as never);

    await updateDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.99999/abc'),
      '2026-01-01T00:00:00Z',
      makeUpdatePayload({ language: 'zzz' })
    );

    expect(plan.languageId).toBe(DEFAULT_LANGUAGE);
    expect(researchDomainSpy).not.toHaveBeenCalled();
  });

  it('rejects when update modified-date preconditions do not match', async () => {
    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);

    const expected = newFastifyError(
      'conflict',
      'The DMP has been modified since the time specified in the If-Unmodified-Since header'
    );
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-02T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });

  it('returns 404 when plan information cannot be loaded for update', async () => {
    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(undefined);

    const expected = newFastifyError('not_found', 'The DMP could not be found.');
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-01T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });

  it('returns 404 when project information cannot be loaded for update', async () => {
    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(makePlan({ id: 44, projectId: 55 }));
    jest.spyOn(Project, 'findById').mockResolvedValue(undefined);

    const expected = newFastifyError('not_found', 'The DMP could not be found.');
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-01T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });

  it('returns 400 when project save fails during update', async () => {
    const plan = makePlan({ id: 44, projectId: 55 });
    const project = makeProject({
      id: 55,
      save: jest.fn().mockResolvedValue(false as never),
      errorsToString: jest.fn().mockReturnValue('project: invalid'),
      errors: { title: 'invalid' },
    });

    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);

    const expected = newFastifyError('invalid_dmp', 'project: invalid');
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-01T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });

  it('returns 400 when plan save fails during update', async () => {
    const plan = makePlan({
      id: 44,
      projectId: 55,
      save: jest.fn().mockResolvedValue(false as never),
      errorsToString: jest.fn().mockReturnValue('plan: invalid'),
      errors: { title: 'invalid' },
    });
    const project = makeProject({ id: 55 });

    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);

    const expected = newFastifyError('invalid_dmp', 'plan: invalid');
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-01T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });

  it('returns 400 when member/artifact processing leaves update plan with errors', async () => {
    const plan = makePlan({
      id: 44,
      projectId: 55,
      hasErrors: jest.fn().mockReturnValue(true),
      errorsToString: jest.fn().mockReturnValue('members: bad data'),
      errors: { members: 'bad data' },
    });
    const project = makeProject({ id: 55 });

    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);

    const expected = newFastifyError('invalid_dmp', 'members: bad data');
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-01T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });

  it('returns 400 when replaced maDMP cannot be loaded', async () => {
    const plan = makePlan({ id: 44, projectId: 55 });
    const project = makeProject({ id: 55 });

    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValueOnce({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never).mockResolvedValueOnce(undefined as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    jest.spyOn(Project, 'findById').mockResolvedValue(project);

    const expected = newFastifyError(
      'invalid_dmp',
      'Your DMP was replaced but we could not generate a valid JSON response. Try "GET /dmps/10.99999/abc"'
    );
    await expect(
      updateDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-01T00:00:00Z',
        makeUpdatePayload()
      )
    ).rejects.toEqual(expected);
  });
});

describe('deleteDmpWorkflow', () => {
  it('returns false when delete preconditions are valid', async () => {
    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);

    const result = await deleteDmpWorkflow(
      makeRequest(),
      encodeURIComponent('10.99999/abc'),
      '2026-01-01T00:00:00Z'
    );

    expect(result).toBe(false);
  });

  it('rejects when delete modified-date preconditions do not match', async () => {
    mockLoadPlan.mockResolvedValue({ dmpId: '10.99999/abc', modified: '2026-01-01 00:00:00Z' } as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { modified: '2026-01-01T00:00:00Z', narrative: { text: 'current' } },
    } as never);

    const expected = newFastifyError(
      'conflict',
      'The DMP has been modified since the time specified in the If-Unmodified-Since header'
    );
    await expect(
      deleteDmpWorkflow(
        makeRequest(),
        encodeURIComponent('10.99999/abc'),
        '2026-01-02T00:00:00Z'
      )
    ).rejects.toEqual(expected);
  });
});

describe('createPlanWorkflow', () => {
  it('returns 400 when incoming dmp id belongs to local shoulder', async () => {
    const expected = newFastifyError('generic_error', 'Invalid DMP id');
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody('10.99999/local-id')))
      .rejects.toEqual(expected);
  });

  it('returns 500 when template cannot be found', async () => {
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue(undefined);

    const expected = newFastifyError('generic_error', 'Missing template');
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
  });

  it('returns 400 when more than one project is supplied', async () => {
    const body = makeCreateBody();
    body.dmp.project = [{ title: 'One' }, { title: 'Two' }] as never;

    const expected = newFastifyError('dmp_invalid', 'Only one project is currently supported per DMP.');
    await expect(createPlanWorkflow(makeRequest(), body)).rejects.toEqual(expected);
  });

  it('returns 400 when plan already exists', async () => {
    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue({
      id: 99, dmpId: '10.12345/test',
    } as never);

    const expected = newFastifyError('dmp_already_exists', 'DMP already exists');
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
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
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
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
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
  });

  it('returns 500 when plan save succeeds but dmp id is not assigned', async () => {
    const plan = makePlan({ dmpId: undefined });
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);

    const expected = newFastifyError('generic_error', 'Unable to generate DMP id.');
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
  });

  it('continues when alternate identifier save fails but no model errors are present', async () => {
    const request = makeRequest();
    const plan = makePlan({ saveAlternateIdentifiers: jest.fn().mockResolvedValue(false as never) });
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);

    const result = await createPlanWorkflow(request, makeCreateBody());

    expect(result).toEqual({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);
    expect(request.log.error).toHaveBeenCalledWith(
      { planId: plan.id, alternateIdentifiers: expect.any(Array) },
      'Unable to save alternate identifiers for the new plan'
    );
  });

  it('logs when non-fatal narrative persistence fails but still returns maDMP', async () => {
    const request = makeRequest();
    const plan = makePlan();
    const project = makeProject();
    const planWithNarrativeError = makePlan({
      id: 88,
      errors: { narrative: 'bad narrative' },
      hasErrors: jest.fn().mockReturnValue(true),
    });

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    mockCreateNarrativeWorkflow.mockResolvedValue(planWithNarrativeError as never);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);

    await createPlanWorkflow(request, makeCreateBody());

    expect(request.log.error).toHaveBeenCalledWith(
      { planId: plan.id, errors: planWithNarrativeError.errors },
      'Unable to save the plan narrative'
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

    const expected = newFastifyError('invalid_dmp', 'members: bad data');
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
  });

  it('returns 500 when maDMP cannot be loaded after successful saves', async () => {
    const plan = makePlan();
    const project = makeProject();

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    mockLoadMaDMPFromDynamo.mockResolvedValue(undefined as never);

    const expected = newFastifyError(
      'generic_error',
      'Your DMP was created but we could not generate a valid JSON response. Try "GET /dmps/10.99999/abc"'
    );
    await expect(createPlanWorkflow(makeRequest(), makeCreateBody())).rejects.toEqual(expected);
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

    mockLoadMaDMPFromDynamo.mockResolvedValue(newMaDMP as never);

    const result = await createPlanWorkflow(makeRequest(), makeCreateBody());
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
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);

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
    const body = makeCreateBody('external-id-2');

    jest.spyOn(VersionedTemplate, 'findOrDefault').mockResolvedValue({ id: 999 } as never);
    jest.spyOn(Plan, 'findOrInitialize').mockResolvedValue(plan);
    jest.spyOn(Project, 'findOrInitialize').mockResolvedValue(project);
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);

    await createPlanWorkflow(makeRequest(), body);

    expect(plan.warnings).toEqual(
      expect.objectContaining({
        template: expect.stringContaining('default template was used instead'),
      })
    );
  });

  it('does not mutate the incoming body object', async () => {
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
    mockLoadMaDMPFromDynamo.mockResolvedValue({
      dmp: { dmp_id: { identifier: '10.99999/abc', type: 'other' } },
    } as never);

    await createPlanWorkflow(makeRequest(), body);

    expect(body.dmp.provenance).toBeUndefined();
    expect(Array.isArray(body.dmp.alternate_identifier)).toBe(true);
    expect(body.dmp.alternate_identifier).toHaveLength(0);
  });
});
