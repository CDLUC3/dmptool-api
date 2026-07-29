import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { Plan } from '../Plan.js';
import {
  AnswerDefaultMap,
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

  it('should convert from GraphQL', () => {
    const answer = Answer.fromGraphQL({
      id: 50,
      json: JSON.stringify({ type: QuestionFormatsEnum.enum.textArea, answer: 'test' }),
      versionedQuestion: { id: 12 },
      versionedSection: { id: 1 },
    });

    expect(answer.id).toBe(50);
    expect(answer.versionedQuestionId).toBe(12);
    expect(answer.versionedSectionId).toBe(1);
  });
});
