import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { FastifyRequest } from "fastify";
import { MemberRolesDocument } from "../generated/graphql.js";

/**
 * The possible response for a Project Member/Contributor Roles GraphQL query
 */
export interface MemberRolesResponse {
  memberRoles: MemberRole[]
}

/**
 * Represents a collection of Project Member/Contributor Roles
 */
export class MemberRoles {
  roles: MemberRole[] = [];

  constructor(options: { roles: MemberRole[] }) {
    this.roles =  options.roles ?? [];
  }

  /**
   * Get the default role
   * @returns the default role
   */
  defaultRole(): MemberRole | undefined {
    return this.roles === undefined
      ? undefined
      : this.roles.find((r: MemberRole) => r.isDefault);
  }

  /**
   * Check if a role is valid (one of the available roles)
   *
   * @param roleURI
   */
  isValidRole(roleURI: string): boolean {
    if (roleURI && this.roles) {
      return this.roles.some(r => r.uri === roleURI);
    }
    return false;
  }

  /**
   * Validate an array of roles by their URIs, remove any that are not valid,
   * and return the remaining roles.
   *
   * @param roles the member roles to validate
   * @returns the remaining valid roles
   */
  validateRoles(roles: string[]): MemberRole[] {
    const defaultRole: MemberRole | undefined = this.defaultRole();

    // If there are no available roles, return the default role if it exists
    if (!this.roles || !roles) return defaultRole ? [defaultRole] : [];

    // Figure out which roles are valid and remove any that are not
    const validated: string[] = roles.filter((role: string) => {
      return this.isValidRole(role);
    });
    if (validated.length === 0) return defaultRole ? [defaultRole] : [];

    // Convert the validated role URIs to MemberRole objects
    const newRoles: (MemberRole | undefined)[] = validated.map((r: string): MemberRole | undefined => {
      return this.roles.find((mr: MemberRole): boolean => mr.uri === r)
    });

    return newRoles
      ? newRoles.filter((r: MemberRole | undefined): r is MemberRole => r !== undefined)
      : defaultRole ? [defaultRole] : [];
  }
}

/**
 * Represents a Project Member/Contributor Role on a Data Management Plan
 */
export class MemberRole extends BaseGraphQLModel {
  uri?: string;
  label?: string;
  description?: string;
  isDefault?: boolean;

  constructor(options: Partial<MemberRole> = {}) {
    super(options);

    this.uri = options.uri;
    this.label = options.label;
    this.description = options.description;
    this.isDefault = options.isDefault ?? false;
  }

  /**
   * Load all the Project Member/Contributor Roles
   *
   * @param request the Fastify request
   * @returns the Project Member/Contributor Roles
   */
  static async all(request: FastifyRequest): Promise<MemberRole[] | []> {
    const resp: GQLResponse<MemberRolesResponse> = await this.query<MemberRolesResponse>(
      request,
      {
        query: MemberRolesDocument,
        errorPolicy: "all"
      }
    );

    return Array.isArray(resp.data?.memberRoles)
      ? resp.data.memberRoles.map((r: MemberRole): MemberRole => new MemberRole(r))
      : [];
  }
}
