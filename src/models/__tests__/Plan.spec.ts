import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Plan } from '../Plan.js';
import { CURRENT_SCHEMA_VERSION } from "@dmptool/types";

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

describe('Plan', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const plan = new Plan({ title: 'Test Plan' });

    expect(plan.title).toBe('Test Plan');
    expect(plan.visibility).toBe('PRIVATE');
    expect(plan.status).toBe('DRAFT');
    expect(plan.alternateIdentifiers).toEqual([]);
    expect(plan.members).toEqual([]);
  });

  it('should save when successful', async () => {
    const plan = new Plan({ id: 1 });

    jest.spyOn(Plan, 'mutate').mockResolvedValue({
      data: {
        updateEntirePlan: {
          id: 1,
          projectId: 10,
          dmpId: 'dmp-id',
          title: 'Updated',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: 'r',
          project: {} as never,
          versionedTemplate: {} as never,
          alternateIdentifiers: [],
          created: 'c',
          createdById: 1,
          modified: 'm2',
          modifiedById: 2,
        },
      },
    });

    const result = await plan.save(buildRequest());

    expect(result).toBe(true);
  });

  it('should find plan by dmp id', async () => {
    jest.spyOn(Plan, 'query').mockResolvedValue({
      data: {
        planByDMPId: {
          id: 5,
          projectId: 10,
          dmpId: 'dmp-5',
          title: 'Plan 5',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: 'r',
          project: {
            id: 10,
            title: 'Project',
            abstractText: '',
            startDate: '',
            endDate: '',
            isTestProject: false,
            members: [],
            fundings: [],
          } as never,
          versionedTemplate: {
            id: 1,
            template: { id: 1 },
            name: 'Template',
            description: '',
            version: '1.0',
            versionedSections: [],
          } as never,
          alternateIdentifiers: [],
          created: 'c',
          createdById: 1,
          modified: 'm',
          modifiedById: 1,
        },
      },
    });

    const result = await Plan.findByDMPId(buildRequest(), 'dmp-5');

    expect(result).toBeInstanceOf(Plan);
    expect(result?.id).toBe(5);
  });

  it('should find plan by alternate identifier', async () => {
    jest.spyOn(Plan, 'query').mockResolvedValue({
      data: {
        planByAlternateIdentifier: {
          id: 6,
          dmpId: 'dmp-6',
          title: 'Plan 6',
          visibility: 'PRIVATE',
          status: 'DRAFT',
          registered: '2025-11-23',
          project: {
            id: 10,
            title: 'Project',
            isTestProject: false,
          } as never,
          versionedTemplate: {
            id: 1,
            template: { id: 1 },
            name: 'Template',
            version: '1.0',
            versionedSections: [{
              id: 1,
              sectionId: 1,
              name: "Section one",
              tags: [],
              displayOrder: 1,
              versionedQuestions: [{
                id: 1,
                questionId: 1,
                versionedSectionId: 1,
                questionText: "Text Area field",
                displayOrder: 1,
                json: JSON.stringify({
                  type: 'textArea',
                  attributes: {
                    cols: 1,
                    rows: 4,
                    maxLength: 100,
                    asRichText: true
                  },
                  meta: {schemaVersion: CURRENT_SCHEMA_VERSION}
                })
              }]
            }],
          }
        },
      },
    });

    const result = await Plan.findByAlternateIdentifier(buildRequest(), 'alt-123');

    expect(result).toBeInstanceOf(Plan);
    expect(result?.id).toBe(6);
  });
});
