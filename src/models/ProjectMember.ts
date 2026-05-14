import { BaseGraphQLModel, GQLResponse } from "./gqlHelper.js";
import { ProjectInterface } from "./Project.js";
import { Affiliation } from "./Affiliation.js";
import { MemberRoleInterface, MemberRoles } from "./MemberRole.js";
import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import { DMPToolDMPType } from "@dmptool/types";
import MutateOptions = ApolloClient.MutateOptions;
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
  project: ProjectInterface;
  affiliation: Affiliation;
  givenName: string;
  surName: string;
  orcid: string;
  email: string;
  isPrimaryContact: boolean;
  memberRoles: MemberRoleInterface[];
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
  project?: ProjectInterface;
  affiliation?: Affiliation;

  givenName?: string;
  surName?: string;
  orcid?: string;
  email?: string;
  isPrimaryContact?: boolean;
  memberRoles: MemberRoleInterface[];

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
   * @param availableMemberRoles the available Member Roles
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async save(request: FastifyRequest, availableMemberRoles: MemberRoles): Promise<boolean> {
    return this.id
      ? await this.update(request, availableMemberRoles)
      : await this.create(request, availableMemberRoles);
  }

  /**
   * Create the current Project Member/Contributor
   *
   * @param request the Fastify request
   * @param availableMemberRoles the available Member Roles
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async create(request: FastifyRequest, availableMemberRoles: MemberRoles): Promise<boolean> {
    // Validate the roles (removing any that are not valid)
    let roles: MemberRoleInterface[] = availableMemberRoles.validateRoles(this.memberRoles);

    const saved: GQLResponse<AddProjectMemberResponse> = await ProjectMember.mutate<AddProjectMemberResponse>(
      request,
      {
        mutation: AddProjectMemberDocument,
        variables: {
          projectId: this.project?.id,
          affiliationId: this.affiliation?.id,
          givenName: this.givenName,
          surName: this.surName,
          orcid: this.orcid,
          email: this.email,
          memberRoleIds: roles.map((r: MemberRoleInterface): number => r.id)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMemberInterface | undefined = saved?.data?.addProjectMember;
    // Process any errors that may have occurred
    this.handleMutationErrors("create", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = ProjectMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.id = data.id;
      this.created = data.created;
      this.createdById = data.createdById;
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Update the current Project Member/Contributor
   *
   * @param request the Fastify request
   * @param availableMemberRoles the available Member Roles
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async update(request: FastifyRequest, availableMemberRoles: MemberRoles): Promise<boolean> {
    // Validate the roles (removing any that are not valid)
    let roles: MemberRoleInterface[] = availableMemberRoles.validateRoles(this.memberRoles);

    // First update the Plan title
    const saved: GQLResponse<UpdateProjectMemberResponse> = await ProjectMember.mutate<UpdateProjectMemberResponse>(
      request,
      {
        mutation: UpdateProjectMemberDocument,
        variables: {
          projectMemberId: this.id,
          affiliationId: this.affiliation?.id,
          givenName: this.givenName,
          surName: this.surName,
          orcid: this.orcid,
          email: this.email,
          memberRoleIds: roles.map((r: MemberRoleInterface): number => r.id)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectMemberInterface | undefined = saved?.data?.updateProjectMember;
    // Process any errors that may have occurred
    this.handleMutationErrors("update", saved, data?.errors);

    // If data was returned and we have no errors
    let hadErrors: boolean = ProjectMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
      this.errors = data.errors ?? {};
    }

    return !hadErrors;
  }

  /**
   * Delete this Project Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
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
    const data: ProjectMemberInterface | undefined = deleted?.data?.removeProjectMember;

    // Process any errors that may have occurred
    this.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = ProjectMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Find or create a new Project Member/Contributor from a MaDMP contributor or contact
   *
   * @param request the Fastify request
   * @param existingMembers the project members that already exist
   * @param memberFromMaDMP the contributor or contact from the MaDMP
   * @returns the ProjectMember
   */
  static async findOrInitialize(
    request: FastifyRequest,
    existingMembers: ProjectMember[],
    memberFromMaDMP: DMPToolDMPType['dmp']['contributor'][0] | DMPToolDMPType['dmp']['contact']
  ): Promise<ProjectMember | undefined> {
    if (!memberFromMaDMP) return undefined;

    // Get the contact/contributor id
    const orcid: string | undefined = !!memberFromMaDMP.contributor_id
        ? memberFromMaDMP.contributor_id.type === 'orcid' ? memberFromMaDMP.contributor_id.identifier?.trim() : undefined
        : memberFromMaDMP.contact_id?.type === 'orcid' ? memberFromMaDMP.contact_id.identifier?.trim() : undefined;

    // If this is a contact in the maDMP then they are the primary contact
    const isPrimaryContact: boolean = !!memberFromMaDMP.contact_id;
    // Prep the other properties
    const email: string | undefined = memberFromMaDMP.mbox?.trim();
    const nameParts: string[] = memberFromMaDMP.name ? memberFromMaDMP.name.split(' ')
      .filter(Boolean)
      ?.map((n: string): string => n.trim()) : [];

    const affiliation: Affiliation | undefined = await Affiliation.findOrCreate(
      request,
      memberFromMaDMP.affiliation,
      false
    );

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
      affiliation,
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
