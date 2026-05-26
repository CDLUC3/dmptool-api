import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Plan } from '../Plan.js';
import { PlanFunding } from '../PlanFunding.js';
import { ProjectFunding } from '../ProjectFunding.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('PlanFunding', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates plan funding mappings', async () => {
    const plan = new Plan({ id: 1 });
    const fundings = [
      new ProjectFunding({ id: 10 }),
      new ProjectFunding({ id: 20 }),
    ];

    const result = PlanFunding.fromProjectFundings(plan, fundings);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(PlanFunding);
    expect(result[0].plan?.id).toBe(plan.id);
    expect(result[0].projectFunding?.id).toBe(10);
  });

  it('updates plan funding and returns mapped models', async () => {
    jest.spyOn(PlanFunding, 'mutate').mockResolvedValue({
      data: {
        updatePlanFunding: [
          {
            id: 99,
            plan: new Plan({ id: 1 }),
            projectFunding: new ProjectFunding({ id: 10 }),
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        ],
      },
    });

    const result = await PlanFunding.update(buildRequest(), 1, [10]);

    expect(result).toHaveLength(1);
    expect(result?.[0]).toBeInstanceOf(PlanFunding);
  });

  it('deletes plan funding successfully', async () => {
    const funding = new PlanFunding({ id: 5 });

    jest.spyOn(PlanFunding, 'mutate').mockResolvedValue({
      data: {
        removePlanFunding: {
          id: 5,
          plan: new Plan({ id: 1 }),
          projectFunding: new ProjectFunding({ id: 10 }),
          created: 'c',
          createdById: 1,
          modified: 'deleted',
          modifiedById: 8,
        },
      },
    });

    const result = await PlanFunding.delete(buildRequest(), funding);

    expect(result).toBe(true);
    expect(funding.modified).toBe('deleted');
  });

  it('save returns false when the plan has no id', async () => {
    const result = await PlanFunding.save(buildRequest(), new Plan({}), []);

    expect(result).toBe(false);
  });

  it('save removes existing plan fundings when incoming list is empty', async () => {
    const request = buildRequest();
    const plan = new Plan({ id: 5, errors: {} });
    const existing = [new PlanFunding({ id: 9 }), new PlanFunding({ id: 10 })];

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue(existing);
    const deleteSpy = jest.spyOn(PlanFunding, 'delete').mockResolvedValue(true);

    const result = await PlanFunding.save(request, plan, []);

    expect(result).toBe(true);
    expect(deleteSpy).toHaveBeenCalledTimes(2);
  });

  it('save records errors when existing fundings cannot be removed', async () => {
    const request = buildRequest();
    const plan = new Plan({ id: 5, errors: {} });
    const existing = [new PlanFunding({ id: 9, errors: { general: 'x' } })];

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue(existing);
    jest.spyOn(PlanFunding, 'delete').mockResolvedValue(false);
    jest.spyOn(PlanFunding, 'errorsToString').mockReturnValue('general: x');

    const result = await PlanFunding.save(request, plan, []);

    expect(result).toBe(false);
    expect(plan.errors.fundings).toContain('general: x');
  });

  it('save uses create when no plan fundings currently exist', async () => {
    const request = buildRequest();
    const plan = new Plan({ id: 5, errors: {} });
    const fundings = [new PlanFunding({ projectFunding: new ProjectFunding({ id: 12 }) })];

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
    jest.spyOn(PlanFunding, 'create').mockResolvedValue([
      new PlanFunding({ id: 101, projectFunding: new ProjectFunding({ id: 12 }) }),
    ]);

    const result = await PlanFunding.save(request, plan, fundings);

    expect(result).toBe(true);
    expect(fundings[0].id).toBe(101);
  });

  it('save uses update when plan fundings already exist', async () => {
    const request = buildRequest();
    const plan = new Plan({ id: 5, errors: {} });
    const fundings = [new PlanFunding({ projectFunding: new ProjectFunding({ id: 33 }) })];

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([
      new PlanFunding({ id: 1, projectFunding: new ProjectFunding({ id: 99 }) }),
    ]);
    jest.spyOn(PlanFunding, 'update').mockResolvedValue([
      new PlanFunding({ id: 303, projectFunding: new ProjectFunding({ id: 33 }) }),
    ]);

    const result = await PlanFunding.save(request, plan, fundings);

    expect(result).toBe(true);
    expect(fundings[0].id).toBe(303);
  });

  it('save succeeds even when plan has unrelated existing errors', async () => {
    const request = buildRequest();
    const plan = new Plan({ id: 5, errors: { members: 'keep me' } as never });
    const fundings = [new PlanFunding({ projectFunding: new ProjectFunding({ id: 33 }) })];

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([
      new PlanFunding({ id: 1, projectFunding: new ProjectFunding({ id: 99 }) }),
    ]);
    jest.spyOn(PlanFunding, 'update').mockResolvedValue([
      new PlanFunding({ id: 303, projectFunding: new ProjectFunding({ id: 33 }) }),
    ]);

    const result = await PlanFunding.save(request, plan, fundings);

    expect(result).toBe(true);
    expect(plan.errors.members).toBe('keep me');
    expect(plan.errors.fundings).toBeUndefined();
  });

  it('save clears stale funding errors before a successful sync', async () => {
    const request = buildRequest();
    const plan = new Plan({ id: 5, errors: { fundings: 'old funding error' } as never });
    const fundings = [new PlanFunding({ projectFunding: new ProjectFunding({ id: 12 }) })];

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
    jest.spyOn(PlanFunding, 'create').mockResolvedValue([
      new PlanFunding({ id: 101, projectFunding: new ProjectFunding({ id: 12 }) }),
    ]);

    const result = await PlanFunding.save(request, plan, fundings);

    expect(result).toBe(true);
    expect(plan.errors.fundings).toBeUndefined();
  });

  it('create returns undefined when mutation has no data', async () => {
    jest.spyOn(PlanFunding, 'mutate').mockResolvedValue({ data: undefined });

    const result = await PlanFunding.create(buildRequest(), 1, [10]);

    expect(result).toBeUndefined();
  });

  it('findByPlanId returns an empty array when query has no items', async () => {
    jest.spyOn(PlanFunding, 'query').mockResolvedValue({ data: undefined });

    const result = await PlanFunding.findByPlanId(buildRequest(), 1);

    expect(result).toEqual([]);
  });

  it('delete returns false when mutation reports errors', async () => {
    const funding = new PlanFunding({ id: 5 });

    jest.spyOn(PlanFunding, 'mutate').mockResolvedValue({
      data: {
        removePlanFunding: {
          id: 5,
          plan: new Plan({ id: 1 }),
          projectFunding: new ProjectFunding({ id: 10 }),
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 8,
          errors: { general: 'cannot remove' },
        },
      },
    });

    const result = await PlanFunding.delete(buildRequest(), funding);

    expect(result).toBe(false);
  });
});


