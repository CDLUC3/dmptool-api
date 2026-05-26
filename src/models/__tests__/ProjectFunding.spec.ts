import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Affiliation } from '../Affiliation.js';
import { Project } from '../Project.js';
import { ProjectFunding } from '../ProjectFunding.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('ProjectFunding', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates project funding successfully', async () => {
    const funding = new ProjectFunding({
      project: new Project({ id: 1 }),
      affiliation: new Affiliation({ id: 2, uri: 'https://ror.org/123' }),
      status: 'GRANTED',
      grantId: 'grant-123',
    });

    jest.spyOn(ProjectFunding, 'mutate').mockResolvedValue({
      data: {
        addProjectFunding: {
          id: 10,
          project: funding.project,
          affiliation: funding.affiliation,
          status: 'GRANTED',
          grantId: 'grant-123',
          funderOpportunityNumber: null,
          funderProjectNumber: null,
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await ProjectFunding.create(buildRequest(), funding);

    expect(result).toBe(true);
    expect(funding.id).toBe(10);
  });

  it('returns false when affiliation uri is missing', async () => {
    const funding = new ProjectFunding({
      project: new Project({ id: 1 }),
      affiliation: new Affiliation({ name: 'Unknown Funder' }),
    });

    const result = await ProjectFunding.create(buildRequest(), funding);

    expect(result).toBe(false);
    expect(funding.errors.affiliationId).toBe('Funding affiliation URI is required');
  });

  it('finds project funding by project id', async () => {
    jest.spyOn(ProjectFunding, 'query').mockResolvedValue({
      data: {
        projectFundings: [
          {
            id: 1,
            project: new Project({ id: 1 }),
            affiliation: new Affiliation({ id: 2, uri: 'https://ror.org/123' }),
            status: 'PLANNED',
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        ],
      },
    });

    const result = await ProjectFunding.findByProjectId(buildRequest(), 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(ProjectFunding);
  });

  it('save returns false when the project has no id', async () => {
    const project = new Project({ errors: {} as never });

    const result = await ProjectFunding.save(buildRequest(), project, []);

    expect(result).toBe(false);
  });

  it('save deletes unmatched fundings and updates/creates desired fundings', async () => {
    const request = buildRequest();
    const project = new Project({ id: 11, errors: {} });

    const existingA = new ProjectFunding({
      id: 21,
      affiliation: new Affiliation({ uri: 'https://ror.org/a' }),
      status: 'PLANNED',
    });
    const existingB = new ProjectFunding({
      id: 22,
      affiliation: new Affiliation({ uri: 'https://ror.org/b' }),
      status: 'DENIED',
    });

    const desiredUpdate = new ProjectFunding({
      affiliation: new Affiliation({ uri: 'https://ror.org/a' }),
      status: 'GRANTED',
    });
    const desiredCreate = new ProjectFunding({
      affiliation: new Affiliation({ uri: 'https://ror.org/c' }),
      status: 'PLANNED',
    });

    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([existingA, existingB]);
    const deleteSpy = jest.spyOn(ProjectFunding, 'delete').mockResolvedValue(true);
    const updateSpy = jest.spyOn(ProjectFunding, 'update').mockResolvedValue(true);
    const createSpy = jest.spyOn(ProjectFunding, 'create').mockResolvedValue(true);

    const result = await ProjectFunding.save(request, project, [desiredUpdate, desiredCreate]);

    expect(result).toBe(true);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(request, expect.objectContaining({ id: 22 }));
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(desiredUpdate.id).toBe(21);
  });

  it('save collects errors when update fails', async () => {
    const request = buildRequest();
    const project = new Project({ id: 11, errors: {} });

    const desired = new ProjectFunding({
      id: 44,
      affiliation: new Affiliation({ uri: 'https://ror.org/a' }),
    });

    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'update').mockResolvedValue(false);
    jest.spyOn(ProjectFunding, 'errorsToString').mockReturnValue('status: invalid');

    const result = await ProjectFunding.save(request, project, [desired]);

    expect(result).toBe(false);
    expect(project.errors.fundings).toContain('status: invalid');
  });

  it('save succeeds even when project has unrelated existing errors', async () => {
    const request = buildRequest();
    const project = new Project({
      id: 11,
      errors: { members: 'non-funding warning' } as never,
    });
    const desired = new ProjectFunding({
      affiliation: new Affiliation({ uri: 'https://ror.org/a' }),
      status: 'PLANNED',
    });

    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'create').mockResolvedValue(true);

    const result = await ProjectFunding.save(request, project, [desired]);

    expect(result).toBe(true);
    expect(project.errors.members).toBe('non-funding warning');
    expect(project.errors.fundings).toBeUndefined();
  });

  it('save clears stale funding errors before a successful sync', async () => {
    const request = buildRequest();
    const project = new Project({
      id: 11,
      errors: { fundings: 'old funding error' } as never,
    });
    const desired = new ProjectFunding({
      affiliation: new Affiliation({ uri: 'https://ror.org/a' }),
      status: 'PLANNED',
    });

    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'create').mockResolvedValue(true);

    const result = await ProjectFunding.save(request, project, [desired]);

    expect(result).toBe(true);
    expect(project.errors.fundings).toBeUndefined();
  });

  it('updates project funding and resolves affiliation by URI when id is missing', async () => {
    const request = buildRequest();
    const funding = new ProjectFunding({
      id: 10,
      project: new Project({ id: 1 }),
      affiliation: new Affiliation({ uri: 'https://ror.org/abc' }),
      status: 'GRANTED',
    });

    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(
      new Affiliation({ id: 77, uri: 'https://ror.org/abc' })
    );
    jest.spyOn(ProjectFunding, 'mutate').mockResolvedValue({
      data: {
        updateProjectFunding: {
          id: 10,
          project: funding.project,
          affiliation: funding.affiliation,
          status: 'GRANTED',
          grantId: null,
          funderOpportunityNumber: null,
          funderProjectNumber: null,
          created: 'c',
          createdById: 1,
          modified: 'updated',
          modifiedById: 99,
        },
      },
    });

    const result = await ProjectFunding.update(request, funding);

    expect(result).toBe(true);
    expect(funding.affiliation?.id).toBe(77);
    expect(funding.modified).toBe('updated');
    expect(funding.modifiedById).toBe(99);
  });

  it('delete returns false when mutation reports errors', async () => {
    const funding = new ProjectFunding({ id: 5 });

    jest.spyOn(ProjectFunding, 'mutate').mockResolvedValue({
      data: {
        removeProjectFunding: {
          id: 5,
          project: new Project({ id: 1 }),
          affiliation: new Affiliation({ uri: 'https://ror.org/abc' }),
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
          errors: { general: 'cannot delete' },
        },
      },
    });

    const result = await ProjectFunding.delete(buildRequest(), funding);

    expect(result).toBe(false);
  });
});

