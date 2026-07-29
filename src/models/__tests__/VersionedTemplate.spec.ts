import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { VersionedQuestion, VersionedSection, VersionedTemplate } from '../VersionedTemplate.js';
import { QuestionDefaultMap, QuestionFormatsEnum, TextAreaQuestionType } from '@dmptool/types';

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
    expect(template.versionedSections).toEqual([]);
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

describe('VersionedQuestion', () => {
  it('should initialize defaults in constructor', () => {
    const question = new VersionedQuestion({ questionText: 'What is your plan?' });
    const parsed = JSON.parse(question.json);

    expect(question.id).toBe(0);
    expect(question.questionText).toBe('What is your plan?');
    expect(parsed.type).toBe(QuestionFormatsEnum.enum.textArea);
  });

  it('should preserve valid question JSON', () => {
    const validJSON = JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]);

    const question = new VersionedQuestion({ json: validJSON });

    expect(JSON.parse(question.json).type).toBe(QuestionFormatsEnum.enum.textArea);
  });

  it('should fall back to text area when JSON question type is invalid', () => {
    const question = new VersionedQuestion({
      json: JSON.stringify({ type: 'unsupported', prompt: 'bad question' }),
    });

    expect(JSON.parse(question.json).type).toBe(QuestionFormatsEnum.enum.textArea);
  });
});

describe('VersionedSection', () => {
  it('should initialize nested tags and questions in constructor', () => {
    const defaultJSON = QuestionDefaultMap[QuestionFormatsEnum.enum.textArea];
    const section = new VersionedSection({
      id: 7,
      sectionId: 70,
      name: 'Data outputs',
      tags: [{ id: 3, slug: 'preservation' }],
      versionedQuestions: [
        {
          id: 8,
          questionId: 800,
          displayOrder: 1,
          versionedSectionId: 7,
          questionText: 'Where will it be stored?',
          json: JSON.stringify(defaultJSON),
          validatedJSON: defaultJSON as TextAreaQuestionType,
        },
      ],
    });

    expect(section.tags[0].slug).toBe('preservation');
    expect(section.versionedQuestions[0]).toBeInstanceOf(VersionedQuestion);
    expect(section.versionedQuestions[0].questionId).toBe(800);
  });

  it('should find question by parent question id', () => {
    const defaultJSON = QuestionDefaultMap[QuestionFormatsEnum.enum.textArea];
    const section = new VersionedSection({
      versionedQuestions: [
        {
          id: 1,
          questionId: 101,
          versionedSectionId: 1,
          questionText: 'Q1',
          displayOrder: 1,
          json: JSON.stringify(defaultJSON),
          validatedJSON: defaultJSON as TextAreaQuestionType,
        },
        {
          id: 2,
          questionId: 202,
          versionedSectionId: 1,
          questionText: 'Q2',
          displayOrder: 2,
          json: JSON.stringify(defaultJSON),
          validatedJSON: defaultJSON as TextAreaQuestionType,
        },
      ],
    });

    const result = section.findQuestionById(2);

    expect(result).toBeDefined();
    expect(result?.id).toBe(2);
  });

  it('should return undefined when question id is not found', () => {
    const section = new VersionedSection();

    const result = section.findQuestionById(999);

    expect(result).toBeUndefined();
  });
});
