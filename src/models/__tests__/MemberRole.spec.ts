import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { MemberRole, MemberRoles } from '../MemberRole.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('MemberRoles', () => {
  const defaultRole = new MemberRole({
    id: 1,
    uri: 'https://example.org/role/default',
    label: 'Default',
    description: 'Default role',
    isDefault: true,
  });

  const editorRole = new MemberRole({
    id: 2,
    uri: 'https://example.org/role/editor',
    label: 'Editor',
    description: 'Editor role',
    isDefault: false,
  });

  it('should return the default role', () => {
    const roles = new MemberRoles({ roles: [defaultRole, editorRole] });

    expect(roles.defaultRole()).toBe(defaultRole);
  });

  it('should validate whether a role URI exists', () => {
    const roles = new MemberRoles({ roles: [defaultRole, editorRole] });

    expect(roles.isValidRole(editorRole.uri ? editorRole.uri : '')).toBe(true);
    expect(roles.isValidRole('https://example.org/role/missing')).toBe(false);
  });

  it('should return default role when no roles are provided', () => {
    const roles = new MemberRoles({ roles: [defaultRole, editorRole] });

    expect(roles.validateRoles([])).toEqual([defaultRole]);
  });

  it('should filter invalid roles and return matching role objects', () => {
    const roles = new MemberRoles({ roles: [defaultRole, editorRole] });

    const result = roles.validateRoles([
      editorRole.uri ? editorRole.uri : '',
      'https://example.org/role/missing',
    ]);

    expect(result).toEqual([editorRole]);
  });

  it('should return default role when all provided roles are invalid', () => {
    const roles = new MemberRoles({ roles: [defaultRole, editorRole] });

    const result = roles.validateRoles(['https://example.org/role/missing']);

    expect(result).toEqual([defaultRole]);
  });
});

describe('MemberRole', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should load all member roles', async () => {
    jest.spyOn(MemberRole, 'query').mockResolvedValue({
      data: {
        memberRoles: [
          {
            id: 1,
            uri: 'https://example.org/role/default',
            label: 'Default',
            description: 'Default role',
            isDefault: true,
          },
        ],
      },
    });

    const result = await MemberRole.all(buildRequest());

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(MemberRole);
    expect(result[0].isDefault).toBe(true);
  });

  it('should return empty array when no member roles are returned', async () => {
    jest.spyOn(MemberRole, 'query').mockResolvedValue({ data: undefined });

    const result = await MemberRole.all(buildRequest());

    expect(result).toEqual([]);
  });
});
