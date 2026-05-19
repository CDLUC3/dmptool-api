import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Collaborator } from '../Collaborator.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('Collaborator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const collaborator = new Collaborator({ email: 'user@example.edu' });

    expect(collaborator.email).toBe('user@example.edu');
    expect(collaborator.accessLevel).toBe('OWN');
  });

  it('should call create from save when id is missing', async () => {
    const collaborator = new Collaborator();
    const createSpy = jest.spyOn(collaborator, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(collaborator, 'update').mockResolvedValue(true);

    const result = await collaborator.save(buildRequest());

    expect(result).toBe(true);
    expect(createSpy).toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should call update from save when id exists', async () => {
    const collaborator = new Collaborator({ id: 1 });
    const createSpy = jest.spyOn(collaborator, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(collaborator, 'update').mockResolvedValue(true);

    const result = await collaborator.save(buildRequest());

    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should create and sync fields on success', async () => {
    const collaborator = new Collaborator({
      email: 'user@example.edu',
      project: { id: 10 } as never,
    });

    jest.spyOn(Collaborator, 'mutate').mockResolvedValue({
      data: {
        addProjectCollaborator: {
          id: 2,
          projectId: 10,
          email: 'user@example.edu',
          invitedById: 1,
          userId: 3,
          created: 'created',
          createdById: 1,
          modified: 'modified',
          modifiedById: 1,
        },
      },
    });

    const result = await collaborator.create(buildRequest());

    expect(result).toBe(true);
    expect(collaborator.id).toBe(2);
    expect(collaborator.created).toBe('created');
    expect(collaborator.modified).toBe('modified');
  });

  it('should update and sync modified fields on success', async () => {
    const collaborator = new Collaborator({ id: 2, accessLevel: 'READ' });

    jest.spyOn(Collaborator, 'mutate').mockResolvedValue({
      data: {
        updateProjectCollaborator: {
          id: 2,
          projectId: 10,
          email: 'user@example.edu',
          invitedById: 1,
          userId: 3,
          created: 'created',
          createdById: 1,
          modified: 'updated',
          modifiedById: 9,
        },
      },
    });

    const result = await collaborator.update(buildRequest());

    expect(result).toBe(true);
    expect(collaborator.modified).toBe('updated');
    expect(collaborator.modifiedById).toBe(9);
  });

  it('should delete and sync modified fields on success', async () => {
    const collaborator = new Collaborator({ id: 2 });

    jest.spyOn(Collaborator, 'mutate').mockResolvedValue({
      data: {
        removeProjectCollaborator: {
          id: 2,
          projectId: 10,
          email: 'user@example.edu',
          invitedById: 1,
          userId: 3,
          created: 'created',
          createdById: 1,
          modified: 'deleted',
          modifiedById: 10,
        },
      },
    });

    const result = await collaborator.delete(buildRequest());

    expect(result).toBe(true);
    expect(collaborator.modified).toBe('deleted');
  });

  it('should find collaborators by project id', async () => {
    jest.spyOn(Collaborator, 'query').mockResolvedValue({
      data: {
        projectCollaborators: [
          {
            id: 1,
            projectId: 10,
            email: 'a@example.edu',
            invitedById: 1,
            userId: 2,
            created: 'c1',
            createdById: 1,
            modified: 'm1',
            modifiedById: 1,
          },
        ],
      },
    });

    const result = await Collaborator.findByProjectId(buildRequest(), 10);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Collaborator);
  });

  it('should return empty array when no collaborators are found', async () => {
    jest.spyOn(Collaborator, 'query').mockResolvedValue({ data: undefined });

    const result = await Collaborator.findByProjectId(buildRequest(), 10);

    expect(result).toEqual([]);
  });
});
