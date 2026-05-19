import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { ProjectMember } from '../ProjectMember.js';
import { Project } from '../Project.js';
import { Plan } from '../Plan.js';
import { MemberRole, MemberRoles } from '../MemberRole.js';
import { Affiliation } from '../Affiliation.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

const defaultRole = new MemberRole({
  id: 1,
  uri: 'role:default',
  label: 'Default',
  description: 'Default role',
  isDefault: true,
});
const editorRole = new MemberRole({
  id: 2,
  uri: 'role:editor',
  label: 'Editor',
  description: 'Editor role',
  isDefault: false,
});

describe('ProjectMember', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const member = new ProjectMember();

    expect(member.isPrimaryContact).toBe(false);
    expect(member.memberRoles).toEqual([]);
  });

  it('should return false from save when project id is missing', async () => {
    const result = await ProjectMember.save(buildRequest(), new Project(), []);

    expect(result).toBe(false);
  });

  it('should set a project members error when save is called with no members', async () => {
    const project = new Project({ id: 1, errors: {} });

    const result = await ProjectMember.save(buildRequest(), project, []);

    expect(result).toBe(false);
    expect(project.errors.members).toBe('maDMP must have a contact');
  });

  it('should create a member successfully', async () => {
    const member = new ProjectMember({
      project: new Project({ id: 1 }),
      affiliation: new Affiliation({ id: 2, uri: 'aff:1' }),
      givenName: 'Jane',
      surName: 'Doe',
      email: 'jane@example.edu',
      memberRoles: [defaultRole],
    });

    jest.spyOn(ProjectMember, 'mutate').mockResolvedValue({
      data: {
        addProjectMember: {
          id: 10,
          project: member.project,
          affiliation: member.affiliation,
          givenName: 'Jane',
          surName: 'Doe',
          orcid: '',
          email: 'jane@example.edu',
          isPrimaryContact: false,
          memberRoles: [defaultRole],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await ProjectMember.create(buildRequest(), member);

    expect(result).toBe(true);
    expect(member.id).toBe(10);
  });

  it('should try to save affiliation before create when affiliation has no id', async () => {
    const affiliation = new Affiliation({ uri: 'aff:1', name: 'Org' });
    const member = new ProjectMember({
      project: new Project({ id: 1 }),
      affiliation,
      memberRoles: [defaultRole],
    });

    jest.spyOn(affiliation, 'create').mockResolvedValue(true);
    jest.spyOn(ProjectMember, 'mutate').mockResolvedValue({
      data: {
        addProjectMember: {
          id: 10,
          project: member.project,
          affiliation,
          givenName: '',
          surName: '',
          orcid: '',
          email: '',
          isPrimaryContact: false,
          memberRoles: [defaultRole],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    await ProjectMember.create(buildRequest(), member);

    expect(affiliation.create).toHaveBeenCalled();
  });

  it('should update a member successfully', async () => {
    const member = new ProjectMember({
      id: 10,
      project: new Project({ id: 1 }),
      affiliation: new Affiliation({ id: 2, uri: 'aff:1' }),
      memberRoles: [defaultRole],
    });

    jest.spyOn(ProjectMember, 'mutate').mockResolvedValue({
      data: {
        updateProjectMember: {
          id: 10,
          project: member.project,
          affiliation: member.affiliation,
          givenName: '',
          surName: '',
          orcid: '',
          email: '',
          isPrimaryContact: false,
          memberRoles: [defaultRole],
          created: 'c',
          createdById: 1,
          modified: 'updated',
          modifiedById: 5,
        },
      },
    });

    const result = await ProjectMember.update(buildRequest(), member);

    expect(result).toBe(true);
    expect(member.modified).toBe('updated');
  });

  it('should delete a member successfully', async () => {
    const member = new ProjectMember({ id: 10 });

    jest.spyOn(ProjectMember, 'mutate').mockResolvedValue({
      data: {
        removeProjectMember: {
          id: 10,
          project: new Project({ id: 1 }),
          affiliation: new Affiliation({ id: 2 }),
          givenName: '',
          surName: '',
          orcid: '',
          email: '',
          isPrimaryContact: false,
          memberRoles: [defaultRole],
          created: 'c',
          createdById: 1,
          modified: 'deleted',
          modifiedById: 6,
        },
      },
    });

    const result = await ProjectMember.delete(buildRequest(), member);

    expect(result).toBe(true);
    expect(member.modified).toBe('deleted');
  });

  it('should process members and mark matching contact as primary contact', async () => {
    const request = buildRequest();
    const project = new Project({
      id: 1,
      members: [new ProjectMember({ id: 1, email: 'a@example.edu' })],
    });
    const plan = new Plan({ id: 2, errors: {} });
    const roles = new MemberRoles({ roles: [defaultRole, editorRole] });

    const contributorMember = new ProjectMember({
      id: 10,
      email: 'contact@example.edu',
      memberRoles: [editorRole],
      isPrimaryContact: false,
    });
    const contactMember = new ProjectMember({
      id: 11,
      email: 'contact@example.edu',
      memberRoles: [defaultRole],
      isPrimaryContact: false,
    });

    const findSpy = jest.spyOn(ProjectMember, 'findOrInitialize');
    findSpy
      .mockResolvedValueOnce(contributorMember)
      .mockResolvedValueOnce(contactMember);

    const result = await ProjectMember.processMembers(
      request,
      project,
      plan,
      roles,
      {
        contact: {
          name: 'Primary Contact',
          mbox: 'contact@example.edu',
          role: [],
        },
        contributor: [
          {
            name: 'Contributor',
            mbox: 'contact@example.edu',
            role: [],
          },
        ],
      } as never
    );

    expect(result).toHaveLength(1);
    expect(result[0].isPrimaryContact).toBe(true);
  });

  it('should return current members when contact is missing in processMembers', async () => {
    const project = new Project({
      id: 1,
      members: [new ProjectMember({ id: 1 })],
    });
    const plan = new Plan({ id: 2, errors: {} });
    const roles = new MemberRoles({ roles: [defaultRole] });

    const result = await ProjectMember.processMembers(
      buildRequest(),
      project,
      plan,
      roles,
      { contributor: [] } as never
    );

    expect(result).toEqual(project.members);
    expect(plan.errors.graphQL).toBe('maDMP must have a contact');
  });

  it('should find or initialize from an existing matching member', async () => {
    const request = buildRequest();
    const project = new Project({ id: 1 });
    const existing = new ProjectMember({
      id: 10,
      project,
      email: 'user@example.edu',
      givenName: 'Jane',
      surName: 'Doe',
    });

    const result = await ProjectMember.findOrInitialize(
      request,
      new MemberRoles({ roles: [defaultRole, editorRole] }),
      project,
      [existing],
      {
        name: 'Jane Doe',
        mbox: 'user@example.edu',
        role: [editorRole.uri ? editorRole.uri : ''],
      } as never
    );

    expect(result).toBeInstanceOf(ProjectMember);
    expect(result?.id).toBe(10);
    expect(result?.email).toBe('user@example.edu');
  });

  it('should initialize a new member and resolve affiliation', async () => {
    const request = buildRequest();
    const project = new Project({ id: 1 });

    jest.spyOn(Affiliation, 'findOrInitialize').mockResolvedValue(
      new Affiliation({ id: 99, name: 'Org' })
    );

    const result = await ProjectMember.findOrInitialize(
      request,
      new MemberRoles({ roles: [defaultRole, editorRole] }),
      project,
      [],
      {
        name: 'Jane Doe',
        mbox: 'user@example.edu',
        role: [editorRole.uri ? editorRole.uri : ''],
        affiliation: [{ name: 'Org' }],
      } as never
    );

    expect(result).toBeInstanceOf(ProjectMember);
    expect(result?.id).toBeUndefined();
    expect(result?.affiliation?.id).toBe(99);
    expect(result?.project).toBe(project);
  });

  it('should find project members by project id', async () => {
    jest.spyOn(ProjectMember, 'query').mockResolvedValue({
      data: {
        projectMembers: [
          {
            id: 1,
            project: new Project({ id: 1 }),
            affiliation: new Affiliation({ id: 2 }),
            givenName: 'Jane',
            surName: 'Doe',
            orcid: '',
            email: 'user@example.edu',
            isPrimaryContact: true,
            memberRoles: [defaultRole],
            created: 'c',
            createdById: 1,
            modified: 'm',
            modifiedById: 1,
          },
        ],
      },
    });

    const result = await ProjectMember.findByProjectId(buildRequest(), 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(ProjectMember);
  });
});
