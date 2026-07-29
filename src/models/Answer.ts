import { BaseGraphQLModel } from "./BaseGQL.js";
import { EntirePlanAnswerFragment } from "../generated/graphql.js";
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
 * The structure of an answer returned from GraphQL queries
 */
export interface AnswerQueryResponse {
  id?: number;
  json?: string;
  versionedSection?: {
    id?: number;
  }
  versionedQuestion?: {
    id?: number;
  };
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
   * Convert an Answer from a GraphQL query into an object
   *
   * @param graphQLAnswer the Answer from GraphQL
   * @returns an Answer object
   */
  static fromGraphQL(graphQLAnswer: AnswerQueryResponse): Answer {
    return new Answer({
      id: graphQLAnswer.id,
      json: JSON.parse(graphQLAnswer.json || '{}'),
      versionedSectionId: graphQLAnswer.versionedSection?.id,
      versionedQuestionId: graphQLAnswer.versionedQuestion?.id
    });
  }

  /**
   * Convert an Answer object into the expected GraphQL input
   *
   * @returns the answer's info as an EntirePlanAnswerFragment for GraphQL
   */
  toGraphQLInput(): EntirePlanAnswerFragment {
    return {
      versionedSectionId: this.versionedSectionId,
      versionedQuestionId: this.versionedQuestionId,
      json: JSON.stringify(this.json)
    };
  }
}
