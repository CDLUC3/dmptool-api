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
