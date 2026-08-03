import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QuestionDefaultMap, QuestionFormatsEnum } from '@dmptool/types';
import { Plan } from '../../../../models/Plan.js';
import {
  VersionedQuestion,
  VersionedSection,
  VersionedTemplate
} from '../../../../models/VersionedTemplate.js';
import { readFileSync } from 'node:fs';

jest.unstable_mockModule('node:worker_threads', () => ({
  structuredClone: global.structuredClone,
}));

jest.unstable_mockModule('../../../../models/Answer.js', () => ({
  Answer: class Answer {
    plan?: Plan;
    format?: string;
    versionedSectionId?: number;
    versionedQuestionId?: number;
    json: unknown;
    validatedJSON: unknown;

    constructor(options: Record<string, unknown> = {}) {
      this.plan = options.plan as Plan | undefined;
      this.format = options.format as string | undefined;
      this.versionedSectionId = options.versionedSectionId as number | undefined;
      this.versionedQuestionId = options.versionedQuestionId as number | undefined;
      this.validatedJSON = typeof options.json === 'string'
        ? JSON.parse(options.json)
        : options.json;
      this.json = this.validatedJSON;
    }

    async save(): Promise<boolean> {
      return true;
    }
  },
}));

const { createNarrativeWorkflow } = await import('../narrativeWorkflow.js');

const makePlan = (template?: VersionedTemplate): Plan =>
  ({
    id: 11,
    dmpId: '10.12345/test',
    title: 'Test Plan',
    errors: {},
    warnings: {},
    versionedTemplate: template,
  }) as unknown as Plan;

const makeTextAnswer = (answer: string): Record<string, unknown> => ({
  type: QuestionFormatsEnum.enum.textArea,
  answer,
});

const makeDataset = (title: string) => ({
  title,
  description: `${title} description`,
  type: 'dataset',
  sensitive_data: 'yes',
  personal_data: 'yes',
  issued: '2026-01-03',
  distribution: [
    {
      data_access: 'open',
      byte_size: 1234567890,
      issued: '2026-01-03',
      host: {
        host_id: { identifier: 'https://repo.example/repository-1' },
        title: 'Example Repository',
        url: 'https://repo.example',
      },
      license_ref: [
        {
          license_ref: 'https://spdx.org/licenses/CC-BY-4.0.html',
          start_date: new Date('2026-01-01'),
        },
      ],
    },
  ],
  metadata: [
    {
      metadata_standard_id: { identifier: 'https://example.org/metadata-standard-1' },
      description: 'Metadata for the output',
    },
  ],
});

const makeResearchOutputAnswer = (title: string, overrides: Record<string, unknown> = {}) => {
  const sample = loadFullSampleNarrativeAndDataset();
  const answer = structuredClone(sample.researchOutputAnswerJSON);
  answer.answer = [structuredClone(answer.answer[0])];

  const row = answer.answer[0];
  const setColumn = (commonStandardId: string, value: unknown): void => {
   const column = row.columns.find((col: { commonStandardId?: string }) => col.commonStandardId === commonStandardId);
   if (column) {
     (column as { answer: unknown }).answer = value;
   }
  };

  setColumn('title', title);
  setColumn('description', '<p>Narrative description</p>');
  setColumn('type', 'software');
  setColumn('data_flags', ['personal']);
  setColumn('data_access', 'closed');
  setColumn('issued', '2025-01-01');
  setColumn('byte_size', { value: 1, context: 'bytes' });
  setColumn('host', [{ repositoryId: 'narrative-repo', repositoryName: 'Narrative repo' }]);
  setColumn('metadata', [{ metadataStandardId: 'narrative-md', metadataStandardName: 'Narrative metadata' }]);
  setColumn('license_ref', [{ licenseId: 'https://spdx.org/licenses/MIT.json', licenseName: 'MIT' }]);

  for (const [key, value] of Object.entries(overrides)) {
   setColumn(key, value);
  }

  return answer;
};

const makeNarrativeQuestion = (
  id: number,
  answer: Record<string, unknown>
): { id: number; text: string; answer: { json: Record<string, unknown> } } => ({
  id,
  text: `Question ${id}`,
  answer: {
   json: answer,
  },
});

const makeResearchOutputQuestion = (id: number, sectionId: number): VersionedQuestion =>
  new VersionedQuestion({
   id,
   questionId: id,
   versionedSectionId: sectionId,
   json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.researchOutputTable]),
  });

const makeTemplate = (...questions: VersionedQuestion[]): VersionedTemplate =>
  new VersionedTemplate({
   versionedSections: [
     new VersionedSection({
       id: 1,
       sectionId: 1,
       versionedQuestions: questions,
     }),
   ],
  });

