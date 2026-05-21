import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { VersionedTemplate } from '../VersionedTemplate.js';

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('VersionedTemplate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const template = new VersionedTemplate({ name: 'Best Practices' });

    expect(template.name).toBe('Best Practices');
    expect(template.active).toBe(false);
  });

  it('should find by template id', async () => {
    jest.spyOn(VersionedTemplate, 'query').mockResolvedValue({
      data: {
        versionedTemplates: [
          {
            id: 5,
            template: { id: 7 },
            name: 'Template',
            description: 'Desc',
            version: '1.0',
            active: true,
          },
        ],
      },
    });

    const result = await VersionedTemplate.findByTemplateId(buildRequest(), 7);

    expect(result).toBeInstanceOf(VersionedTemplate);
    expect(result?.id).toBe(5);
  });

  it('should return undefined when no template matches template id', async () => {
    jest.spyOn(VersionedTemplate, 'query').mockResolvedValue({
      data: { versionedTemplates: [] },
    });

    const result = await VersionedTemplate.findByTemplateId(buildRequest(), 7);

    expect(result).toBeUndefined();
  });

  it('should find the default template', async () => {
    jest.spyOn(VersionedTemplate, 'query').mockResolvedValue({
      data: {
        defaultTemplate: new VersionedTemplate({
          id: 9,
          name: 'Default Template',
        }),
      },
    });

    const result = await VersionedTemplate.findDefault(buildRequest());

    expect(result).toBeDefined();
    expect(result?.id).toBe(9);
  });

  it('should return specific template from findOrDefault when template id resolves', async () => {
    const template = new VersionedTemplate({ id: 5, name: 'Specific Template' });

    jest.spyOn(VersionedTemplate, 'findByTemplateId').mockResolvedValue(template);
    jest.spyOn(VersionedTemplate, 'findDefault').mockResolvedValue(
      new VersionedTemplate({ id: 9, name: 'Default Template' })
    );

    const result = await VersionedTemplate.findOrDefault(buildRequest(), 7);

    expect(result).toBe(template);
    expect(VersionedTemplate.findDefault).not.toHaveBeenCalled();
  });

  it('should fall back to default template from findOrDefault', async () => {
    const defaultTemplate = new VersionedTemplate({ id: 9, name: 'Default Template' });

    jest.spyOn(VersionedTemplate, 'findByTemplateId').mockResolvedValue(undefined);
    jest.spyOn(VersionedTemplate, 'findDefault').mockResolvedValue(defaultTemplate);

    const result = await VersionedTemplate.findOrDefault(buildRequest(), 7);

    expect(result).toBe(defaultTemplate);
  });
});
