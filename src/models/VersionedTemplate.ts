import { ZodSafeParseResult } from "zod";
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { FastifyRequest } from "fastify";
import {
  DefaultTemplateDocument,
  VersionedTemplatesDocument
} from "../generated/graphql.js";
import {
  AnyQuestionSchema,
  AnyQuestionType,
  QuestionDefaultMap,
  QuestionFormatsEnum,
  QuestionSchemaMap,
  TextAreaQuestionType
} from "@dmptool/types";
import { NarrativeQuestionType } from "../types.js";

/**
 * DMP Tool section tags that can be mapped to specific sections of the maDMP dataset.
 */
const QUALITY_ASSURANCE_TAG = 'data-collection';
const PRESERVATION_TAG = 'preservation';
const SECURITY_PRIVACY_TAGS = ['ethics-&-privacy', 'storage-security'];

/**
 * The shape of a VersionedQuestion within a GraphQL query response
 */
export interface VersionedQuestionQueryResponse {
  id: number;
  questionText: string;
  json: string;
}

/**
 * The shape of a VersionedSection within a GraphQL query response
 */
export interface VersionedSectionQueryResponse {
  id: number;
  name: string;
  displayOrder: number;
  versionedQuestions?: VersionedQuestionQueryResponse[];
}

/**
 * The shape of a VersionedTemplate within a GraphQL query response
 */
export interface VersionedTemplateQueryResponse {
  id: number;
  name: string;
  description?: string;
  version?: string;
  template: {
    id: number;
  }
  versionedSections?: VersionedSectionQueryResponse[];
}

/**
 * Representation of the GraphQL query results for versionedTemplates
 */
export interface VersionedTemplateResponse {
  versionedTemplate: VersionedTemplateQueryResponse;
}

export interface DefaultTemplateResponse {
  defaultTemplate?: VersionedTemplate;
}

/**
 * Representation of a Section tag
 */
export class Tag {
  id: number;
  slug: string;

  constructor(options: Partial<Tag> = {}) {
    this.id = options.id ?? 0;
    this.slug = options.slug ?? "";
  }
}

/**
 * Representation of a Question on a Versioned Template
 */
export class VersionedQuestion {
  id: number;
  questionId: number;
  versionedSectionId: number;
  questionText: string;
  displayOrder: number;
  json: string;
  validatedJSON: AnyQuestionType;

  constructor(options: Partial<VersionedQuestion> = {}) {
    this.id = options.id ?? 0;
    this.questionId = options.questionId ?? 0;
    this.versionedSectionId = options.versionedSectionId ?? 0;
    this.questionText = options.questionText ?? "";
    this.displayOrder = options.displayOrder ?? 0;

    // If the JSON is missing, use the default Text Area
    const defaultJSON = QuestionDefaultMap[QuestionFormatsEnum.enum.textArea] as TextAreaQuestionType;

    // Verify that the JSON is a valid Question otherwise use TextArea
    const parsedJSON = JSON.parse(options.json ?? JSON.stringify(defaultJSON));
    if (Object.keys(QuestionSchemaMap).includes(parsedJSON.type)) {
      const parseResult: ZodSafeParseResult<AnyQuestionType> = AnyQuestionSchema.safeParse(parsedJSON);
      this.validatedJSON = parseResult?.success ? parseResult.data : defaultJSON;
    } else {
      this.validatedJSON = defaultJSON;
    }

    this.json = JSON.stringify(this.validatedJSON);
  }
}

/**
 * Representation of a Section on a Versioned Template
 */
export class VersionedSection {
  id: number;
  sectionId: number;
  name: string;
  displayOrder: number;
  tags: Tag[];
  versionedQuestions: VersionedQuestion[];

