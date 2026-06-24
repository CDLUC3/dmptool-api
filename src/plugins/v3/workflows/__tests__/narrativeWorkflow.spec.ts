import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import {
  DefaultResearchOutputTableAnswer,
  QuestionDefaultMap,
  QuestionFormatsEnum,
} from '@dmptool/types';
import { Plan } from '../../../../models/Plan.js';
import { VersionedQuestion, VersionedSection, VersionedTemplate } from '../../../../models/VersionedTemplate.js';
import { readFileSync } from 'node:fs';
import {DatasetType} from "../../../../types.js";

jest.unstable_mockModule('node:worker_threads', () => ({
  structuredClone: global.structuredClone,
}));

const { createNarrativeWorkflow } = await import('../narrativeWorkflow.js');
const { Answer } = await import('../../../../models/Answer.js');

const makeRequest = (): FastifyRequest =>
  ({
    log: {
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    },
  }) as unknown as FastifyRequest;

const makePlan = (template?: VersionedTemplate): Plan =>
  ({
    id: 11,
    dmpId: '10.12345/test',
    title: 'Test Plan',
    errors: {},
    versionedTemplate: template,
  }) as unknown as Plan;

const makeNarrativeQuestion = (id: number): { id: number; text: string; answer: { json: string } } => ({
  id,
  text: `Question ${id}`,
  answer: {
    json: JSON.stringify({ type: QuestionFormatsEnum.enum.textArea, answer: 'Narrative text' }),
  },
});

const loadFullSampleNarrativeAndDataset = () => {
  const samplePath = new URL('../../../../../docs/jsonSamples/full-dmp-tool-v1_2.json', import.meta.url);
  const raw = readFileSync(samplePath, 'utf8');

  const datasetMatch = raw.match(/"dataset"\s*:\s*(\[[\s\S]*?\])\s*,\s*"description"/);
  const researchOutputMatch = raw.match(
    /(\{\s*"meta"\s*:\s*\{[\s\S]*?"type"\s*:\s*"researchOutputTable"[\s\S]*?"columnHeadings"\s*:\s*\[[\s\S]*?\]\s*\})/
  );
  const narrativeTextMatch = raw.match(/"type"\s*:\s*"textArea"[\s\S]*?"answer"\s*:\s*"([^"]+)"/);

  if (!datasetMatch || !researchOutputMatch || !narrativeTextMatch) {
    throw new Error('Unable to extract dataset/narrative research output content from full sample JSON');
  }

  return {
    datasets: JSON.parse(datasetMatch[1]),
    researchOutputAnswerJSON: JSON.parse(researchOutputMatch[1]),
    narrativeTextAnswer: narrativeTextMatch[1],
  };
};

