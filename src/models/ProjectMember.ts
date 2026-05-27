import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { Project } from "./Project.js";
import { Affiliation } from "./Affiliation.js";
import { MemberRole, MemberRoles } from "./MemberRole.js";
import { Plan } from "./Plan.js";
import { ContributorsType, IdentifiersType } from "../types.js";
import { DMPToolDMPType } from "@dmptool/types";
import {
  AddProjectMemberDocument,
  ProjectMembersDocument,
  RemoveProjectMemberDocument,
  UpdateProjectMemberDocument,
} from "../generated/graphql.js";
import { areEqual } from "@dmptool/utils";

/**
 * The possible response for a Project Members/Contributors GraphQL query
 */
export interface ProjectMembersResponse {
  projectMembers: ProjectMember[]
}

/**
 * Representation of the GraphQL query response for adding a Project Member/Contributor
 */
export interface AddProjectMemberResponse {
  addProjectMember: ProjectMember
}

/**
 * Representation of the GraphQL query response for updating a Project Member/Contributor
 */
export interface UpdateProjectMemberResponse {
  updateProjectMember: ProjectMember
}

/**
 * Representation of the GraphQL query response for deleting a Project Member/Contributor
 */
export interface DeleteProjectMemberResponse {
  removeProjectMember: ProjectMember
}

/**
 * Represents a Project Member/Contributor
 */
export class ProjectMember extends BaseGraphQLModel {
  project?: Project;
  affiliation?: Affiliation;

  givenName?: string;
  surName?: string;
  orcid?: string;
  email?: string;
  isPrimaryContact?: boolean;
  memberRoles: MemberRole[];

  constructor(options: Partial<ProjectMember> = {}) {
    super(options);

    this.project = options.project;
    this.affiliation = options.affiliation;
    this.givenName = options.givenName;
    this.surName = options.surName;
    this.orcid = options.orcid;
    this.email = options.email;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoles = options.memberRoles ?? [];

    this.graphQLErrorsThatShouldBeWarnings = new Set<string>([
      'affiliationId', // If the affiliation couldn't be created, the member is still created
      'memberRoleIds'  // If a member role had an error, the default role was used
    ]);
  }

  /**
   * Shortcut helper function to save or update the current Project Member/Contributor
   *
   * @param request
   * @param project the Project
   * @param members the Project Members/Contributors
   * @returns true if successful. If not, any errors are added to the error object
   */
  static async save(
    request: FastifyRequest,
    project: Project,
    members: ProjectMember[]
  ): Promise<boolean> {
    if (!project || !project.id) return false;
    // If the member array is empty, this is an error (we must have a primary contact!)
    if (!members || members.length === 0) {
      project.errors['members'] = "maDMP must have a contact"
    }

    // Unlike PlanMembers, we don't delete project members via this API because
    // they are potentially shared/used across other plans

    // Loop through and save each member that was in the maDMP
    const errs: string[] = [];
    const warns: string[] = [];
    await Promise.all(members.map(async (member: ProjectMember): Promise<void> => {
      const success: boolean = member.id ? await member.update(request) : await member.create(request);

      // Capture any errors and warnings
      warns.push(member.warningsToString())
      if (!success) errs.push(member.errorsToString());

    }));
    if (errs.length > 0) project.errors['members'] = errs.join('; ');
    if (warns.length > 0) project.warnings['members'] = warns.join('; ');

    return !project.hasErrors();
  }

