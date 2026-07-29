import { DMPToolDMPType } from "@dmptool/types";
import { EntirePlanMemberFragment } from "../generated/graphql.js";
import { ContactType, ContributorsType, ContributorType } from "../types.js";
import { BaseGraphQLModel } from "./BaseGQL.js";

/**
 * The shape of a project member within a GraphQL query response
 */
export interface ProjectMemberQueryResponse {
  id?: number;
  isPrimaryContact?: boolean;
  affiliation?: {
    uri?: string;
  }
  givenName?: string;
  surName?: string;
  orcid?: string;
  email?: string;
  memberRoles?: {
    id?: number;
    uri?: string;
  }[];
}

/**
 * The shape of a member role within a GraphQL query response
 */
export interface MemberRoleQueryResponse {
  id?: number;
  uri?: string;
}

/**
 * Represents a Project Member/Contributor
 */
export class ProjectMember extends BaseGraphQLModel {
  projectId?: number;
  affiliationId?: string;
  givenName?: string;
  surName?: string;
  orcid?: string;
  email?: string;
  isPrimaryContact?: boolean;
  memberRoleURIs: string[];

  constructor(options: Partial<ProjectMember> = {}) {
    super(options);

    this.projectId = options.projectId;
    this.affiliationId = options.affiliationId;
    this.givenName = options.givenName;
    this.surName = options.surName;
    this.orcid = options.orcid;
    this.email = options.email;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoleURIs = options.memberRoleURIs ?? [];

    this.graphQLErrorsThatShouldBeWarnings = new Set<string>([
      'affiliationId', // If the affiliation couldn't be created, the member is still created
      'memberRoleIds'  // If a member role had an error, the default role was used
    ]);
  }

  /**
   * Returns the possible variations of the givenName and surName for matching
   * up to names in a maDMP record
   */
  names(): string[] {
    const given: string | undefined = this.givenName?.toLowerCase()?.trim();
    const family: string | undefined = this.surName?.toLowerCase()?.trim();

    return [
      [given, family].filter((n: string | undefined): n is string => !!n).join(' '),
      [family, given].filter((n: string | undefined): n is string => !!n).join(' '),
    ]
  }

  /**
   * Determine if the maDMP Contributor or Contact matches the specified ProjectMember
   *
   * @param maDMPMember maDMP Contributor or Contact
   * @param currentMember the ProjectMember
   * @returns true if the ids, orcid, emails or names match
   */
  static maDMPMemberIsAMatch(
    maDMPMember: ContributorType | ContactType,
    currentMember: ProjectMember
  ): boolean {
    return currentMember.email?.toLowerCase()?.trim() === maDMPMember.email?.toLowerCase()?.trim()
      || currentMember.orcid?.toLowerCase()?.trim() === maDMPMember.email.toLowerCase().trim()
      || [currentMember.names()].includes(maDMPMember.name()?.replace(', ', '')?.toLowerCase()?.trim());
  }

  /**
   * Convert an incoming maDMP contributor or contact into a ProjectMember
   *
   * @param maDMPMember the incoming maDMP Contributor or Contact
   * @param current the current ProjectMember record
   * @returns the ProjectMember
   */
  static maDMPMemberToProjectMember(
    maDMPMember: ContributorType | ContactType,
    current?: ProjectMember
  ): ProjectMember {
    // Break the full name into its parts
    const nameParts: string[] = maDMPMember.name?.split(' ') || [];
    const given: string | undefined = nameParts.length > 0 ? nameParts[0] : undefined;
    const family: string | undefined = nameParts.length > 1
      ? nameParts.slice(1).join(' ')
      : nameParts[0] || undefined;

    // Use the ORCID if one was provided
    let orcid: string | undefined = maDMPMember.contributor_id && maDMPMember.contributor_id.type === 'orcid'
      ? maDMPMember.contributor_id.identifier || undefined
      : undefined;
    if (!orcid && maDMPMember.contact_id && maDMPMember.contact_id.type === 'orcid') {
      orcid = maDMPMember.contact_id.identifier || undefined;
    }

    // If the current project is present, we are replacing it, so always return
    // a new object.
    return new ProjectMember({
      id: current?.id,
      givenName: given,
      surName: family,
      orcid: orcid,
      email: maDMPMember.mbox,
      memberRoleURIs: maDMPMember.roles || []
    });
  }

  /**
   * Convert a maDMP ProjectMember entry
   *
   * @param maDMP the maDMP record
   * @param currentMembers the current list of ProjectMember objects
   * @returns an array of ProjectMember objects
   */
  static reconcileFromMaDMP(
    maDMP: DMPToolDMPType['dmp'],
    currentMembers: ProjectMember[] = []
  ): ProjectMember[] {
    const newMembers: (ProjectMember | undefined)[] = [];

    // This should never ever happen since the contact is a required maDMP property
    // but to make TypeScript happy we perform a check
    if (!maDMP.contact) {
      throw new Error('No contact found on maDMP!');
    }

    // Find or initialize all other contributors
    const contributors: ContributorsType = maDMP.contributor ?? [];
    for (const contributor of contributors) {
      const current: ProjectMember | undefined = currentMembers.find((member: ProjectMember): boolean => {
        return this.maDMPMemberIsAMatch(contributor, member);
      });

      // If the current project is present, we are replacing it, so always return
      // a new object.
      newMembers.push(this.maDMPMemberToProjectMember(contributor, current));
    }

    // Find or initialize the primary contact
    const currentContact: ProjectMember | undefined = currentMembers.find((member: ProjectMember): boolean => {
      return this.maDMPMemberIsAMatch(maDMP.contact, member);
    });
    const newContact: ProjectMember = currentContact || this.maDMPMemberToProjectMember(maDMP.contact, undefined);
    newContact.isPrimaryContact = true;
    newMembers.push(newContact);

    return newMembers.filter((m): m is ProjectMember => Boolean(m));
  }
  /**
   * Response the shape of the project member within a GraphQL query response
   * @returns a new ProjectMember object
   */
  static fromGraphQL(graphQLResponse: ProjectMemberQueryResponse): ProjectMember {
    const memberRoleURIs: string[] = graphQLResponse.memberRoles
      ?.map((r: MemberRoleQueryResponse): string | undefined => r.uri)
      ?.filter((uri): uri is string => Boolean(uri)) ?? [];

    return new ProjectMember({
      id: graphQLResponse.id,
      isPrimaryContact: graphQLResponse.isPrimaryContact,
      affiliationId: graphQLResponse.affiliation?.uri,
      givenName: graphQLResponse.givenName,
      surName: graphQLResponse.surName,
      orcid: graphQLResponse.orcid,
      email: graphQLResponse.email,
      memberRoleURIs
    });
  }

  /**
   * Convert the ProjectMember object into the expected GraphQL input
   *
   * @returns the answer's info as an EntirePlanMemberFragment for GraphQL
   */
  toGraphQLInput(): EntirePlanMemberFragment {
    return {
      projectMemberId: this.id,
      affiliation: this.affiliationId,
      givenName: this.givenName,
      surname: this.surName,
      orcid: this.orcid,
      email: this.email,
      isPrimaryContact: this.isPrimaryContact,
      memberRoles: this.memberRoleURIs
    };
  }
}
