import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { ResearchDomain } from '../ResearchDomain.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('ResearchDomain', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize values in constructor', () => {
    const domain = new ResearchDomain({
      id: 1,
      uri: 'https://example.org/domain/1',
      name: 'Biology',
    });

    expect(domain.id).toBe(1);
    expect(domain.uri).toBe('https://example.org/domain/1');
    expect(domain.name).toBe('Biology');
  });

  it('should find a research domain by URI', async () => {
    jest.spyOn(ResearchDomain, 'query').mockResolvedValue({
      data: {
        researchDomainByURI: {
          id: 2,
          uri: 'https://example.org/domain/2',
          name: 'Chemistry',
        },
      },
    });

    const result = await ResearchDomain.findByURI(
      buildRequest(),
      'https://example.org/domain/2'
    );

    expect(result).toBeInstanceOf(ResearchDomain);
    expect(result?.id).toBe(2);
  });

  it('should return undefined when no research domain is found', async () => {
    jest.spyOn(ResearchDomain, 'query').mockResolvedValue({ data: undefined });

    const result = await ResearchDomain.findByURI(
      buildRequest(),
      'https://example.org/domain/missing'
    );

    expect(result).toBeUndefined();
  });
});