  /**
   * Create the current Project Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    // If the member's affiliation has an undefined id then it needs to saved first!
    if (this.affiliation && !this.affiliation.id) {
      const affiliationSaved: boolean = await this.affiliation.create(request);
      if (!affiliationSaved) {
        this.errors['affiliation'] = 'Failed to save affiliation';
      }
    }

    const saved: GQLResponse<AddProjectMemberResponse> = await ProjectMember.mutate<AddProjectMemberResponse>(
      request,
      {
        mutation: AddProjectMemberDocument,
        variables: {
          input: {
            projectId: this.project?.id,
            affiliationId: this.affiliation?.uri,
            givenName: this.givenName,
            surName: this.surName,
            orcid: this.orcid,
            email: this.email,
            memberRoleIds: this.memberRoles.map((r: MemberRole): number | undefined => r.id)
          }
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMember | undefined = saved?.data?.addProjectMember;
    this.processGQLResponse(saved, data as ProjectMember, 'create ProjectMember');
    return !this.hasErrors();
  }

  /**
   * Update the current Project Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async update(request: FastifyRequest): Promise<boolean> {
    // If the member's affiliation has an undefined id, then it needs to saved first!
    if (this.affiliation && !this.affiliation.id) {
      const affiliationSaved: boolean = await this.affiliation.create(request);
      if (!affiliationSaved) {
        this.errors['affiliation'] = 'Failed to save affiliation';
      }
    }

    // First update the Plan title
    const saved: GQLResponse<UpdateProjectMemberResponse> = await ProjectMember.mutate<UpdateProjectMemberResponse>(
      request,
      {
        mutation: UpdateProjectMemberDocument,
        variables: {
          input: {
            projectMemberId: this.id,
            affiliationId: this.affiliation?.uri,
            givenName: this.givenName,
            surName: this.surName,
            orcid: this.orcid,
            email: this.email,
            memberRoleIds: this.memberRoles.map((r: MemberRole): number | undefined => r.id)
          }
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMember | undefined = saved?.data?.updateProjectMember;
    this.processGQLResponse(saved, data as ProjectMember, 'create ProjectMember');
    return !this.hasErrors();
  }

  /**
   * Delete this Project Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async delete(request: FastifyRequest): Promise<boolean> {
    const deleted: GQLResponse<DeleteProjectMemberResponse> = await ProjectMember.mutate<DeleteProjectMemberResponse>(
      request,
      {
        mutation: RemoveProjectMemberDocument,
        variables: { projectMemberId: this.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMember | undefined = deleted?.data?.removeProjectMember;
    this.processGQLResponse(deleted, data as ProjectMember, 'create ProjectMember');
    return !this.hasErrors();
  }

  /**
   * Find and Initialize the Project and Plan members/contributors
   *
   * @param request the Fastify request
   * @param project the Project
   * @param plan the Plan
   * @param availableRoles the available member roles
   * @param dmp the MaDMP
   * @returns true if successful. If not, any errors are added to the Plan.members error
   */
  static async processMembers(
    request: FastifyRequest,
    project: Project,
    plan: Plan,
    availableRoles: MemberRoles,
    dmp: DMPToolDMPType['dmp']
  ): Promise<ProjectMember[]> {
    const currentMembers: ProjectMember[] = project.members ?? [];

    // Bail out if the maDMP has no contact defined (should never happen)
    if (!dmp.contact) {
      plan.errors.graphQL = 'maDMP must have a contact';
      return currentMembers;
    }

    let newMembers: (ProjectMember | undefined)[] = [];

    // Find or initialize all other contributors
    const contributors: ContributorsType = dmp.contributor ?? [];
    for (const contributor of contributors) {
      newMembers.push(
        await ProjectMember.findOrInitialize(
          request,
          availableRoles,
          project,
          currentMembers,
          contributor
        )
      );
    }
    // Remove any undefined items from the array
    newMembers = newMembers.filter(Boolean);

    // Find or initialize the primary contact
    const contact: ProjectMember | undefined = await ProjectMember.findOrInitialize(
      request,
      availableRoles,
      project,
      currentMembers,
      dmp.contact,
    );

    // Try to find a match for the contact in the existing list of project members
    const foundContact: ProjectMember | undefined = newMembers.find((member: ProjectMember | undefined): boolean => {
      if (!member) return false;

      // match on orcid or email or exact match of name
      return (!!member.orcid && member.orcid === contact?.orcid)
        || (!!member.email && member.email === contact?.email)
        || (
          !!member.givenName && !!member.surName
          && member.givenName === contact?.givenName
          && member.surName === contact?.surName
        )
    });

    if (foundContact) {
      // Make sure the matching contact is designated as the primary contact
      foundContact.isPrimaryContact = true;
      newMembers.splice(newMembers.indexOf(foundContact), 1, foundContact);
    } else if (contact) {
      // Add the contact to the list if they aren't already in it
      contact.isPrimaryContact = true;
      newMembers.push(contact);
    } else {
      // Otherwise just make the first contributor the primary contact
      const firstMember: ProjectMember | undefined = newMembers[0];
      if (firstMember) {
        firstMember.isPrimaryContact = true;
        newMembers.splice(0, 1, firstMember);
      }
    }

    // Check for errors
    const memberErrs: string = newMembers.map((member: ProjectMember | undefined) => {
      return member ? member.errorsToString() : null;
    }).filter(Boolean).join('; ');
    if (memberErrs) plan.errors['members'] = memberErrs;

    return plan.hasErrors()
      ? currentMembers
      : newMembers.filter(Boolean) as ProjectMember[];
  }

