import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Plan } from '../Plan.js';
import { VersionedQuestion, VersionedSection, VersionedTemplate } from '../VersionedTemplate.js';
import {
  AnswerDefaultMap,
  DefaultResearchOutputTableQuestion,
  QuestionFormatsEnum,
} from '@dmptool/types';

jest.unstable_mockModule('node:worker_threads', () => ({
  structuredClone: global.structuredClone,
}));

const { Answer } = await import('../Answer.js');

const buildRequest = (): FastifyRequest =>
  ({
    log: {
      debug: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }) as unknown as FastifyRequest;

const buildResearchOutputQuestion = (): VersionedQuestion =>
  new VersionedQuestion({
    id: 31,
    questionId: 301,
    versionedSectionId: 10,
    json: JSON.stringify(DefaultResearchOutputTableQuestion),
  });

const buildDataset = (title: string, accessLevel?: string) => ({
  title,
  description: `${title} description`,
  type: 'Dataset',
  sensitive_data: 'yes',
  personal_data: 'yes',
  byte_size: 2048,
  issued: '2024-05-01 12:34:56',
  distribution: [
    {
      host: {
        url: 'https://repo.example.org',
        title: 'Example Repo',
        host_id: { identifier: 'repo-123' },
      },
      data_access: accessLevel,
      license_ref: [
        {
          license_ref: 'https://license.example.org/old',
          start_date: new Date('2023-01-01T00:00:00Z'),
        },
        {
          license_ref: 'https://license.example.org/new',
          start_date: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    },
  ],
  metadata: {
    filter: (predicate: (item: { description: string; metadata_standard_id: { identifier: string } }) => boolean) => ([
      {
        description: 'Metadata standard description',
        metadata_standard_id: { identifier: 'metadata-std-1' },
      },
    ]).filter(predicate),
    trim: () => 'metadata trimmed',
  },
});

const buildResearchOutputRow = (title: string) => ({
  columns: [
    { type: 'text', commonStandardId: 'title', answer: title, meta: { schemaVersion: '1.0' } },
    { type: 'textArea', commonStandardId: 'description', answer: '', meta: { schemaVersion: '1.0' } },
    { type: 'selectBox', commonStandardId: 'type', answer: '', meta: { schemaVersion: '1.0' } },
    { type: 'checkBoxes', commonStandardId: 'data_flags', answer: [], meta: { schemaVersion: '1.0' } },
    { type: 'radioButtons', commonStandardId: 'data_access', answer: '', meta: { schemaVersion: '1.0' } },
    { type: 'date', commonStandardId: 'issued', answer: '', meta: { schemaVersion: '1.0' } },
    { type: 'numberWithContext', commonStandardId: 'byte_size', answer: { value: '', context: 'bytes' }, meta: { schemaVersion: '1.0' } },
    { type: 'repositorySearch', commonStandardId: 'host', answer: [], meta: { schemaVersion: '1.0' } },
    { type: 'metadataStandardSearch', commonStandardId: 'metadata', answer: [], meta: { schemaVersion: '1.0' } },
    { type: 'licenseSearch', commonStandardId: 'license_ref', answer: [], meta: { schemaVersion: '1.0' } },
    { type: 'text', commonStandardId: 'custom', answer: '', meta: { schemaVersion: '1.0' } },
  ],
});

describe('Answer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize defaults in constructor', () => {
    const answer = new Answer();
    const parsed = JSON.parse(answer.json.toString());

    expect(parsed.type).toBe(QuestionFormatsEnum.enum.textArea);
    expect(answer.versionedQuestionId).toBeUndefined();
  });

  it('should fall back to default JSON when input type is invalid', () => {
    const answer = new Answer({
      format: QuestionFormatsEnum.enum.text,
      json: JSON.stringify({ type: 'unsupported', answer: 'invalid' }),
    });

    expect(answer.validatedJSON.type).toBe(QuestionFormatsEnum.enum.text);
  });

  it('should convert maDMP narrative question to answer', () => {
    const request = buildRequest();
    const template = new VersionedTemplate({
      versionedSections: [
        new VersionedSection({
          id: 10,
          sectionId: 100,
          versionedQuestions: [
            new VersionedQuestion({
              id: 22,
              questionId: 99,
              versionedSectionId: 10,
              questionText: 'Question',
            }),
          ],
        }),
      ],
    });
    const plan = new Plan({ id: 1, title: 'Plan', versionedTemplate: template });

    const result = Answer.fromMaDMPNarrative(
      request,
      plan,
      {
        id: 22,
        text: 'Question',
        answer: {
          json: JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.textArea]),
        },
      } as never
    );

    expect(result).toBeInstanceOf(Answer);
    expect(result?.versionedSectionId).toBe(10);
    expect(result?.versionedQuestionId).toBe(22);
  });

  it('should return undefined from maDMP narrative conversion when template is missing', () => {
    const request = buildRequest();
    const plan = new Plan({ id: 1, title: 'Plan' });

    const result = Answer.fromMaDMPNarrative(
      request,
      plan,
      { id: 99, answer: '{}' } as never
    );

    expect(result).toBeUndefined();
    expect(request.log.error).toHaveBeenCalled();
  });

  it('should return undefined from maDMP narrative conversion when question is not found', () => {
    const request = buildRequest();
    const template = new VersionedTemplate({
      versionedSections: [
        new VersionedSection({
          id: 10,
          sectionId: 100,
          versionedQuestions: [
            new VersionedQuestion({
              id: 22,
              questionId: 99,
              versionedSectionId: 10,
              questionText: 'Question',
            }),
          ],
        }),
      ],
    });
    const plan = new Plan({ id: 1, title: 'Plan', versionedTemplate: template });

    const result = Answer.fromMaDMPNarrative(
      request,
      plan,
      {
        id: 999,
        text: 'Unmatched question',
        answer: {
          json: JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.textArea]),
        },
      } as never
    );

    expect(result).toBeUndefined();
    expect(request.log.error).toHaveBeenCalled();
  });

  it('should save by updating when id exists', async () => {
    const answer = new Answer({ id: 1 });
    const createSpy = jest.spyOn(answer, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(answer, 'update').mockResolvedValue(true);

    const result = await answer.save(buildRequest());

    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should save by creating then updating when id is missing', async () => {
    const answer = new Answer();
    const createSpy = jest.spyOn(answer, 'create').mockResolvedValue(true);
    const updateSpy = jest.spyOn(answer, 'update').mockResolvedValue(true);

    const result = await answer.save(buildRequest());

    expect(result).toBe(true);
    expect(createSpy).toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should return false from save when create fails', async () => {
    const answer = new Answer();
    const createSpy = jest.spyOn(answer, 'create').mockResolvedValue(false);
    const updateSpy = jest.spyOn(answer, 'update').mockResolvedValue(true);

    const result = await answer.save(buildRequest());

    expect(result).toBe(false);
    expect(createSpy).toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should create and sync fields on success', async () => {
    const answer = new Answer({
      plan: new Plan({ id: 4, projectId: 9 }),
      versionedSectionId: 11,
      versionedQuestionId: 12,
      json: JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.textArea]),
    });

    jest.spyOn(Answer, 'mutate').mockResolvedValue({
      data: {
        addAnswer: {
          id: 21,
          created: 'created',
          createdById: 1,
          modified: 'modified',
          modifiedById: 2,
          json: answer.json,
        } as never,
      },
    });

    const result = await answer.create(buildRequest());

    expect(result).toBe(true);
    expect(answer.id).toBe(21);
    expect(answer.created).toBe('created');
    expect(answer.modified).toBe('modified');
  });

  it('should update and sync modified fields on success', async () => {
    const answer = new Answer({ id: 21 });

    jest.spyOn(Answer, 'mutate').mockResolvedValue({
      data: {
        updateAnswer: {
          id: 21,
          modified: 'updated',
          modifiedById: 5,
          json: answer.json,
        } as never,
      },
    });

    const result = await answer.update(buildRequest());

    expect(result).toBe(true);
    expect(answer.modified).toBe('updated');
    expect(answer.modifiedById).toBe(5);
  });

  it('should find answer by question', async () => {
    jest.spyOn(Answer, 'query').mockResolvedValue({
      data: {
        answerByVersionedQuestionId: [
          {
            id: 40,
            versionedQuestionId: 12,
            json: JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.textArea]),
          },
        ],
      },
    });

    const result = await Answer.findByQuestion(buildRequest(), 1, 2, 12);

    expect(result).toBeInstanceOf(Answer);
    expect(result?.id).toBe(40);
  });

  it('should return undefined when answer lookup payload is not an array', async () => {
    jest.spyOn(Answer, 'query').mockResolvedValue({
      data: {
        answerByVersionedQuestionId: { id: 40 } as never,
      },
    });

    const result = await Answer.findByQuestion(buildRequest(), 1, 2, 12);

    expect(result).toBeUndefined();
  });

  it('should return undefined from dataset conversion when template is missing', () => {
    const request = buildRequest();
    const plan = new Plan({ id: 1, title: 'Plan' });
    const question = buildResearchOutputQuestion();

    const result = Answer.fromMaDMPDatasets(
      request,
      plan,
      question,
      JSON.parse(JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.researchOutputTable])),
      [buildDataset('Dataset A')]
    );

    expect(result).toBeUndefined();
    expect(request.log.error).toHaveBeenCalled();
  });

  it('should return undefined from dataset conversion when question is missing', () => {
    const request = buildRequest();
    const plan = new Plan({
      id: 1,
      title: 'Plan',
      versionedTemplate: new VersionedTemplate({
        versionedSections: [
          new VersionedSection({
            id: 10,
            sectionId: 100,
            versionedQuestions: [],
          }),
        ],
      }),
    });
    const question = buildResearchOutputQuestion();

    const result = Answer.fromMaDMPDatasets(
      request,
      plan,
      question,
      JSON.parse(JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.researchOutputTable])),
      [buildDataset('Dataset A')]
    );

    expect(result).toBeUndefined();
    expect(request.log.error).toHaveBeenCalled();
  });

  it('should map maDMP datasets into research output rows', () => {
    const request = buildRequest();
    const question = buildResearchOutputQuestion();
    const plan = new Plan({
      id: 1,
      title: 'Plan',
      versionedTemplate: new VersionedTemplate({
        versionedSections: [
          new VersionedSection({
            id: 10,
            sectionId: 100,
            versionedQuestions: [question],
          }),
        ],
      }),
    });

    const existingAnswer = JSON.parse(JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.researchOutputTable]));
    existingAnswer.answer = [];

    const result = Answer.fromMaDMPDatasets(
      request,
      plan,
      question,
      existingAnswer,
      [
        buildDataset('Open Dataset', 'open'),
        buildDataset('Shared Dataset', 'shared'),
        buildDataset('Default Dataset'),
      ]
    );

    expect(result).toBeDefined();
    expect(result?.answer).toHaveLength(3);

    const openRow = result?.answer.find((row: { columns: { commonStandardId?: string; answer?: unknown }[] }) =>
      row.columns.some((column) => column.commonStandardId === 'title' && column.answer === 'Open Dataset')
    );

    expect(openRow).toBeDefined();
    expect(openRow?.columns.find((column) => column.commonStandardId === 'title')?.answer).toBe('Open Dataset');
    expect(openRow?.columns.find((column) => column.commonStandardId === 'type')?.answer).toBe('dataset');
  });

  it('should map research output columns through the private dataset helper', () => {
    const helper = Answer as unknown as {
      researchOutputTableColumnFromMaDMPDataset: (
        row: { columns: { commonStandardId?: string; answer?: unknown }[] },
        commonStandardId: string,
        dataset: ReturnType<typeof buildDataset>
      ) => { commonStandardId?: string; answer?: unknown };
    };

    const openDataset = buildDataset('Open Dataset', 'open');
    const sharedDataset = buildDataset('Shared Dataset', 'shared');
    const defaultDataset = buildDataset('Default Dataset');

    const row = buildResearchOutputRow('Initial Title');

    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'title', openDataset).answer).toBe('Open Dataset');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'description', openDataset).answer)
      .toBe('Open Dataset description');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'type', openDataset).answer).toBe('dataset');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'data_flags', openDataset).answer).toBe('');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'data_access', openDataset).answer).toBe('open');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'issued', openDataset).answer).toBe('');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'byte_size', openDataset).answer)
      .toEqual({ value: '', context: 'bytes' });
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'host', openDataset).answer).toBe('');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'metadata', openDataset).answer).toBe('metadata trimmed');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'license_ref', openDataset).answer).toBe('');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(row, 'custom', openDataset).answer).toBe('');

    const sharedRow = buildResearchOutputRow('Shared Title');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(sharedRow, 'data_access', sharedDataset).answer).toBe('restricted');

    const defaultRow = buildResearchOutputRow('Default Title');
    expect(helper.researchOutputTableColumnFromMaDMPDataset(defaultRow, 'data_access', defaultDataset).answer).toBe('closed');
  });

  it('should update an existing research output row when the title matches', () => {
    const request = buildRequest();
    const question = buildResearchOutputQuestion();
    const existingRow = buildResearchOutputRow('Existing Dataset');
    const existingAnswer = JSON.parse(JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.researchOutputTable]));
    existingAnswer.answer = [existingRow];

    const plan = new Plan({
      id: 1,
      title: 'Plan',
      versionedTemplate: new VersionedTemplate({
        versionedSections: [
          new VersionedSection({
            id: 10,
            sectionId: 100,
            versionedQuestions: [question],
          }),
        ],
      }),
    });

    const result = Answer.fromMaDMPDatasets(
      request,
      plan,
      question,
      existingAnswer,
      [buildDataset('Existing Dataset', 'open')]
    );

    expect(result?.answer).toHaveLength(1);
    expect(result?.answer[0].columns.find((column: { commonStandardId?: string }) => column.commonStandardId === 'title')?.answer)
      .toBe('Existing Dataset');
    expect(result?.answer[0].columns.find((column: { commonStandardId?: string }) => column.commonStandardId === 'data_access')?.answer)
      .toBe('open');
  });
});
