import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { saveFundingWorkflow } from '../fundingWorkflow.js';
import { Affiliation } from '../../../../models/Affiliation.js';
import { Plan } from '../../../../models/Plan.js';
import { PlanFunding } from '../../../../models/PlanFunding.js';
import { Project } from '../../../../models/Project.js';
import { ProjectFunding } from '../../../../models/ProjectFunding.js';

const makeRequest = (): FastifyRequest =>
  ({
    log: {
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('saveFundingWorkflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper: mock a successful affiliation findOrInitialize that returns an existing affiliation
  const mockExistingAffiliation = (id = 99) => {
    jest.spyOn(Affiliation, 'findOrInitialize').mockResolvedValue(
      new Affiliation({ id, uri: 'https://ror.org/03yrm5c26', name: 'Example Funder', funder: true })
    );
  };

  it('converts funding and extension values into project and plan funding saves', async () => {
    const request = makeRequest();
    const project = { id: 22, errors: {} } as Project;
    const plan = { id: 11, dmpId: '10.12345/test', errors: {} } as Plan;
    const dmp = {
      project: [
        {
          project_id: [{ identifier: 'https://example.org/projects/22' }],
          funding: [
            {
              funder_id: { identifier: 'https://ror.org/03yrm5c26' },
              funding_status: 'granted',
              grant_id: { identifier: 'grant-001' },
              name: 'Example Funder',
            },
          ],
        },
      ],
      funding_opportunity: [
        {
          project_id: { identifier: 'https://example.org/projects/22' },
          funder_id: { identifier: 'https://ror.org/03yrm5c26' },
          opportunity_identifier: { identifier: 'opp-123' },
        },
      ],
      funding_project: [
        {
          project_id: { identifier: 'https://example.org/projects/22' },
          funder_id: { identifier: 'https://ror.org/03yrm5c26' },
          project_identifier: { identifier: 'proj-456' },
        },
      ],
    } as never;

    mockExistingAffiliation();

    const saveProjectFundingSpy = jest
      .spyOn(ProjectFunding, 'save')
      .mockImplementation(async (_request, _project, fundings) => {
        fundings.forEach((funding, i) => {
          funding.id = i + 100;
        });
        return true;
      });

    const fromProjectFundingsSpy = jest.spyOn(PlanFunding, 'fromProjectFundings');
    const savePlanFundingSpy = jest
      .spyOn(PlanFunding, 'save')
      .mockResolvedValue(true);

    const result = await saveFundingWorkflow(request, project, plan, dmp);

    expect(result).toBe(plan);
    expect(saveProjectFundingSpy).toHaveBeenCalledTimes(1);
    const savedFundings = saveProjectFundingSpy.mock.calls[0][2];
    expect(savedFundings).toHaveLength(1);
    expect(savedFundings[0].status).toBe('GRANTED');
    expect(savedFundings[0].grantId).toBe('grant-001');
    expect(savedFundings[0].funderOpportunityNumber).toBe('opp-123');
    expect(savedFundings[0].funderProjectNumber).toBe('proj-456');
    // The affiliation on the funding entry should be the one resolved by findOrInitialize
    expect(savedFundings[0].affiliation?.id).toBe(99);
    expect(fromProjectFundingsSpy).toHaveBeenCalledWith(plan, savedFundings);
    expect(savePlanFundingSpy).toHaveBeenCalledTimes(1);
  });

  it('creates a new affiliation when findOrInitialize returns one with no id', async () => {
    const request = makeRequest();
    const project = { id: 22, errors: {} } as Project;
    const plan = { id: 11, dmpId: '10.12345/test', errors: {} } as Plan;
    const dmp = {
      project: [
        {
          funding: [
            {
              funder_id: { identifier: 'https://ror.org/newone' },
              funding_status: 'planned',
              name: 'New Funder',
            },
          ],
        },
      ],
    } as never;

    // findOrInitialize returns an affiliation without an id (new/unsaved)
    const newAffiliation = new Affiliation({ uri: 'https://ror.org/newone', name: 'New Funder', funder: true });
    jest.spyOn(Affiliation, 'findOrInitialize').mockResolvedValue(newAffiliation);
    // create succeeds and sets the id
    const createSpy = jest.spyOn(newAffiliation, 'create').mockImplementation(async () => {
      newAffiliation.id = 55;
      return true;
    });

    jest.spyOn(ProjectFunding, 'save').mockResolvedValue(true);
    jest.spyOn(PlanFunding, 'save').mockResolvedValue(true);

    const result = await saveFundingWorkflow(request, project, plan, dmp);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(plan);
    expect(request.log.warn).not.toHaveBeenCalled();
  });

  it('skips a funding entry and logs a warning when affiliation creation fails', async () => {
    const request = makeRequest();
    const project = { id: 22, errors: {} } as Project;
    const plan = { id: 11, dmpId: '10.12345/test', errors: {} } as Plan;
    const dmp = {
      project: [
        {
          funding: [
            {
              funder_id: { identifier: 'https://ror.org/bad' },
              funding_status: 'planned',
              name: 'Bad Funder',
            },
          ],
        },
      ],
    } as never;

    // findOrInitialize returns an unsaved affiliation
    const newAffiliation = new Affiliation({ uri: 'https://ror.org/bad', name: 'Bad Funder', funder: true });
    jest.spyOn(Affiliation, 'findOrInitialize').mockResolvedValue(newAffiliation);
    // create fails
    jest.spyOn(newAffiliation, 'create').mockResolvedValue(false);

    const saveProjectFundingSpy = jest.spyOn(ProjectFunding, 'save').mockResolvedValue(true);
    jest.spyOn(PlanFunding, 'save').mockResolvedValue(true);

    const result = await saveFundingWorkflow(request, project, plan, dmp);

    // The failed entry is skipped, so save is called with an empty array
    expect(request.log.warn).toHaveBeenCalled();
    const savedFundings = saveProjectFundingSpy.mock.calls[0][2];
    expect(savedFundings).toHaveLength(0);
    expect(result).toBe(plan);
  });

  it('logs and returns early when project funding save fails', async () => {
    const request = makeRequest();
    const project = {
      id: 22,
      errors: { fundings: 'bad fundings' },
    } as unknown as Project;
    const plan = { id: 11, dmpId: '10.12345/test', errors: {} } as Plan;

    mockExistingAffiliation();
    jest.spyOn(ProjectFunding, 'save').mockResolvedValue(false);
    const savePlanFundingSpy = jest.spyOn(PlanFunding, 'save').mockResolvedValue(true);

    const result = await saveFundingWorkflow(
      request,
      project,
      plan,
      { project: [{ funding: [{ funder_id: { identifier: 'https://ror.org/x' } }] }] } as never
    );

    expect(result).toBe(plan);
    expect(plan.errors.fundings).toBe('bad fundings');
    expect(request.log.error).toHaveBeenCalled();
    expect(savePlanFundingSpy).not.toHaveBeenCalled();
  });
});

