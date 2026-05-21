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

/**
 * Represents a Project Member/Contributor
 */
export interface ProjectMemberInterface {
  id: number;
  project: Project;
  affiliation: Affiliation;
  givenName: string;
  surName: string;
  orcid: string;
  email: string;
  isPrimaryContact: boolean;
  memberRoles: MemberRole[];
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

/**
 * The possible response for a Project Members/Contributors GraphQL query
 */
export interface ProjectMembersResponse {
  projectMembers: ProjectMemberInterface[]
}

/**
 * Representation of the GraphQL query response for adding a Project Member/Contributor
 */
export interface AddProjectMemberResponse {
  addProjectMember: ProjectMemberInterface
}

/**
 * Representation of the GraphQL query response for updating a Project Member/Contributor
 */
export interface UpdateProjectMemberResponse {
  updateProjectMember: ProjectMemberInterface
}

/**
 * Representation of the GraphQL query response for deleting a Project Member/Contributor
 */
export interface DeleteProjectMemberResponse {
  removeProjectMember: ProjectMemberInterface
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

  constructor(options: Partial<ProjectMemberInterface> = {}) {
    super(options);

    this.project = options.project;
    this.affiliation = options.affiliation;
    this.givenName = options.givenName;
    this.surName = options.surName;
    this.orcid = options.orcid;
    this.email = options.email;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoles = options.memberRoles ?? [];
    this.errors = options.errors ?? {};
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
    await Promise.all(members.map(async (member: ProjectMember): Promise<void> => {
      const success: boolean = member.id
        ? await ProjectMember.update(request, member)
        : await ProjectMember.create(request, member);

      if (!success) errs.push(ProjectMember.errorsToString(member.errors));
    }));
    if (errs.length > 0) project.errors['members'] = errs.join('; ');

    return !Project.hasErrors(project.errors);
  }

  /**
   * Create the current Project Member/Contributor
   *
   * @param request the Fastify request
   * @param member the Project Member/Contributor
   * @returns true if successful. If not, any errors are added to the error object
   */
  static async create(request: FastifyRequest, member: ProjectMember): Promise<boolean> {
    // If the member's affiliation has an undefined id then it needs to saved first!
    if (member.affiliation && !member.affiliation.id) {
      const affiliationSaved: boolean = await member.affiliation.create(request);
      if (!affiliationSaved) {
        member.errors['affiliation'] = 'Failed to save affiliation';
      }
    }

    const saved: GQLResponse<AddProjectMemberResponse> = await ProjectMember.mutate<AddProjectMemberResponse>(
      request,
      {
        mutation: AddProjectMemberDocument,
        variables: {
          input: {
            projectId: member.project?.id,
            affiliationId: member.affiliation?.uri,
            givenName: member.givenName,
            surName: member.surName,
            orcid: member.orcid,
            email: member.email,
            memberRoleIds: member.memberRoles.map((r: MemberRole): number | undefined => r.id)
          }
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMemberInterface | undefined = saved?.data?.addProjectMember;
    // Process any errors that may have occurred
    member.handleMutationErrors("create", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = ProjectMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      member.id = data.id;
      member.created = data.created;
      member.createdById = data.createdById;
      member.modified = data.modified;
      member.modifiedById = data.modifiedById;
    }
    return !hadErrors;
  }

  /**
   * Update the current Project Member/Contributor
   *
   * @param request the Fastify request
   * @param member the Project Member/Contributor
   * @returns true if successful. If not, any errors are added to the error object
   */
  static async update(request: FastifyRequest, member: ProjectMember): Promise<boolean> {
    // If the member's affiliation has an undefined id then it needs to saved first!
    if (member.affiliation && !member.affiliation.id) {
      const affiliationSaved: boolean = await member.affiliation.create(request);
      if (!affiliationSaved) {
        member.errors['affiliation'] = 'Failed to save affiliation';
      }
    }

    // First update the Plan title
    const saved: GQLResponse<UpdateProjectMemberResponse> = await ProjectMember.mutate<UpdateProjectMemberResponse>(
      request,
      {
        mutation: UpdateProjectMemberDocument,
        variables: {
          input: {
            projectMemberId: member.id,
            affiliationId: member.affiliation?.uri,
            givenName: member.givenName,
            surName: member.surName,
            orcid: member.orcid,
            email: member.email,
            memberRoleIds: member.memberRoles.map((r: MemberRole): number | undefined => r.id)
          }
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMemberInterface | undefined = saved?.data?.updateProjectMember;
    // Process any errors that may have occurred
    member.handleMutationErrors("update", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = ProjectMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      member.modified = data.modified;
      member.modifiedById = data.modifiedById;
      member.errors = data.errors ?? {};
    }
    return !hadErrors;
  }

  /**
   * Delete this Project Member/Contributor
   *
   * @param request the Fastify request
   * @param member the Project member/contributor to delete
   * @returns true if successful. If not, any errors are added to the error object
   */
  static async delete(request: FastifyRequest, member: ProjectMember): Promise<boolean> {
    const deleted: GQLResponse<DeleteProjectMemberResponse> = await ProjectMember.mutate<DeleteProjectMemberResponse>(
      request,
      {
        mutation: RemoveProjectMemberDocument,
        variables: { projectMemberId: member.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMemberInterface | undefined = deleted?.data?.removeProjectMember;

    // Process any errors that may have occurred
    member.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = ProjectMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      member.modified = data.modified;
      member.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Save the Project and Plan members/contributors
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
      return ProjectMember.errorsToString(member?.errors ?? {});
    }).filter(Boolean).join('; ');
    if (memberErrs) plan.errors['members'] = memberErrs;

    return Plan.hasErrors(plan.errors)
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

    return new ProjectMember({
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
      ? resp.data.projectMembers.map((p: ProjectMemberInterface): ProjectMember => new ProjectMember(p))
      : [];
  }
}