  constructor(options: Partial<VersionedSection> = {}) {
    this.id = options.id ?? 0;
    this.sectionId = options.sectionId ?? 0;
    this.name = options.name ?? "";
    this.displayOrder = options.displayOrder ?? 0;

    this.tags = options.tags?.map((tag: Tag) => new Tag(tag)) ?? [];
    this.versionedQuestions = options.versionedQuestions?.map((q: VersionedQuestion) => {
      return new VersionedQuestion(q);
    }) ?? [];
  }

  // Remove all HTML markup, trim excess space, and convert to lower case for matching
  private cleanText(text: string): string {
    return text.toLowerCase()
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  // Locate the VersionedQuestion by its parent questionId
  findQuestionById(questionId: number): VersionedQuestion | undefined {
    return this.versionedQuestions.find((q: VersionedQuestion): boolean => q.id === questionId);
  }

  // Locate the VersionedQuestion by its text
  findQuestionByText(questionText: string): VersionedQuestion | undefined {
    return this.versionedQuestions.find((q: VersionedQuestion): boolean => {
      return this.cleanText(q.questionText) === this.cleanText(questionText);
    });
  }
}

/**
 * A VersionedTemplate
 */
export class VersionedTemplate extends BaseGraphQLModel {
  template?: {
    id?: number;
  };
  name?: string;
  description?: string;
  version?: string;

  versionedSections: VersionedSection[];

  constructor(options: Partial<VersionedTemplate> = {}) {
    super(options);

    this.template = options.template;
    this.name = options.name;
    this.description = options.description;
    this.version = options.version;

    this.versionedSections = options.versionedSections?.map((s: VersionedSection) => {
      return new VersionedSection(s);
    }) ?? [];
  }

  /**
   * Convert a versioned template from a GraphQL query response
   *
   * @param graphQLResponse the shape of the versionedTemplate within a GraphQL query response
   * @returns a new VersionedTemplate object
   */
  static fromGraphQL(graphQLResponse: VersionedTemplateQueryResponse): VersionedTemplate {
    if (!graphQLResponse.versionedSections) {
      throw new Error('No versionedSection found!');
    }

    const versionedSections: VersionedSection[] = graphQLResponse.versionedSections.map((section: VersionedSectionQueryResponse): VersionedSection => {
      const versionedQuestions: VersionedQuestion[] = section.versionedQuestions?.map((question: VersionedQuestionQueryResponse): VersionedQuestion => {
        return new VersionedQuestion({
          id: question.id,
          questionText: question.questionText,
          json: question.json,
          versionedSectionId: section.id,
        });
      }) ?? [];

      return new VersionedSection({
        id: section.id,
        name: section.name,
        displayOrder: section.displayOrder,
        versionedQuestions
      });
    });

    return new VersionedTemplate({
      id: graphQLResponse.id,
      template: {
        id: graphQLResponse.template.id
      },
      name: graphQLResponse.name,
      description: graphQLResponse.description,
      version: graphQLResponse.version,
      versionedSections
    });
  }

  // Locate the VersionedSection by its parent sectionId
  findSectionById(sectionId: number): VersionedSection | undefined {
    return this.versionedSections.find((s: VersionedSection): boolean => s.sectionId === sectionId);
  }

  // Locate the VersionedQuestion by the info in the Narrative question
  findNarrativeQuestion(narrativeQuestion: NarrativeQuestionType): VersionedQuestion | undefined {
    let question: VersionedQuestion | undefined;
    for (const section of this.versionedSections) {
      question = section.findQuestionById(narrativeQuestion.id);
      if (question) break;

      question = section.findQuestionByText(narrativeQuestion.text);
      if (question) break;
    }
    return question;
  }

  // Locate the VersionedQuestion it's id
  findQuestionById(questionId: number): VersionedQuestion | undefined {
    let question: VersionedQuestion | undefined;
    for (const section of this.versionedSections) {
      question = section.findQuestionById(questionId);
      if (question) break;
    }
    return question;
  }

