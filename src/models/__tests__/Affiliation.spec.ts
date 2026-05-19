import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Affiliation } from '../Affiliation.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('Affiliation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const affiliation = new Affiliation({ name: 'Test Org' });

    expect(affiliation.name).toBe('Test Org');
    expect(affiliation.funder).toBe(false);
  });

  it('should create and sync id on success', async () => {
    const affiliation = new Affiliation({ name: 'Test Org', funder: true });

    jest.spyOn(Affiliation, 'mutate').mockResolvedValue({
      data: {
        addAffiliation: {
          id: 99,
          name: 'Test Org',
          uri: 'https://ror.org/test',
          displayName: 'Test Org',
          funder: true,
        },
      },
    });

    const result = await affiliation.create(buildRequest());

    expect(result).toBe(true);
    expect(affiliation.id).toBe(99);
  });

  it('should return false and capture mutation errors on create failure', async () => {
    const affiliation = new Affiliation({ name: 'Test Org' });

    jest.spyOn(Affiliation, 'mutate').mockResolvedValue({
      data: {
        addAffiliation: {
          id: 1,
          name: 'Test Org',
          uri: 'https://ror.org/test',
          displayName: 'Test Org',
          funder: false,
          errors: { name: 'Invalid' },
        },
      },
    });

    const result = await affiliation.create(buildRequest());

    expect(result).toBe(false);
    expect(affiliation.errors).toEqual({ name: 'Invalid' });
  });

  it('should find by URI', async () => {
    jest.spyOn(Affiliation, 'query').mockResolvedValue({
      data: {
        affiliationByURI: {
          id: 7,
          uri: 'https://ror.org/123',
          name: 'Org',
          displayName: 'Org',
          funder: false,
        },
      },
    });

    const result = await Affiliation.findByURI(buildRequest(), 'https://ror.org/123');

    expect(result).toBeInstanceOf(Affiliation);
    expect(result?.id).toBe(7);
  });

  it('should return undefined when findByURI has no data', async () => {
    jest.spyOn(Affiliation, 'query').mockResolvedValue({ data: undefined });

    const result = await Affiliation.findByURI(buildRequest(), 'https://ror.org/123');

    expect(result).toBeUndefined();
  });

  it('should find by name', async () => {
    jest.spyOn(Affiliation, 'query').mockResolvedValue({
      data: {
        affiliations: {
          items: [
            {
              id: 1,
              uri: 'https://ror.org/1',
              name: 'Org 1',
              displayName: 'Org 1',
              funder: false,
            },
            {
              id: 2,
              uri: 'https://ror.org/2',
              name: 'Org 2',
              displayName: 'Org 2',
              funder: true,
            },
          ],
        },
      },
    });

    const result = await Affiliation.findByName(buildRequest(), 'Org');

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Affiliation);
  });

  it('should return empty array when findByName has no items', async () => {
    jest.spyOn(Affiliation, 'query').mockResolvedValue({ data: undefined });

    const result = await Affiliation.findByName(buildRequest(), 'Org');

    expect(result).toEqual([]);
  });

  it('should find existing affiliation by ROR in findOrInitialize', async () => {
    const request = buildRequest();
    const existing = new Affiliation({ id: 42, name: 'Existing Org' });

    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(existing);

    const result = await Affiliation.findOrInitialize(
      request,
      {
        name: 'Existing Org',
        affiliationId: [{ type: 'ror', identifier: '05abc1234' }],
        affiliation_id: { identifier: 'https://ror.org/05abc1234' },
      } as never,
      true
    );

    expect(result).toBe(existing);
  });

  it('should find existing affiliation by matching name when no ROR match exists', async () => {
    const request = buildRequest();

    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(undefined);
    jest.spyOn(Affiliation, 'findByName').mockResolvedValue([
      new Affiliation({ id: 5, name: 'Matched Org' }),
    ]);

    const result = await Affiliation.findOrInitialize(
      request,
      {
        name: 'Matched Org',
        affiliationId: [],
        affiliation_id: { identifier: 'not-a-url' },
      } as never,
      false
    );

    expect(result.id).toBe(5);
  });

  it('should initialize a new affiliation when nothing matches', async () => {
    const request = buildRequest();

    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(undefined);
    jest.spyOn(Affiliation, 'findByName').mockResolvedValue([]);

    const result = await Affiliation.findOrInitialize(
      request,
      {
        name: 'New Org',
        affiliationId: [],
        affiliation_id: { identifier: 'https://example.org/org' },
      } as never,
      true
    );

    expect(result).toBeInstanceOf(Affiliation);
    expect(result.name).toBe('New Org');
    expect(result.uri).toBe('https://example.org/org');
    expect(result.funder).toBe(true);
  });
});