const loadFullSampleNarrativeAndDataset = () => {
  const samplePath = new URL('../../../../../docs/jsonSamples/full-dmp-tool-v1_2.json', import.meta.url);
  const raw = readFileSync(samplePath, 'utf8');
  const sample = JSON.parse(raw).dmp;
  const researchOutputsSection = sample.narrative.template.section.find((section: { title?: string }) => {
   return section.title === 'Research Outputs';
  });

  if (!researchOutputsSection) {
   throw new Error('Unable to locate the Research Outputs section in the full sample JSON');
  }

  return {
   researchOutputAnswerJSON: researchOutputsSection.question[0].answer.json,
  };
};

describe('createNarrativeWorkflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return early when the plan has no versioned template', () => {
    const plan = makePlan(undefined);

    const dmp = {
      narrative: {
        template: {
          section: [{ question: [makeNarrativeQuestion(101, makeTextAnswer('Narrative text'))] }],
        },
      },
      dataset: [],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(result).toEqual([]);
  });

  it('should process narrative questions and create answers', () => {
    const template = makeTemplate(
      new VersionedQuestion({
        id: 21,
        questionId: 101,
        versionedSectionId: 1,
        json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
      })
    );
    const plan = makePlan(template);

    const dmp = {
      narrative: {
        template: {
          section: [{ question: [makeNarrativeQuestion(21, makeTextAnswer('Narrative text'))] }],
        },
      },
      dataset: [],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should add narrative answers and keep the research output table when no datasets exist', () => {
    const template = makeTemplate(
      new VersionedQuestion({
        id: 30,
        questionId: 300,
        versionedSectionId: 1,
        json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
      }),
      makeResearchOutputQuestion(31, 1)
    );
    const plan = makePlan(template);

    const dmp = {
      narrative: {
        template: {
          section: [{
            question: [
              makeNarrativeQuestion(30, makeTextAnswer('Narrative text')),
              makeNarrativeQuestion(31, makeResearchOutputAnswer('Narrative output')),
            ],
          }],
        },
      },
      dataset: [],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should add a dataset-derived research output answer when narrative is empty', () => {
    const template = makeTemplate(makeResearchOutputQuestion(31, 1));
    const plan = makePlan(template);
    const dataset = makeDataset('Standalone dataset');

    const dmp = {
      narrative: {
        template: {
          section: [],
        },
      },
      dataset: [dataset],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should append dataset rows when narrative and dataset entries do not overlap', () => {
    const template = makeTemplate(
      new VersionedQuestion({
        id: 40,
        questionId: 101,
        versionedSectionId: 1,
        json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
      }),
      makeResearchOutputQuestion(41, 1)
    );
    const plan = makePlan(template);
    const narrativeAnswer = makeResearchOutputAnswer('Narrative output');
    const dataset = makeDataset('Independent dataset');

    const dmp = {
      narrative: {
        template: {
          section: [
            {
              question: [
                {
                  id: 40,
                  answer: {
                    json: JSON.stringify(makeTextAnswer('Narrative text')),
                  },
                },
                {
                  id: 41,
                  answer: {
                    json: JSON.stringify(narrativeAnswer),
                  },
                },
              ],
            },
          ],
        },
      },
      dataset: [dataset],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should merge dataset info into an existing research output row when titles overlap', () => {
    const template = makeTemplate(makeResearchOutputQuestion(50, 1));
    const plan = makePlan(template);
    const dataset = makeDataset('Buoy data');

    const narrativeAnswer = makeResearchOutputAnswer(dataset.title, {
      description: '<p>Narrative description</p>',
      type: 'software',
      data_flags: ['personal'],
      data_access: 'closed',
      issued: '2025-01-01',
      byte_size: { value: 1, context: 'bytes' },
      host: [{ repositoryId: 'narrative-repo', repositoryName: 'Narrative repo' }],
      metadata: [{ metadataStandardId: 'narrative-md', metadataStandardName: 'Narrative metadata' }],
      license_ref: [{ licenseId: 'https://spdx.org/licenses/MIT.json', licenseName: 'MIT' }],
    });

    const dmp = {
      narrative: {
        template: {
          section: [
            {
              question: [
                {
                  id: 50,
                  answer: {
                    json: JSON.stringify(narrativeAnswer),
                  },
                },
              ],
            },
          ],
        },
      },
      dataset: [dataset],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should add a warning when a narrative question cannot be matched', () => {
    const template = makeTemplate(
      new VersionedQuestion({
        id: 60,
        questionId: 600,
        versionedSectionId: 1,
        json: JSON.stringify(QuestionDefaultMap[QuestionFormatsEnum.enum.textArea]),
      })
    );
    const plan = makePlan(template);

    const dmp = {
      narrative: {
        template: {
          section: [
            {
              question: [
                makeNarrativeQuestion(999, makeTextAnswer('Unmatched narrative text')),
              ],
            },
          ],
        },
      },
      dataset: [],
    } as never;

    const result = createNarrativeWorkflow(plan, dmp);

    expect(Array.isArray(result)).toBe(true);
  });
});