  // TODO: We will be addiong tags to Questions in the future, so this will need to be
  //       updated to grab the correct one instead of just taking the first one in the section
  /**
   * Find the question that we can map the maDMP `data_quality_assurance` information to
   */
  getDataQualityAssuranceQuestion (): VersionedQuestion | undefined {
    const section: VersionedSection | undefined = this.versionedSections.find((s: VersionedSection): boolean => {
      return s.tags.some((t: Tag) => t.slug.toLowerCase() === QUALITY_ASSURANCE_TAG);
    });
    return section ? section.versionedQuestions[0] : undefined;
  }

  /**
   * Find the question that we can map the maDMP `preservation_statement` information to
   */
  getPreservationStatementQuestion (): VersionedQuestion | undefined {
    const section: VersionedSection | undefined = this.versionedSections.find((s: VersionedSection): boolean => {
      return s.tags.some((t: Tag) => t.slug.toLowerCase() === PRESERVATION_TAG);
    });
    return section ? section.versionedQuestions[0] : undefined;
  }

  /**
   * Find the question that we can map the maDMP `security_and_privacy` information to
   */
  getSecurityAndPrivacyQuestion (): VersionedQuestion | undefined {
    const section: VersionedSection | undefined = this.versionedSections.find((s: VersionedSection): boolean => {
      return s.tags.some((t: Tag) => SECURITY_PRIVACY_TAGS.includes(t.slug.toLowerCase()));
    });
    return section ? section.versionedQuestions[0] : undefined;
  }

  /**
   * Find the question that we can map the maDMP `dataset` information to
   */
  researchOutputTableQuestion (): VersionedQuestion | undefined {
    const questions: VersionedQuestion[] = this.versionedSections.flatMap(
      (s: VersionedSection) => s.versionedQuestions
    );
    return questions.find((q: VersionedQuestion): boolean => {
      const parsedJSON: AnyQuestionType = JSON.parse(q.json);
      return parsedJSON.type === QuestionFormatsEnum.enum.researchOutputTable;
    });
  }

  /**
   * Find the specified template. If none was specified, or it was not found,
   * return the default template.
   *
   * @param request the Fastify request
   * @param templateId the template id to find
   * @returns the VersionedTemplate
   */
  static async findOrDefault(request: FastifyRequest, templateId?: number): Promise<VersionedTemplate | undefined> {
    let template: VersionedTemplate | undefined;
    if (templateId) {
      template = await this.findByTemplateId(request, templateId);
      if (template) return template;
    }

    return await this.findDefault(request);
  }

  /**
   * Find a VersionedTemplate by a Template id
   *
   * @param request the Fastify request
   * @param id the Template's id
   * @returns the VersionedTemplate
   * @throws any errors from the GraphQL server (e.g. Unauthorized, Not Found, etc.)
   */
  static async findByTemplateId(request: FastifyRequest, id: number): Promise<VersionedTemplate | undefined> {
    const resp: GQLResponse<VersionedTemplateResponse> = await this.query<VersionedTemplateResponse>(
      request,
      {
        query: VersionedTemplatesDocument,
        variables: { templateId: id },
        errorPolicy: "all"
      }
    );
    return resp.data && resp.data.versionedTemplate ? VersionedTemplate.fromGraphQL(resp.data.versionedTemplate) : undefined;
  }

  /**
   * Find the default best practice template
   *
   * @param request the Fastify request
   * @returns the VersionedTemplate
   * @throws any errors from the GraphQL server (e.g. Unauthorized, Not Found, etc.)
   */
  static async findDefault(request: FastifyRequest): Promise<VersionedTemplate | undefined> {
    const resp: GQLResponse<DefaultTemplateResponse> = await this.query<DefaultTemplateResponse>(
      request,
      {
        query: DefaultTemplateDocument,
        errorPolicy: "all"
      },
    );
    return resp.data && resp.data.defaultTemplate ? resp.data.defaultTemplate : undefined;
  }
}
