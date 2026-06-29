import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import {
  AddAnswerDocument,
  AnswerForQuestionDocument,
  UpdateAnswerDocument,
} from "../generated/graphql.js";
import {
  AnswerDefaultMap,
  AnswerSchemaMap,
  AnyAnswerSchema,
  AnyAnswerType,
  QuestionFormatsEnum,
  TextAreaAnswerType
} from "@dmptool/types";
import { Plan } from "./Plan.js";
import { ZodSafeParseResult } from "zod";

/**
 * The possible response for an Answer lookup GraphQL query
 */
export interface AnswerForQuestionResponse {
  answerByVersionedQuestionId: Answer
}

/**
 * Representation of the GraphQL query response for adding an Answer
 */
export interface AddAnswerResponse {
  addAnswer: Answer
}

/**
 * Representation of the GraphQL query response for updating an Answer
 */
export interface UpdateAnswerResponse {
  updateAnswer: Answer
}

/**
 * Represents an Answer to a VersionedQuestion
 */
export class Answer extends BaseGraphQLModel {
  plan?: Plan;
  format?: string;
  versionedSectionId?: number;
  versionedCustomSectionId?: number;
  versionedQuestionId?: number;
  versionedCustomQuestionId?: number;
  json: string | AnyAnswerType;
  validatedJSON: AnyAnswerType;

  constructor(options: Partial<Answer> = {}) {
    super(options);

    this.plan = options.plan;
    this.versionedSectionId = options.versionedSectionId;
    this.versionedCustomSectionId = options.versionedCustomSectionId;
    this.versionedQuestionId = options.versionedQuestionId;
    this.versionedCustomQuestionId = options.versionedCustomQuestionId;

    // If the JSON is missing, use the default Text Area
    const defaultJSON = Object.keys(AnswerSchemaMap).some(k => k === options.format)
      ? AnswerDefaultMap[options.format as keyof typeof AnswerDefaultMap] as AnyAnswerType
      : AnswerDefaultMap[QuestionFormatsEnum.enum.textArea] as TextAreaAnswerType;

    // Verify that the JSON is a valid Question otherwise use TextArea
    const parsedJSON = typeof options.json === 'string'
      ? JSON.parse(options.json)
      : (options.json && typeof options.json === 'object' ? options.json : defaultJSON);

    if (Object.keys(AnswerSchemaMap).includes(parsedJSON.type)) {
      const parseResult: ZodSafeParseResult<AnyAnswerType> = AnyAnswerSchema.safeParse(
        parsedJSON.json ? parsedJSON.json : parsedJSON
      );
      this.validatedJSON = parseResult?.success ? parseResult.data : defaultJSON;
    } else {
      this.validatedJSON = defaultJSON;
    }

    this.json = JSON.stringify(this.validatedJSON);
  }

  /**
   * Shortcut helper function to save or update the current Answer
   *
   * @param request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async save(request: FastifyRequest): Promise<boolean> {
    if (this.id) return await this.update(request);

    return await this.create(request);
  }

  /**
   * Create the current Answer
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<AddAnswerResponse> = await Answer.mutate<AddAnswerResponse>(
      request,
      {
        mutation: AddAnswerDocument,
        variables: {
          projectId: this.plan?.projectId,
          planId: this.plan?.id,
          versionedSectionId: this.versionedSectionId,
          versionedQuestionId: this.versionedQuestionId,
          versionedCustomSectionId: this.versionedCustomSectionId,
          versionedCustomQuestionId: this.versionedCustomQuestionId,
          json: this.json,
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: Answer | undefined = saved?.data?.addAnswer;
    this.processGQLResponse(saved, data as Answer, 'create Answer');
    return !this.hasErrors();
  }

  /**
   * Update the current Answer
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async update(request: FastifyRequest): Promise<boolean> {
    const updated: GQLResponse<UpdateAnswerResponse> = await Answer.mutate<UpdateAnswerResponse>(
      request,
      {
        mutation: UpdateAnswerDocument,
        variables: {
          answerId: this.id,
          json: this.json
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: Answer | undefined = updated?.data?.updateAnswer;
    this.processGQLResponse(updated, data as Answer, 'update Answer');
    return !this.hasErrors();
  }

  /**
   * Find Plan Members/Contributors by a Plan id
   *
   * @param request the Fastify request
   * @param projectId the Project's id
   * @param planId the Plan's id
   * @param versionedQuestionId the VersionedQuestion's id
   * @param versionedCustomQuestionId the id of the VersionedCustomQuestion (optional)
   * @returns the Answer or undefined
   */
  static async findByQuestion(
    request: FastifyRequest,
    projectId: number,
    planId: number,
    versionedQuestionId: number,
    versionedCustomQuestionId?: number
  ): Promise<Answer | undefined> {
    const resp: GQLResponse<AnswerForQuestionResponse> = await this.query<AnswerForQuestionResponse>(
      request,
      {
        query: AnswerForQuestionDocument,
        variables: {
          projectId,
          planId,
          versionedQuestionId,
          versionedCustomQuestionId
        },
        errorPolicy: "all"
      }
    );
    return resp.data?.answerByVersionedQuestionId ? new Answer(resp.data.answerByVersionedQuestionId) : undefined;
  }
}