  /**
   * Find or create a new Project Member/Contributor from a MaDMP contributor or contact
   *
   * @param request the Fastify request
   * @param availableRoles the available member roles
   * @param project the Project
   * @param existingMembers the project members that already exist
   * @param memberFromMaDMP the contributor or contact from the MaDMP
   * @returns the ProjectMember
   */
  static async findOrInitialize(
    request: FastifyRequest,
    availableRoles: MemberRoles,
    project: Project,
    existingMembers: ProjectMember[],
    memberFromMaDMP: DMPToolDMPType['dmp']['contributor'][0] | DMPToolDMPType['dmp']['contact']
  ): Promise<ProjectMember | undefined> {
    if (!memberFromMaDMP) return undefined;

    // Get the contact/contributor id
    const identifiers: IdentifiersType | undefined = memberFromMaDMP.contributor_id ?? memberFromMaDMP.contact_id ?? [];
    const orcid: string | undefined = Array.isArray(identifiers) && identifiers.length > 0
      ? identifiers[0].type === 'orcid' ? identifiers[0].identifier?.trim() : undefined
      : undefined;

    // If this is a contact in the maDMP then they are the primary contact
    const isPrimaryContact = !!memberFromMaDMP.contact_id;
    // Prep the other properties
    const email: string | undefined = memberFromMaDMP.mbox?.trim();
    const nameParts: string[] = memberFromMaDMP.name ? memberFromMaDMP.name.split(' ')
      .filter(Boolean)
      ?.map((n: string): string => n.trim()) : [];

    // Convert the string Role URIs to MemberRoles
    const memberRoles: MemberRole[] = availableRoles.validateRoles(memberFromMaDMP.role);

    // If an affiliation was defined, try ti find it or initialize new one
    const affiliation: Affiliation | undefined = memberFromMaDMP.affiliation
    ? await Affiliation.findOrInitialize(
        request,
        Array.isArray(memberFromMaDMP.affiliation) ? memberFromMaDMP.affiliation[0] : memberFromMaDMP.affiliation,
        false
      )
    : undefined;

    const match: ProjectMember | undefined = existingMembers.find((p: ProjectMember): boolean => {
      const existingNameParts: (string | undefined)[] = [
        p.givenName?.toLowerCase().trim(),
        p.surName?.toLowerCase().trim()].filter(Boolean);

      // Check for orcid match
      return p.orcid?.toLowerCase()?.trim() === orcid
        // Check for email match
        || p.email?.toLowerCase()?.trim() === email
        // Check for name match
        || existingNameParts.join(' ') === nameParts.join(' ')
        // Check for reversed name order as well
        || existingNameParts.reverse().join(' ') === nameParts.join('')
    });

    const member = new ProjectMember({
      ...match,
      project,
      affiliation,
      memberRoles,
      isPrimaryContact,
      orcid: orcid ?? match?.orcid,
      email: email ?? match?.email,
      givenName: nameParts[0] ?? match?.givenName,
      surName: nameParts[1] ?? match?.surName,
    });

    // Check to see if any roles didn't match what was specified
    if (areEqual(member.memberRoles.map((mr: MemberRole) => mr.uri), memberFromMaDMP.role)) {
      member.errors['memberRoleIds'] = 'Some roles were not recognized so the default was used.';
    }
    return member;
  }

  /**
   * Find Project Members/Contributors by a Project id
   *
   * @param request the Fastify request
   * @param projectId the Project's id
   * @returns the Project Members/Contributors
   */
  static async findByProjectId(request: FastifyRequest, projectId: number): Promise<ProjectMember[] | []> {
    const resp: GQLResponse<ProjectMembersResponse> = await this.query<ProjectMembersResponse>(
      request,
      {
        query: ProjectMembersDocument,
        variables: { projectId },
        errorPolicy: "all"
      }
    );

    return Array.isArray(resp.data?.projectMembers)
      ? resp.data.projectMembers.map((p: ProjectMember): ProjectMember => new ProjectMember(p))
      : [];
  }
}
