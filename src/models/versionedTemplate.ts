import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { FastifyRequest } from "fastify";
import {
  DefaultTemplateDocument,
  VersionedTemplatesDocument
} from "../generated/graphql.js";

/**
 * Representation of a published DMP Tool template
 */
export interface VersionedTemplateInterface {
  id?: number;
  template?: {
    id?: number;
  };
  name?: string;
  description?: string;
  version?: string;
  active?: boolean;
}

/**
 * Representation of the GraphQL query results for versionedTemplates
 */
export interface VersionedTemplatesResponse {
  versionedTemplates: VersionedTemplate[];
}

export interface DefaultTemplateResponse {
  defaultTemplate?: VersionedTemplate;
}

/**
 * A VersionedTemplate
 */
export class VersionedTemplate extends BaseGraphQLModel implements VersionedTemplateInterface {
  template?: {
    id?: number;
  };
  name?: string;
  description?: string;
  version?: string;
  active?: boolean;

  constructor(options: Partial<VersionedTemplate> = {}) {
    super(options);

    this.template = options.template;
    this.name = options.name;
    this.description = options.description;
    this.version = options.version;
    this.active = options.active ?? false;
  }

  /**
   * Find the specified template. If none was sepcified or it was not found,
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
    const resp: GQLResponse<VersionedTemplatesResponse> = await this.query<VersionedTemplatesResponse>(
      request,
      {
        query: VersionedTemplatesDocument,
        variables: { versionedTemplateId: id },
        errorPolicy: "all"
      }
    );
    return resp.data && Array.isArray(resp.data.versionedTemplates)
      ? resp.data.versionedTemplates.map(vt => new VersionedTemplate(vt))[0]
      : undefined;
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
