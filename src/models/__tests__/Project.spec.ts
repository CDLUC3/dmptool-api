import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Project } from '../Project.js';
import { ProjectMember } from '../ProjectMember.js';
import { ResearchDomain } from '../ResearchDomain.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('Project', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const project = new Project();

    expect(project.title).toBe('Research Project');
    expect(project.isTestProject).toBe(false);
    expect(project.plans).toEqual([]);
    expect(project.members).toEqual([]);
  });

  it('should return the primary contact', () => {
    const primary = new ProjectMember({ id: 1, isPrimaryContact: true });
    const other = new ProjectMember({ id: 2, isPrimaryContact: false });

    const project = new Project({ members: [other, primary] });

    expect(project.primaryContact()).toBeDefined();
    expect(project.primaryContact()?.id).toBe(1);
  });

  it('should return true from setOwnership placeholder', async () => {
    const project = new Project();

    await expect(project.setOwnership(buildRequest(), {} as never)).resolves.toBe(true);
  });

  it('should create then update from save when id is missing', async () => {
    const project = new Project({ title: 'Test Project' });
    const createSpy = jest.spyOn(project, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(project, 'update').mockResolvedValue(true);

    const result = await project.save(buildRequest());

    expect(result).toBe(true);
    expect(createSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled();
  });

  it('should update from save when id exists', async () => {
    const project = new Project({ id: 1 });
    const createSpy = jest.spyOn(project, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(project, 'update').mockResolvedValue(true);

    const result = await project.save(buildRequest());

    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should create, sync fields, and then update on success', async () => {
    const project = new Project({
      title: 'Project A',
      members: [new ProjectMember({ id: 1, isPrimaryContact: true })],
    });

    jest.spyOn(project, 'setOwnership').mockResolvedValue(true);
    const updateSpy = jest.spyOn(project, 'update').mockResolvedValue(true);

    jest.spyOn(Project, 'mutate').mockResolvedValue({
      data: {
        addProject: {
          id: 20,
          title: 'Project A',
          abstractText: 'desc',
          endDate: '2025-12-31',
          startDate: '2025-01-01',
          researchDomain: undefined,
          isTestProject: false,
          plans: [],
          members: [],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 2,
        },
      },
    });

    const result = await project.create(buildRequest());

    expect(result).toBe(true);
    expect(project.id).toBe(20);
    expect(updateSpy).toHaveBeenCalled();
  });

  it('should update and sync modified fields on success', async () => {
    const project = new Project({ id: 10, title: 'Project A' });

    jest.spyOn(Project, 'mutate').mockResolvedValue({
      data: {
        updateProject: {
          id: 10,
          title: 'Project A',
          abstractText: 'desc',
          endDate: '2025-12-31',
          startDate: '2025-01-01',
          researchDomain: undefined,
          isTestProject: false,
          plans: [],
          members: [],
          created: 'c',
          createdById: 1,
          modified: 'updated',
          modifiedById: 7,
        },
      },
    });

    const result = await project.update(buildRequest());

    expect(result).toBe(true);
    expect(project.modified).toBe('updated');
  });

  it('should delete and sync modified fields on success', async () => {
    const project = new Project({ id: 10 });

    jest.spyOn(Project, 'mutate').mockResolvedValue({
      data: {
        archiveProject: {
          id: 10,
          title: 'Project A',
          abstractText: 'desc',
          endDate: '2025-12-31',
          startDate: '2025-01-01',
          researchDomain: undefined,
          isTestProject: false,
          plans: [],
          members: [],
          created: 'c',
          createdById: 1,
          modified: 'deleted',
          modifiedById: 8,
        },
      },
    });

    const result = await project.delete(buildRequest());

    expect(result).toBe(true);
    expect(project.modified).toBe('deleted');
  });

  it('should return an existing project by project id in findOrInitialize', async () => {
    jest.spyOn(Project, 'findById').mockResolvedValue(new Project({ id: 9, title: 'Existing' }));

    jest.spyOn(Project, 'query').mockResolvedValueOnce({
      data: {
        myProjects: {
          items: [
            {
              id: 123,
              title: 'Existing'
            }
          ]
        }
      }
    });

    const result = await Project.findOrInitialize(
      buildRequest(),
      {
        title: 'Example DMP',
        project: [
          {
            project_id: { identifier: '/projects/9' },
            title: 'Existing',
          },
        ],
      } as never
    );

    expect(result.id).toBe(9);
  });

  it('should return a fully loaded caller project when title matches', async () => {
    jest.spyOn(Project, 'findById').mockResolvedValueOnce(
      new Project({ id: 10, title: 'Matched' })
    );
    jest.spyOn(Project, 'callerProjects').mockResolvedValue([
      new Project({ id: 10, title: 'Matched' }),
    ]);
    jest.spyOn(ResearchDomain, 'findByURI').mockResolvedValue(
      new ResearchDomain({ id: 1, name: 'test', uri: 'http://example.com/test' })
    );

    const result = await Project.findOrInitialize(
      buildRequest(),
      {
        title: 'Matched',
        project: [{ title: 'Matched' }],
      } as never
    );

    expect(result.id).toBe(10);
  });

  it('should initialize a new project when none is found', async () => {
    jest.spyOn(Project, 'findById').mockResolvedValue(undefined);
    jest.spyOn(Project, 'callerProjects').mockResolvedValue([]);
    jest.spyOn(ResearchDomain, 'findByURI').mockResolvedValue(
      new ResearchDomain({ id: 3, uri: 'rd:1', name: 'Domain' })
    );

    const result = await Project.findOrInitialize(
      buildRequest(),
      {
        title: 'DMP title',
        description: 'DMP desc',
        research_domain: {
          research_domain_identifier: { identifier: 'rd:1' },
        },
        project: [
          {
            title: 'Project title',
            description: 'Project desc',
            start: '2025-01-01',
            end: '2025-12-31',
          },
        ],
      } as never
    );

    expect(result).toBeInstanceOf(Project);
    expect(result.id).toBeUndefined();
    expect(result.title).toBe('Project title');
    expect(result.researchDomain?.id).toBe(3);
  });

  it('should load caller projects', async () => {
    jest.spyOn(Project, 'query').mockResolvedValue({
      data: {
        myProjects: {
          items: [
            {
              id: 1,
              title: 'Project 1',
              abstractText: 'desc',
              endDate: '2025-12-31',
              startDate: '2025-01-01',
              researchDomain: undefined,
              isTestProject: false,
              plans: [],
              members: [],
              created: 'c',
              createdById: 1,
              modified: 'm',
              modifiedById: 1,
            },
          ],
        },
      },
    });

    const result = await Project.callerProjects(buildRequest());

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Project);
  });

  it('should find project by id', async () => {
    jest.spyOn(Project, 'query').mockResolvedValue({
      data: {
        project: {
          id: 1,
          title: 'Project 1',
          abstractText: 'desc',
          endDate: '2025-12-31',
          startDate: '2025-01-01',
          researchDomain: undefined,
          isTestProject: false,
          plans: [],
          members: [],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await Project.findById(buildRequest(), 1);

    expect(result).toBeInstanceOf(Project);
    expect(result?.id).toBe(1);
  });
});
