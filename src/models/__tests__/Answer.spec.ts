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
        answerByVersionedQuestionId: {
          id: 40,
          versionedQuestionId: 12,
          json: JSON.stringify(AnswerDefaultMap[QuestionFormatsEnum.enum.textArea]),
        },
      },
    });

    const result = await Answer.findByQuestion(buildRequest(), 1, 2, 12);

    expect(result).toBeInstanceOf(Answer);
    expect(result?.id).toBe(40);
  });
});
