import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import {
  AddAnswerDocument,
  AnswerForQuestionDocument,
  UpdateAnswerDocument,
} from "../generated/graphql.js";
import { VersionedQuestion } from "./VersionedTemplate.js";
import {
  AnswerDefaultMap,
  AnswerSchemaMap,
  AnyAnswerSchema,
  AnyAnswerType, AnyResearchOutputTableColumnAnswerSchema,
  AnyResearchOutputTableColumnAnswerType, DefaultResearchOutputTableRowAnswer,
  QuestionFormatsEnum,
  ResearchOutputTableAnswerType, ResearchOutputTableQuestionType,
  ResearchOutputTableRowAnswerSchema,
  ResearchOutputTableRowAnswerType, TextAnswerType,
  TextAreaAnswerType
} from "@dmptool/types";
import { Plan } from "./Plan.js";
import { ZodSafeParseResult } from "zod";
import {
  DatasetsType,
  DatasetType,
  DistributionType, LicenseType, MetadataType,
  NarrativeQuestionType
} from "../types.js";
import { convertMySQLDateTimeToRFC3339 } from "@dmptool/utils";

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
   * Convert an entry from the maDMP narrative section into an answer
   *
   * @param request the Fastify request
   * @param plan the Plan
   * @param question the maDMP narrative question
   * @returns the Answer to the Versioned Question
   */
  static fromMaDMPNarrative = (
    request: FastifyRequest,
    plan: Plan,
    question: NarrativeQuestionType
  ): Answer | undefined => {
    const logBase = { planId: plan.id, title: plan.title };

    // The Plan must have a versioned template
    if (!plan.versionedTemplate) {
      request.log.error(logBase, 'Plan does not have a versioned template!');
      return undefined;
    }

    // Find the question within the Plan's versioned template
    const versionedQuestion: VersionedQuestion | undefined = plan.versionedTemplate.findNarrativeQuestion(question);
    if (!versionedQuestion) {
      request.log.error({ ...logBase, question }, 'Specified question does not exist on versioned template');
      return undefined;
    }

    return new Answer({
      plan,
      versionedSectionId: versionedQuestion.versionedSectionId,
      versionedQuestionId: versionedQuestion.id,
      json: question.answer?.json,
    });
  }

  /**
   * Convert maDMP dataset entries into a Research Output Table Answer
   *
   * @param request the Fastify request
   * @param plan the Plan
   * @param question the Versioned Question
   * @param existingAnswer the current ResearchOutputTableAnswer derived from the maDMP narrative
   * @param datasets the maDMP dataset array
   * @returns the updated research output table answer
   */
  static fromMaDMPDatasets = (
    request: FastifyRequest,
    plan: Plan,
    question: VersionedQuestion,
    existingAnswer: ResearchOutputTableAnswerType,
    datasets: DatasetsType,
  ): ResearchOutputTableAnswerType | undefined => {
    const logBase = { planId: plan.id, title: plan.title };
    const newAnswer: ResearchOutputTableAnswerType = structuredClone(existingAnswer);
    const roQuestion = JSON.parse(question.json) as ResearchOutputTableQuestionType;

    // The Plan must have a versioned template
    if (!plan.versionedTemplate) {
      request.log.error(logBase, 'Plan does not have a versioned template!');
      return undefined;
    }

    // Find the question within the Plan's versioned template
    const versionedQuestion: VersionedQuestion | undefined = plan.versionedTemplate.findQuestionById(question.id);
    if (!versionedQuestion) {
      request.log.error({ ...logBase, question }, 'Specified question does not exist on versioned template');
      return undefined;
    }

    // Convert the existing rows into a Map of title => row
    const existingTitles = new Map<string, ResearchOutputTableRowAnswerType>();
    for (const row of newAnswer.answer) {
      for (const column of row.columns) {
        if (column.commonStandardId === 'title') {
          existingTitles.set((column as TextAnswerType).answer.toLowerCase().trim(), row);
          break;
        }
      }
    }

    // Loop through the datasets
    for (const dataset of datasets) {
      // Try to find a match by the dataset title (since it is the only required column)
      // in the existing research output table answer
      const existingRow: ResearchOutputTableRowAnswerType | undefined = existingTitles.get(dataset.title.toLowerCase().trim());
      const workingRow = existingRow
        || Answer.initializeResearchOutputTableRow(request, roQuestion as ResearchOutputTableQuestionType);

      if (!existingRow) {
        newAnswer.answer.push(workingRow);
      }

      // Update the row
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'title', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'description', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'type', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'data_flags', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'data_access', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'byte_size', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'issued', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'host', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'metadata', dataset);
      Answer.researchOutputTableColumnFromMaDMPDataset(workingRow, 'license_ref', dataset);

      request.log.debug(
        { ...logBase, researchOutputTableRow: workingRow },
        'fromMaDMPDatasets - done processing dataset info'
      );
    }

    return newAnswer;
  }

  /**
   * Generate a new empty row for a research output table answer
   *
   * @param request the Fastify request
   * @param question the maDMP Research Output question
   * @returns a new Resource Output table answer row
   */
  private static initializeResearchOutputTableRow = (
    request: FastifyRequest,
    question: ResearchOutputTableQuestionType,
  ): ResearchOutputTableRowAnswerType => {
    const row: ResearchOutputTableRowAnswerType = ResearchOutputTableRowAnswerSchema.parse(DefaultResearchOutputTableRowAnswer);

    // Loop through each of the columns and generate a default answer column
    for (const column of question.columns) {
      const columnType = column.content.type ?? 'textArea';
      const answer = AnyResearchOutputTableColumnAnswerSchema.parse(AnswerDefaultMap[columnType]);
      row.columns.push(answer);
    }

    return row;
  }

  /**
   * Convert the specified column (referenced by commonStandardId) in the maDMP
   * dataset entry into a RersearchOutputTableColumnAnswerType
   *
   * @param row the Research Output table row
   * @param commonStandardId the identifier of the field in the maDMP
   * @param dataset the maDMP dataset record
   * @returns the dataset information as a research output column
   */
  private static researchOutputTableColumnFromMaDMPDataset = (
    row: ResearchOutputTableRowAnswerType,
    commonStandardId: string,
    dataset: DatasetType
  ): AnyResearchOutputTableColumnAnswerType => {
    // Find the column with the matching commonStandardId
    const column = row.columns.find((col: AnyResearchOutputTableColumnAnswerType): boolean => {
      return col.commonStandardId === commonStandardId;
    });

    if (column) {
      // Process Sensitive and Personal info data flags
      if (commonStandardId === 'data_flags') {
        const dataFlags: string[] = [];
        if (dataset.sensitive_data === 'yes') dataFlags.push('sensitive')
        if (dataset.personal_data === 'yes') dataFlags.push('personal')

        column.answer = dataFlags;
      }

      if (commonStandardId === 'host') {
        column.answer = dataset.distribution
          ?.filter((dist: DistributionType) => !!dist.host && !!dist.host.url)
          ?.map((dist: DistributionType) => ({
            repositoryId: dist.host.host_id?.identifier || dist.host.url,
            repositoryName: dist.host.title || '',
          }));
      }

      if (commonStandardId === 'metadata') {
        column.answer = dataset.metadata
          ?.filter((meta: MetadataType) => !!meta.metadata_standard_id?.identifier)
          ?.map((meta: MetadataType) => ({
            metadataStandardId: meta.metadata_standard_id.identifier,
            repositoryName: meta.description?.slice(0, 50) || '',
          }));
      }

      if (commonStandardId === 'license_ref') {
        const licenses = dataset.distribution?.flatMap((dist: DistributionType) => dist.license_ref || []);
        const now = new Date();
        const mostRecent = licenses
          ?.filter((lic: LicenseType) => !!lic.license_ref)
          ?.sort((licA: LicenseType, licB: LicenseType) => licB.start_date - licA.start_date) // sort descending
          ?.find((lic: LicenseType) => lic.start_date <= now);

        // The DMP Tool only allows one License, so use the one that is effective today
        column.answer = [{
          licenseId: mostRecent.license_ref || '',
          licenseName: ''
        }];
      }

      const distribution: DistributionType = dataset.distribution?.[0];
      switch (commonStandardId) {
        case 'title':
          column.answer = dataset.title?.trim() || dataset.description?.trim()?.slice(0, 15) || 'Default Dataset';
          break;
        case 'description':
          column.answer = dataset.description?.trim() || '';
          break;
        case 'type':
          column.answer = dataset.type?.trim()?.toLowerCase() || 'dataset';
          break;
        case 'data_access':
          switch (distribution?.data_access?.trim()?.toLowerCase()) {
            case 'open':
              column.answer = 'open';
              break;
            case 'shared':
              column.answer = 'restricted';
              break;
            default:
              column.answer = 'closed';
              break;
          }
          break;
        case 'issued':
          column.answer = convertMySQLDateTimeToRFC3339(distribution?.issued) || '';
          break;
        case 'byte_size':
          column.answer = {
            value: distribution?.byte_size?.toString() || '',
            context: 'bytes'
          }
          break;
        default:
          column.answer = dataset[commonStandardId]?.trim()?.trim() || '';
          break;
      }
    }

    return column as AnyResearchOutputTableColumnAnswerType;
  };

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

    return Array.isArray(resp.data?.answerByVersionedQuestionId)
      ? new Answer(resp.data.answerByVersionedQuestionId[0])
      : undefined;
  }
}