describe('createNarrativeWorkflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return early when the plan has no versioned template', async () => {
    const request = makeRequest();
    const plan = makePlan(undefined);

    const fromNarrativeSpy = jest.spyOn(Answer, 'fromMaDMPNarrative');

    const dmp = {
      narrative: {
        template: {
          section: [{ question: [makeNarrativeQuestion(101)] }],
        },
      },
      dataset: [],
    } as never;

    const result = await createNarrativeWorkflow(request, plan, dmp);

    expect(result).toBe(plan);
    expect(fromNarrativeSpy).not.toHaveBeenCalled();
  });

  it('should process narrative questions and set a plan error when save fails', async () => {
    const request = makeRequest();
    const template = new VersionedTemplate({
      versionedSections: [
        new VersionedSection({
          id: 1,
          sectionId: 11,
          versionedQuestions: [
            new VersionedQuestion({
              id: 21,
              questionId: 101,
              versionedSectionId: 1,
              json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
            }),
          ],
        }),
      ],
    });
    const plan = makePlan(template);

    const failedAnswer = {
      format: QuestionFormatsEnum.enum.textArea,
      validatedJSON: { ...DefaultResearchOutputTableAnswer },
      save: jest.fn().mockResolvedValue(false as never),
    };

    jest.spyOn(Answer, 'fromMaDMPNarrative').mockReturnValue(failedAnswer as never);
    const saveSpy = jest.spyOn(Answer.prototype, 'save').mockResolvedValue(true as never);
    jest.spyOn(Answer, 'fromMaDMPDatasets').mockReturnValue({
      ...DefaultResearchOutputTableAnswer,
      answer: [],
    } as never);

    const dmp = {
      narrative: {
        template: {
          section: [{ question: [makeNarrativeQuestion(21)] }],
        },
      },
      dataset: [],
    } as never;

    const result = await createNarrativeWorkflow(request, plan, dmp);

    expect(result).toBe(plan);
    expect(Answer.fromMaDMPNarrative).toHaveBeenCalledTimes(1);
    expect(failedAnswer.save).toHaveBeenCalledTimes(1);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(plan.errors.narrative).toBe('Unable to save answer for question 21');
  });

  it('should convert datasets and insert a research output answer when one exists in narrative', async () => {
    const request = makeRequest();
    const researchOutputQuestion = new VersionedQuestion({
      id: 30,
      questionId: 300,
      versionedSectionId: 3,
      json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.researchOutputTable]),
    });
    const template = new VersionedTemplate({
      versionedSections: [
        new VersionedSection({
          id: 3,
          sectionId: 33,
          versionedQuestions: [researchOutputQuestion],
        }),
      ],
    });
    const plan = makePlan(template);

    const narrativeResearchOutputAnswer = {
      format: QuestionFormatsEnum.enum.researchOutputTable,
      validatedJSON: { ...DefaultResearchOutputTableAnswer, answer: [] },
      save: jest.fn().mockResolvedValue(true as never),
    };

    jest.spyOn(Answer, 'fromMaDMPNarrative').mockReturnValue(narrativeResearchOutputAnswer as never);
    const saveSpy = jest.spyOn(Answer.prototype, 'save').mockResolvedValue(true as never);
    const fromDatasetsSpy = jest.spyOn(Answer, 'fromMaDMPDatasets').mockReturnValue({
      ...DefaultResearchOutputTableAnswer,
      answer: [{}],
    } as never);

    const dmp = {
      narrative: {
        template: {
          section: [{ question: [makeNarrativeQuestion(30)] }],
        },
      },
      dataset: [{ title: 'Dataset A' }],
    };

    const result = await createNarrativeWorkflow(request, plan, dmp);

    expect(result).toBe(plan);
    expect(fromDatasetsSpy).toHaveBeenCalledWith(
      request,
      plan,
      researchOutputQuestion,
      narrativeResearchOutputAnswer.validatedJSON,
      dmp.dataset
    );
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(narrativeResearchOutputAnswer.save).toHaveBeenCalledTimes(1);
  });

  it('should append dataset-derived research output answer when no narrative table answer exists', async () => {
    const request = makeRequest();
    const narrativeQuestion = new VersionedQuestion({
      id: 20,
      questionId: 200,
      versionedSectionId: 2,
      json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
    });
    const researchOutputQuestion = new VersionedQuestion({
      id: 31,
      questionId: 301,
      versionedSectionId: 2,
      json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.researchOutputTable]),
    });
    const template = new VersionedTemplate({
      versionedSections: [
        new VersionedSection({
          id: 2,
          sectionId: 22,
          versionedQuestions: [narrativeQuestion, researchOutputQuestion],
        }),
      ],
    });
    const plan = makePlan(template);

    const narrativeTextAnswer = {
      format: QuestionFormatsEnum.enum.textArea,
      validatedJSON: { type: QuestionFormatsEnum.enum.textArea, answer: 'x' },
      save: jest.fn().mockResolvedValue(true as never),
    };

    jest.spyOn(Answer, 'fromMaDMPNarrative').mockReturnValue(narrativeTextAnswer as never);
    const saveSpy = jest.spyOn(Answer.prototype, 'save').mockResolvedValue(true as never);
    jest.spyOn(Answer, 'fromMaDMPDatasets').mockReturnValue({
      ...DefaultResearchOutputTableAnswer,
      answer: [{}],
    } as never);

    const dmp = {
      narrative: {
        template: {
          section: [{ question: [makeNarrativeQuestion(20)] }],
        },
      },
      dataset: [{ title: 'Dataset B' }],
    } as never;

    const result = await createNarrativeWorkflow(request, plan, dmp);

    expect(result).toBe(plan);
    expect(narrativeTextAnswer.save).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('should combine 2 narrative research outputs with 1 dataset entry into a 3-row research output table', async () => {
    const request = makeRequest();
    const sample = loadFullSampleNarrativeAndDataset();

    const textQuestion = new VersionedQuestion({
      id: 40,
      questionId: 101,
      versionedSectionId: 4,
      json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
    });
    const researchOutputQuestion = new VersionedQuestion({
      id: 41,
      questionId: 300,
      versionedSectionId: 4,
      json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.researchOutputTable]),
    });
    const template = new VersionedTemplate({
      versionedSections: [
        new VersionedSection({
          id: 4,
          sectionId: 44,
          versionedQuestions: [textQuestion, researchOutputQuestion],
        }),
      ],
    });
    const plan = makePlan(template);

    const realFromNarrative = Answer.fromMaDMPNarrative;
    jest.spyOn(Answer, 'fromMaDMPNarrative').mockImplementation((req, p, q) => {
      const answer = realFromNarrative(req, p, q);
      if (!answer) return undefined;

      // The sample's narrative payload carries JSON in the answer string; set format so workflow can detect table answers.
      const parsed = JSON.parse(q.answer.json) as { type?: string };
      answer.format = parsed.type;
      return answer;
    });

    let combinedResearchOutputAnswer: {
      validatedJSON: { type: string; answer: unknown[] };
      save: jest.Mock;
    } | undefined;

    // Prevent workflow from attempting real GraphQL persistence for Answer class instances.
    jest.spyOn(Answer.prototype, 'save').mockResolvedValue(true as never);

    const fromDatasetsSpy = jest.spyOn(Answer, 'fromMaDMPDatasets').mockImplementation((
      _req,
      _plan,
      _question,
      existingAnswer,
      datasets
    ) => {
      const combinedRows = [
        ...(existingAnswer.answer || []),
        ...datasets.map((dataset: DatasetType) => ({
          columns: [{
            type: 'text',
            commonStandardId: 'title',
            answer: dataset.title,
            meta: { schemaVersion: '1.0' },
          }],
        })),
      ];

      combinedResearchOutputAnswer = {
        validatedJSON: {
          type: QuestionFormatsEnum.enum.researchOutputTable,
          answer: combinedRows,
        },
        save: jest.fn().mockResolvedValue(true as never),
      };

      return combinedResearchOutputAnswer as never;
    });

    const dmp = {
      narrative: {
        template: {
          section: [
            {
              question: [
                {
                  id: 40,
                  answer: {
                    json: JSON.stringify({
                      type: QuestionFormatsEnum.enum.textArea,
                      answer: sample.narrativeTextAnswer,
                    }),
                  },
                },
                {
                  id: 41,
                  answer: {
                    json: JSON.stringify(sample.researchOutputAnswerJSON),
                  },
                },
              ],
            },
          ],
        },
      },
      dataset: sample.datasets,
    } as never;

    const result = await createNarrativeWorkflow(request, plan, dmp);

    expect(result).toBe(plan);
    expect(Answer.fromMaDMPNarrative).toHaveBeenCalledTimes(2);
    expect(fromDatasetsSpy).toHaveBeenCalledTimes(1);

    const existingResearchOutputAnswer = fromDatasetsSpy.mock.calls[0][3] as {
      answer?: unknown[];
    };
    expect(existingResearchOutputAnswer.answer).toHaveLength(2);
    expect(sample.datasets).toHaveLength(1);

    expect(combinedResearchOutputAnswer).toBeDefined();
    expect(combinedResearchOutputAnswer?.validatedJSON.type).toBe(QuestionFormatsEnum.enum.researchOutputTable);
    expect(combinedResearchOutputAnswer?.validatedJSON.answer).toHaveLength(3);
    expect(Answer.prototype.save).toHaveBeenCalledTimes(2);
  });
});
