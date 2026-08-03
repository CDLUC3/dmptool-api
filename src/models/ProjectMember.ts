import { DMPToolDMPType } from "@dmptool/types";
import { EntirePlanMemberFragment } from "../generated/graphql.js";
import {
  AffiliationType,
  ContactType,
  ContributorsType,
  ContributorType,
  IdentifierType
} from "../types.js";
import { BaseGraphQLModel } from "./BaseGQL.js";
import { isValidEmail } from "../utils.js";

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

    // Find the affiliations
    const affiliations: AffiliationType[] = maDMPMember.affiliation || [];
    const affiliationId: string | undefined = affiliations.length > 0
      ? affiliations[0]?.affiliation_id?.identifier?.trim()
      : undefined;

    // Use the ORCIDs and emails if any were provided
    const identifiers: IdentifierType[] = maDMPMember.contributor_id || maDMPMember.contact_id || [];
    const orcids: IdentifierType[] = identifiers?.filter((id: IdentifierType): boolean => {
      return id.type === 'orcid';
    }) || [];
    const emails: IdentifierType[] = identifiers?.filter((id: IdentifierType): boolean => {
      return id.type === 'other' && isValidEmail(id.identifier || '');
    }) || [];

    // If any ORCIDs were provided, use the first one
    const orcid: string | undefined = orcids.length > 0 ? orcids[0]?.identifier : undefined;
    // If a mbox was provided use it otherwise use the first email from the identifiers
    const email: string | undefined = maDMPMember.mbox || (emails.length > 0 ? emails[0]?.identifier : undefined);


    // If the current project is present, we are replacing it, so always return
    // a new object.
    return new ProjectMember({
      id: current?.id,
      affiliationId: affiliationId,
      givenName: given,
      surName: family,
      orcid,
      email,
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
    const newMembers: ProjectMember[] = [];

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
    const contactIn: ProjectMember | undefined = this.maDMPMemberToProjectMember(maDMP.contact, undefined);

    if (!contactIn) {
      // This should NEVER happen since contact is a required property of a maDMP!
      throw new Error('No contact found on maDMP!');

    } else {
      // See if the contact was already in the list of contributors (don't match on undefined!)
      const existingContact: ProjectMember | undefined = newMembers.find((member: ProjectMember): boolean => {
        const memberIdMatch: boolean = !!member.id && !!contactIn.id && member.id === contactIn.id;
        const emailMatch: boolean = !!member.email && !!contactIn.email
          && member.email.toLowerCase().trim() === contactIn.email.toLowerCase()?.trim();
        const orcidMatch: boolean = !!member.orcid && !!contactIn.orcid
          && member.orcid.toLowerCase().trim() === contactIn.orcid.toLowerCase().trim();
        const namesMatch: boolean = !!member.surName && !!contactIn.surName
          && member.givenName?.toLowerCase()?.trim() === contactIn.givenName?.toLowerCase()?.trim()
          && member.surName.toLowerCase().trim() === contactIn.surName.toLowerCase().trim();

        return memberIdMatch || emailMatch || orcidMatch || namesMatch;
      });

      // If the existing contact was found, reconcile the info between the contact and contributor properties
      if (existingContact) {
        existingContact.email = existingContact.email || contactIn.email;
        existingContact.orcid = existingContact.orcid || contactIn.orcid;
        existingContact.affiliationId = existingContact.affiliationId || contactIn.affiliationId;
        existingContact.givenName = existingContact.givenName || contactIn.givenName;
        existingContact.surName = existingContact.surName || contactIn.surName;
        existingContact.isPrimaryContact = true;
      } else {
        contactIn.isPrimaryContact = true;
        newMembers.push(contactIn);
      }
    }

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
