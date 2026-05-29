import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { FastifyRequest } from "fastify";
import {
  AddAffiliationDocument,
  AffiliationByUriDocument,
  AffiliationsDocument

} from "../generated/graphql.js";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { DMPToolDMPType } from "@dmptool/types";

/**
 * The possible response for an AffiliationsByURI GraphQL query
 */
export interface AffiliationByURIResponse {
  affiliationByURI: Affiliation
}

/**
 * The possible response for an Affiliations GraphQL query
 */
export interface AffiliationsResponse {
  affiliations: {
    items: Affiliation[]
  }
}

/**
 * The possible response for an Add Affiliation GraphQL mutation
 */
export interface AddAffiliationResponse {
  addAffiliation: Affiliation
}

type AffiliationType = DMPToolDMPType['dmp']['contact']['affiliation'];
type AffiliationIdType =AffiliationType['affiliation_id'][0];

/**
 * Represents an Affiliation on a Data Management Plan
 */
export class Affiliation extends BaseGraphQLModel {
  uri?: string;
  name?: string;
  aliases?: string[];
  acronyms?: string[];
  funder?: boolean;
  provenance?: string;

  constructor(options: Partial<Affiliation> = {}) {
    super(options);

    this.uri = options.uri;
    this.name = options.name;
    this.aliases = options.aliases;
    this.acronyms = options.acronyms;
    this.funder = options.funder ?? false;
    this.provenance = options.provenance;
  }

  /**
   * Normalize ROR identifiers
   *
   * @param identifier the identifier to normalize
   * @returns the normalized identifier
   */
  static normalizeRORId(identifier?: string): string | undefined {
    if (!identifier) return undefined;

    if (identifier.includes('ror.org')) return identifier;
    return identifier.startsWith('http') ? identifier : `https://ror.org/${identifier}`;
  };

  /**
   * Create the current Affiliation
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<AddAffiliationResponse> = await Affiliation.mutate<AddAffiliationResponse>(
      request,
      {
        mutation: AddAffiliationDocument,
        variables: {
          input: {
            name: this.name,
            funder: this.funder ?? false,
            active: true
          }
        },
        errorPolicy: "all"
      } as MutateOptions
    );

    const data: Affiliation | undefined = saved?.data?.addAffiliation;
    this.processGQLResponse(saved, data as Affiliation, 'create Affiliation');
    return !this.hasErrors();
  }

  /**
   * Find or initialize an Affiliation by the maDMP affiliation object
   *
   * @param request the Fastify request
   * @param affiliation the maDMP affiliation object
   * @param isFunder true if the affiliation is a funder
   * @returns the Affiliation
   */
  static async findOrInitialize(
    request: FastifyRequest,
    affiliation: AffiliationType,
    isFunder = false
  ): Promise<Affiliation> {
    let existing: Affiliation | undefined;
    let fullRorId: string | undefined;

    // Extract the ROR ID from the affiliation object
    const rorId: string | undefined = affiliation.affiliationId?.find((id: AffiliationIdType): boolean => {
      return id?.type?.toLowerCase()?.trim() === 'ror'
        || id.identifier?.includes('ror.org');
    })?.identifier;

    if (rorId) {
      // If a ROR was found, attempt to find the affiliation by the ROR ID
      fullRorId = Affiliation.normalizeRORId(rorId)
      existing = fullRorId ? await Affiliation.findByURI(request, fullRorId) : undefined;
    }

    // Otherwise, attempt to find the affiliation by the name
    if (!existing && affiliation.name) {
      const affiliations: Affiliation[] = await Affiliation.findByName(request, affiliation.name);
      if (affiliations.length > 0) {
        existing = affiliations.find((a: Affiliation): boolean => {
          return a.name?.toLowerCase()?.trim() === affiliation.name?.toLowerCase()?.trim();
        });
      }
    }
    if (existing) return existing;

    const newURI: string = affiliation.affiliation_id?.identifier?.startsWith('http')
      ? affiliation.affiliation_id.identifier
      : undefined;

    // Otherwise return a new Affiliation
    return new Affiliation({
      name: affiliation.name,
      // Use the ROR id if it was present, otherwise use the identifier only if it looks like a URL
      uri: fullRorId ?? newURI,
      funder: isFunder,
    });
  }

  /**
   * Find an Affiliation by a URI
   *
   * @param request the Fastify request
   * @param uri the URI to search for
   * @returns the Affiliation
   */
  static async findByURI(request: FastifyRequest, uri: string): Promise<Affiliation | undefined> {
    const resp: GQLResponse<AffiliationByURIResponse> = await this.query<AffiliationByURIResponse>(
      request,
      {
        query: AffiliationByUriDocument,
        variables: { uri },
        errorPolicy: "all"
      }
    );
    return resp.data && resp.data.affiliationByURI
      ? new Affiliation(resp.data.affiliationByURI)
      : undefined;
  }

  /**
   * Find Affiliations by name
   *
   * @param request the Fastify request
   * @param name the URI to search for
   * @returns the Affiliation
   */
  static async findByName(request: FastifyRequest, name: string, funderOnly = false): Promise<Affiliation[] | []> {
    const resp: GQLResponse<AffiliationsResponse> = await this.query<AffiliationsResponse>(
      request,
      {
        query: AffiliationsDocument,
        variables: { name, funderOnly },
        errorPolicy: "all"
      }
    );
    return resp.data && resp.data.affiliations && resp.data.affiliations.items
      ? resp.data.affiliations.items.map((a: Affiliation): Affiliation => new Affiliation(a))
      : [];
  }
}
