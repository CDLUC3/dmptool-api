import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { saveMembersWorkflow } from '../memberWorkflow.js';
import { MemberRole } from '../../../../models/MemberRole.js';
import { ProjectMember } from '../../../../models/ProjectMember.js';
import { PlanMember } from '../../../../models/PlanMember.js';
import { Plan } from '../../../../models/Plan.js';

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

const makeProject = () =>
  ({
    id: 22,
    errors: {},
  }) as unknown as import('../../../../models/Project.js').Project;

const makePlan = () =>
  ({
    id: 11,
    dmpId: '10.12345/test',
    errors: {},
  }) as unknown as Plan;

const makeDmp = () =>
  ({
    contact: { name: 'Test Contact' },
    contributor: [{ name: 'Contributor 1' }],
  }) as unknown as import('@dmptool/types').DMPToolDMPType['dmp'];

describe('saveMembersWorkflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should save members and return the plan on the happy path', async () => {
    const request = makeRequest();
    const project = makeProject();
    const plan = makePlan();
    const dmp = makeDmp();

    const roles = [{ id: 1, uri: 'role:1' }] as never[];
    const projectMembers = [{ id: 101 }] as never[];
    const planMembers = [{ id: 201 }] as never[];

    jest.spyOn(MemberRole, 'all').mockResolvedValue(roles as never);
    jest.spyOn(ProjectMember, 'processMembers').mockResolvedValue(projectMembers as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(false);
    jest.spyOn(ProjectMember, 'save').mockResolvedValue(true);
    jest.spyOn(PlanMember, 'fromProjectMembers').mockResolvedValue(planMembers as never);
    jest.spyOn(PlanMember, 'save').mockResolvedValue(true);

    const result = await saveMembersWorkflow(request, project, plan, dmp);

    expect(result).toBe(plan);
    expect(MemberRole.all).toHaveBeenCalledWith(request);
    expect(ProjectMember.processMembers).toHaveBeenCalledWith(
      request,
      project,
      plan,
      expect.anything(),
      dmp
    );
    expect(ProjectMember.save).toHaveBeenCalledWith(request, project, projectMembers);
    expect(PlanMember.fromProjectMembers).toHaveBeenCalledWith(plan, projectMembers);
    expect(PlanMember.save).toHaveBeenCalledWith(request, plan, planMembers);
    expect(request.log.error).not.toHaveBeenCalled();
  });

  it('should log and return early if processing members sets plan errors', async () => {
    const request = makeRequest();
    const project = makeProject();
    const plan = makePlan();
    const dmp = makeDmp();

    plan.errors = { members: 'Unable to process members' };

    jest.spyOn(MemberRole, 'all').mockResolvedValue([] as never);
    jest.spyOn(ProjectMember, 'processMembers').mockResolvedValue([] as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(true);

    const projectSaveSpy = jest.spyOn(ProjectMember, 'save').mockResolvedValue(true);
    const fromProjectMembersSpy = jest
      .spyOn(PlanMember, 'fromProjectMembers')
      .mockResolvedValue([] as never);
    const planSaveSpy = jest.spyOn(PlanMember, 'save').mockResolvedValue(true);

    const result = await saveMembersWorkflow(request, project, plan, dmp);

    expect(result).toBe(plan);
    expect(request.log.error).toHaveBeenCalledWith(
      {
        planId: plan.id,
        contact: dmp.contact,
        contributors: dmp.contributor,
        errors: { members: 'Unable to process members' },
      },
      'Unable to process contact and contributor information.'
    );
    expect(projectSaveSpy).not.toHaveBeenCalled();
    expect(fromProjectMembersSpy).not.toHaveBeenCalled();
    expect(planSaveSpy).not.toHaveBeenCalled();
  });

  it('should log and return early if saving project members fails', async () => {
    const request = makeRequest();
    const project = makeProject();
    const plan = makePlan();
    const dmp = makeDmp();

    const projectMembers = [{ id: 101 }] as never[];

    jest.spyOn(MemberRole, 'all').mockResolvedValue([] as never);
    jest.spyOn(ProjectMember, 'processMembers').mockResolvedValue(projectMembers as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(false);
    jest.spyOn(ProjectMember, 'save').mockResolvedValue(false);

    const fromProjectMembersSpy = jest
      .spyOn(PlanMember, 'fromProjectMembers')
      .mockResolvedValue([] as never);
    const planSaveSpy = jest.spyOn(PlanMember, 'save').mockResolvedValue(true);

    const result = await saveMembersWorkflow(request, project, plan, dmp);

    expect(result).toBe(plan);
    expect(request.log.error).toHaveBeenCalledWith(
      { dmpId: plan.dmpId, projectId: project.id, errors: project.errors },
      'Unable to save project members for the new plan'
    );
    expect(fromProjectMembersSpy).not.toHaveBeenCalled();
    expect(planSaveSpy).not.toHaveBeenCalled();
  });

  it('should log an error if saving plan members fails and still return the plan', async () => {
    const request = makeRequest();
    const project = makeProject();
    const plan = makePlan();
    const dmp = makeDmp();

    const projectMembers = [{ id: 101 }] as never[];
    const planMembers = [{ id: 201 }] as never[];

    jest.spyOn(MemberRole, 'all').mockResolvedValue([] as never);
    jest.spyOn(ProjectMember, 'processMembers').mockResolvedValue(projectMembers as never);
    jest.spyOn(Plan, 'hasErrors').mockReturnValue(false);
    jest.spyOn(ProjectMember, 'save').mockResolvedValue(true);
    jest.spyOn(PlanMember, 'fromProjectMembers').mockResolvedValue(planMembers as never);
    jest.spyOn(PlanMember, 'save').mockResolvedValue(false);

    const result = await saveMembersWorkflow(request, project, plan, dmp);

    expect(result).toBe(plan);
    expect(request.log.error).toHaveBeenCalledWith(
      { dmpId: plan.dmpId, planId: plan.id, errors: plan.errors },
      'Unable to save plan members for the new plan'
    );
  });
});
