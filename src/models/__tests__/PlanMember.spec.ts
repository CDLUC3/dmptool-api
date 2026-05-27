import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { PlanMember } from '../PlanMember.js';
import { Plan } from '../Plan.js';
import { ProjectMember } from '../ProjectMember.js';
import { MemberRole } from '../MemberRole.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

const role = new MemberRole({ id: 1, uri: 'role:1', label: 'Role', description: 'Role' });

describe('PlanMember', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const member = new PlanMember();

    expect(member.isPrimaryContact).toBe(false);
    expect(member.memberRoles).toEqual([]);
  });

  it('should return false from save when plan id is missing', async () => {
    const result = await PlanMember.save(buildRequest(), new Plan(), []);

    expect(result).toBe(false);
  });

  it('should set plan error when members are empty', async () => {
    const plan = new Plan({ id: 1 });

    jest.spyOn(PlanMember, 'findByPlanId').mockResolvedValue([]);

    const result = await PlanMember.save(buildRequest(), plan, []);

    expect(result).toBe(false);
    expect(plan.errors.members).toBe('maDMP must have at least one contact');
  });

  it('should create a plan member successfully', async () => {
    const member = new PlanMember({
      plan: new Plan({ id: 1 }),
      projectMember: new ProjectMember({ id: 2 }),
      memberRoles: [role],
    });

    jest.spyOn(PlanMember, 'mutate').mockResolvedValue({
      data: {
        addPlanMember: {
          id: 5,
          plan: member.plan,
          projectMember: member.projectMember,
          isPrimaryContact: false,
          memberRoles: [role],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await member.create(buildRequest());

    expect(result).toBe(true);
    expect(member.id).toBe(5);
  });

  it('should update a plan member successfully', async () => {
    const member = new PlanMember({
      id: 5,
      plan: new Plan({ id: 1 }),
      projectMember: new ProjectMember({ id: 2 }),
      memberRoles: [role],
      isPrimaryContact: true,
    });

    jest.spyOn(PlanMember, 'mutate').mockResolvedValue({
      data: {
        updatePlanMember: {
          id: 5,
          plan: member.plan,
          projectMember: member.projectMember,
          isPrimaryContact: true,
          memberRoles: [role],
          created: 'c',
          createdById: 1,
          modified: 'updated',
          modifiedById: 9,
        },
      },
    });

    const result = await member.update(buildRequest());

    expect(result).toBe(true);
    expect(member.modified).toBe('updated');
  });

  it('should delete a plan member successfully', async () => {
    const member = new PlanMember({ id: 5 });

    jest.spyOn(PlanMember, 'mutate').mockResolvedValue({
      data: {
        removePlanMember: {
          id: 5,
          plan: new Plan({ id: 1 }),
          projectMember: new ProjectMember({ id: 2 }),
          isPrimaryContact: false,
          memberRoles: [role],
          created: 'c',
          createdById: 1,
          modified: 'deleted',
          modifiedById: 10,
        },
      },
    });

    const result = await member.delete(buildRequest());

    expect(result).toBe(true);
    expect(member.modified).toBe('deleted');
  });

  it('should save members by deleting removed entries and creating/updating current ones', async () => {
    const plan = new Plan({ id: 1, errors: {} });
    const existing = new PlanMember({ id: 100 });
    const newMember = new PlanMember({
      plan,
      projectMember: new ProjectMember({ id: 2 }),
      memberRoles: [role],
    });
    const updatedMember = new PlanMember({
      id: 200,
      plan,
      projectMember: new ProjectMember({ id: 3 }),
      memberRoles: [role],
    });

    jest.spyOn(PlanMember, 'findByPlanId').mockResolvedValue([existing, updatedMember]);
    jest.spyOn(existing, 'delete').mockResolvedValue(true);
    jest.spyOn(newMember, 'create').mockResolvedValue(true);
    jest.spyOn(updatedMember, 'update').mockResolvedValue(true);

    const result = await PlanMember.save(buildRequest(), plan, [newMember, updatedMember]);

    expect(result).toBe(true);
    expect(existing.delete).toHaveBeenCalledWith(expect.anything());
    expect(newMember.create).toHaveBeenCalledWith(expect.anything());
    expect(updatedMember.update).toHaveBeenCalledWith(expect.anything());
  });

  it('should create plan members from project members', async () => {
    const plan = new Plan({ id: 1 });
    const projectMembers = [
      new ProjectMember({
        id: 1,
        isPrimaryContact: true,
        memberRoles: [role],
      }),
    ];

    const result = await PlanMember.fromProjectMembers(plan, projectMembers);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(PlanMember);
    expect(result[0].plan).toBe(plan);
    expect(result[0].isPrimaryContact).toBe(true);
  });

  it('should return empty array from fromProjectMembers when input is empty', async () => {
    const result = await PlanMember.fromProjectMembers(new Plan({ id: 1 }), []);

    expect(result).toEqual([]);
  });

  it('should find plan members by plan id', async () => {
    jest.spyOn(PlanMember, 'query').mockResolvedValue({
      data: {
        planMembers: [
          {
            id: 1,
            plan: new Plan({ id: 1 }),
            projectMember: new ProjectMember({ id: 2 }),
            isPrimaryContact: false,
            memberRoles: [role],
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        ],
      },
    });

    const result = await PlanMember.findByPlanId(buildRequest(), 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(PlanMember);
  });
});
