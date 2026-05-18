import { BaseGraphQLModel, GQLResponse } from "./gqlHelper.js";
import { FastifyRequest } from "fastify";
import {
  ResearchDomainByUriDocument
} from "../generated/graphql.js";

/**
 * Represents a Research Domain
 */
export interface ResearchDomainInterface {
  id: number;
  uri: string;
  name: string;
}

/**
 * The possible response for a ResearchDomainByURI GraphQL query
 */
export interface ResearchDomainByURIResponse {
  researchDomainByURI: ResearchDomainInterface
}

/**
 * Represents a Research Domain on a Data Management Plan
 */
export class ResearchDomain extends BaseGraphQLModel {
  uri?: string;
  name?: string;

  constructor(options: Partial<ResearchDomainInterface> = {}) {
    super(options);

    this.uri = options.uri;
    this.name = options.name;
  }

  /**
   * Find a Research Domain by a URI
   *
   * @param request the Fastify request
   * @param uri the URI to search for
   * @returns the Affiliation
   */
  static async findByURI(request: FastifyRequest, uri: string): Promise<ResearchDomain | undefined> {
    const resp: GQLResponse<ResearchDomainByURIResponse> = await this.query<ResearchDomainByURIResponse>(
      request,
      {
        query: ResearchDomainByUriDocument,
        variables: { uri },
        errorPolicy: "all"
      }
    );
    return resp.data && resp.data.researchDomainByURI
      ? new ResearchDomain(resp.data.researchDomainByURI)
      : undefined;
  }
}
