import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Plan } from '../Plan.js';
import { VersionedTemplate } from '../VersionedTemplate.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('Plan', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const plan = new Plan({ title: 'Test Plan' });

    expect(plan.title).toBe('Test Plan');
    expect(plan.visibility).toBe('PRIVATE');
    expect(plan.status).toBe('DRAFT');
    expect(plan.alternateIdentifiers).toEqual([]);
    expect(plan.members).toEqual([]);
  });

  it('should save by updating when id exists', async () => {
    const plan = new Plan({ id: 1 });
    const createSpy = jest.spyOn(plan, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(plan, 'update').mockResolvedValue(true);

    const result = await plan.save(buildRequest());

    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should save by creating then updating when id is missing', async () => {
    const plan = new Plan();
    const createSpy = jest.spyOn(plan, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(plan, 'update').mockResolvedValue(true);

    const result = await plan.save(buildRequest());

    expect(result).toBe(true);
    expect(createSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled();
  });

  it('should create and sync fields on success', async () => {
    const plan = new Plan({
      projectId: 10,
      versionedTemplate: { id: 20 } as never,
    });

    jest.spyOn(Plan, 'mutate').mockResolvedValue({
      data: {
        addPlan: {
          id: 11,
          projectId: 10,
          dmpId: 'doi:10.12345/abc',
          title: 'Plan',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: 'now',
          project: {} as never,
          versionedTemplate: {} as never,
          alternateIdentifiers: [],
          created: 'created',
          createdById: 1,
          modified: 'modified',
          modifiedById: 2,
        },
      },
    });

    const result = await plan.create(buildRequest());

    expect(result).toBe(true);
    expect(plan.id).toBe(11);
    expect(plan.dmpId).toBe('doi:10.12345/abc');
  });

  it('should update title and status on success', async () => {
    const plan = new Plan({ id: 12, title: 'Updated', status: 'COMPLETE' as never });

    const mutateSpy = jest.spyOn(Plan, 'mutate');
    mutateSpy
      .mockResolvedValueOnce({
        data: {
          updatePlanTitle: {
            id: 12,
            projectId: 10,
            dmpId: 'dmp-id',
            title: 'Updated',
            visibility: 'PRIVATE',
            status: 'DRAFT',
            registered: 'r',
            project: {} as never,
            versionedTemplate: {} as never,
            alternateIdentifiers: [],
            created: 'c',
            createdById: 1,
            modified: 'm1',
            modifiedById: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          updatePlanStatus: {
            id: 12,
            projectId: 10,
            dmpId: 'dmp-id',
            title: 'Updated',
            visibility: 'PRIVATE',
            status: 'COMPLETE',
            registered: 'r',
            project: {} as never,
            versionedTemplate: {} as never,
            alternateIdentifiers: [],
            created: 'c',
            createdById: 1,
            modified: 'm2',
            modifiedById: 3,
          },
        },
      });

    const result = await plan.update(buildRequest());

    expect(result).toBe(true);
    expect(mutateSpy).toHaveBeenCalledTimes(2);
    expect(plan.modified).toBe('m2');
  });

  it('should delete and sync modified fields on success', async () => {
    const plan = new Plan({ id: 13 });

    jest.spyOn(Plan, 'mutate').mockResolvedValue({
      data: {
        archivePlan: {
          id: 13,
          projectId: 10,
          dmpId: 'dmp-id',
          title: 'Plan',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: 'r',
          project: {} as never,
          versionedTemplate: {} as never,
          alternateIdentifiers: [],
          created: 'c',
          createdById: 1,
          modified: 'deleted',
          modifiedById: 9,
        },
      },
    });

    const result = await plan.delete(buildRequest());

    expect(result).toBe(true);
    expect(plan.modified).toBe('deleted');
  });

  it('should return existing plan by dmp id in findOrInitialize', async () => {
    const existing = new Plan({ id: 50, dmpId: 'doi:10.12345/abc' });

    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(existing);

    const result = await Plan.findOrInitialize(
      buildRequest(),
      new VersionedTemplate({ id: 5 }),
      {
        dmp_id: { identifier: 'doi:10.12345/abc' },
        title: 'Plan title',
      } as never
    );

    expect(result).toBe(existing);
  });

  it('should return existing plan by alternate identifier in findOrInitialize', async () => {
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(undefined);
    jest
      .spyOn(Plan, 'findByAlternateIdentifier')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Plan({ id: 88, dmpId: 'existing' }));

    const result = await Plan.findOrInitialize(
      buildRequest(),
      new VersionedTemplate({ id: 5 }),
      {
        dmp_id: { identifier: 'doi:10.12345/abc' },
        title: 'Plan title',
        alternate_identifier: [
          { identifier: 'first-alt' },
          { identifier: 'second-alt' },
        ],
      } as never
    );

    expect(result.id).toBe(88);
    expect(Plan.findByAlternateIdentifier).toHaveBeenCalledTimes(2);
  });

  it('should initialize a new plan when not found', async () => {
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(undefined);
    jest.spyOn(Plan, 'findByAlternateIdentifier').mockResolvedValue(undefined);

    const template = new VersionedTemplate({ id: 7 });

    const result = await Plan.findOrInitialize(
      buildRequest(),
      template,
      {
        dmp_id: { identifier: 'doi:10.12345/new' },
        title: ' New Plan ',
        visibility: 'private',
        status: 'draft',
        alternate_identifier: [],
      } as never
    );

    expect(result).toBeInstanceOf(Plan);
    expect(result.id).toBeUndefined();
    expect(result.versionedTemplate).toBeInstanceOf(VersionedTemplate);
    expect(result.versionedTemplate?.id).toBe(template.id);
    expect(result.title).toBe('New Plan');
  });

  it('should return true from saveAlternateIdentifiers when no alt ids are provided', async () => {
    const plan = new Plan();

    const result = await plan.saveAlternateIdentifiers(buildRequest(), []);

    expect(result).toBe(true);
  });

  it('should remove missing ids and add new ids in saveAlternateIdentifiers', async () => {
    const plan = new Plan({
      id: 1,
      alternateIdentifiers: [{ alternateIdentifier: 'old-id' } as never],
    });

    const mutateSpy = jest.spyOn(Plan, 'mutate');
    mutateSpy
      .mockResolvedValueOnce({
        data: {
          removeAlternateIdentifierFromPlan: {
            id: 1,
            alternateIdentifier: 'old-id',
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          addAlternateIdentifierToPlan: {
            id: 2,
            alternateIdentifier: 'new-id',
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        },
      });

    const result = await plan.saveAlternateIdentifiers(buildRequest(), [
      { identifier: 'new-id' } as never,
    ]);

    expect(result).toBe(true);
    expect(mutateSpy).toHaveBeenCalledTimes(2);
  });

  it('should find plan by id', async () => {
    jest.spyOn(Plan, 'query').mockResolvedValue({
      data: {
        plan: {
          id: 5,
          projectId: 10,
          dmpId: 'dmp-5',
          title: 'Plan 5',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: 'r',
          project: {} as never,
          versionedTemplate: {} as never,
          alternateIdentifiers: [],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await Plan.findById(buildRequest(), 5);

    expect(result).toBeInstanceOf(Plan);
    expect(result?.id).toBe(5);
  });

  it('should find plan by alternate identifier', async () => {
    jest.spyOn(Plan, 'query').mockResolvedValue({
      data: {
        planByAlternateIdentifier: {
          id: 6,
          projectId: 10,
          dmpId: 'dmp-6',
          title: 'Plan 6',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: 'r',
          project: {} as never,
          versionedTemplate: {} as never,
          alternateIdentifiers: [],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await Plan.findByAlternateIdentifier(buildRequest(), 'alt-123');

    expect(result).toBeInstanceOf(Plan);
    expect(result?.id).toBe(6);
  });

  it('should find plans by project id', async () => {
    jest.spyOn(Plan, 'query').mockResolvedValue({
      data: {
        plans: [
          {
            id: 1,
            projectId: 10,
            dmpId: 'dmp-1',
            title: 'Plan 1',
            visibility: 'PRIVATE',
            status: 'DRAFT',
            registered: 'r',
            project: {} as never,
            versionedTemplate: {} as never,
            alternateIdentifiers: [],
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        ],
      },
    });

    const result = await Plan.findByProjectId(buildRequest(), 10);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Plan);
  });
});
