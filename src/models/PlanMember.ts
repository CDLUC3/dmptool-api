import { BaseGraphQLModel, GQLResponse } from "./gqlHelper.js";
import { ProjectMemberInterface } from "./ProjectMember.js";
import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import {
  AddPlanMemberDocument,
  PlanMembersDocument,
  RemovePlanMemberDocument,
  UpdatePlanMemberDocument,
} from "../generated/graphql.js";
import { PlanInterface } from "./Plan.js";
import { MemberRoleInterface, MemberRoles } from "./MemberRole.js";

/**
 * Represents a Plan Member/Contributor
 */
export interface PlanMemberInterface {
  id: number;
  plan: PlanInterface;
  projectMember: ProjectMemberInterface;
  isPrimaryContact: boolean;
  memberRoles: MemberRoleInterface[];
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

/**
 * The possible response for a Plan Members/Contributors GraphQL query
 */
export interface PlanMembersResponse {
  planMembers: PlanMemberInterface[]
}

/**
 * Representation of the GraphQL query response for adding a Plan Member/Contributor
 */
export interface AddPlanMemberResponse {
  addPlanMember: PlanMemberInterface
}

/**
 * Representation of the GraphQL query response for updating a Plan Member/Contributor
 */
export interface UpdatePlanMemberResponse {
  updatePlanMember: PlanMemberInterface
}

/**
 * Representation of the GraphQL query response for deleting a Plan Member/Contributor
 */
export interface DeletePlanMemberResponse {
  removePlanMember: PlanMemberInterface
}

/**
 * Represents a Plan Member/Contributor
 */
export class PlanMember extends BaseGraphQLModel {
  plan?: PlanInterface;
  projectMember?: ProjectMemberInterface;

  isPrimaryContact?: boolean;
  memberRoles: MemberRoleInterface[];

  constructor(options: Partial<PlanMember> = {}) {
    super(options);

    this.plan = options.plan;
    this.projectMember = options.projectMember;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoles = options.memberRoles ?? [];
    this.errors = options.errors ?? {};
  }

  /**
   * Shortcut helper function to save or update the current Plan Member/Contributor
   *
   * @param request
   * @param availableMemberRoles the available Member/Contributor Roles
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async save(request: FastifyRequest, availableMemberRoles: MemberRoles): Promise<boolean> {
    return this.id
      ? await this.update(request, availableMemberRoles)
      : await this.create(request, availableMemberRoles);
  }

  /**
   * Create the current Plan Member/Contributor
   *
   * @param request the Fastify request
   * @param availableMemberRoles the available Member/Contributor Roles
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async create(request: FastifyRequest, availableMemberRoles: MemberRoles): Promise<boolean> {
    // Validate the roles (removing any that are not valid)
    let roles: MemberRoleInterface[] = availableMemberRoles.validateRoles(this.memberRoles);

    const saved: GQLResponse<AddPlanMemberResponse> = await PlanMember.mutate<AddPlanMemberResponse>(
      request,
      {
        mutation: AddPlanMemberDocument,
        variables: {
          planId: this.plan?.id,
          projectMemberId: this.projectMember?.id,
          memberRoleIds: roles.map((r: MemberRoleInterface): number => r.id)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMemberInterface | undefined = saved?.data?.addPlanMember;
    // Process any errors that may have occurred
    this.handleMutationErrors("create", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = PlanMember.hasErrors(data?.errors ?? {});
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
   * Update the current Plan Member/Contributor
   *
   * @param request the Fastify request
   * @param availableMemberRoles the available Member/Contributor Roles
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async update(request: FastifyRequest, availableMemberRoles: MemberRoles): Promise<boolean> {
    // Validate the roles (removing any that are not valid)
    let roles: MemberRoleInterface[] = availableMemberRoles.validateRoles(this.memberRoles);

    // First update the Plan title
    const saved: GQLResponse<UpdatePlanMemberResponse> = await PlanMember.mutate<UpdatePlanMemberResponse>(
      request,
      {
        mutation: UpdatePlanMemberDocument,
        variables: {
          planMemberId: this.id,
          isPrimaryContact: this.isPrimaryContact,
          memberRoleIds: roles.map((r: MemberRoleInterface): number => r.id)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMemberInterface | undefined = saved?.data?.updatePlanMember;
    // Process any errors that may have occurred
    this.handleMutationErrors("update", saved, data?.errors);

    // If data was returned and we have no errors
    let hadErrors: boolean = PlanMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
      this.errors = data.errors ?? {};
    }

    return !hadErrors;
  }

  /**
   * Delete this Plan Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async delete(request: FastifyRequest): Promise<boolean> {
    const deleted: GQLResponse<DeletePlanMemberResponse> = await PlanMember.mutate<DeletePlanMemberResponse>(
      request,
      {
        mutation: RemovePlanMemberDocument,
        variables: { planMemberId: this.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMemberInterface | undefined = deleted?.data?.removePlanMember;

    // Process any errors that may have occurred
    this.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = PlanMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Find Plan Members/Contributors by a Plan id
   *
   * @param request the Fastify request
   * @param projectId the Plan's id
   * @returns the Plan Members/Contributors
   */
  static async findByPlanId(request: FastifyRequest, planId: number): Promise<PlanMember[] | []> {
    const resp: GQLResponse<PlanMembersResponse> = await this.query<PlanMembersResponse>(
      request,
      {
        query: PlanMembersDocument,
        variables: { planId },
        errorPolicy: "all"
      }
    );

    return Array.isArray(resp.data?.planMembers)
      ? resp.data.planMembers.map((p: PlanMemberInterface): PlanMember => new PlanMember(p))
      : [];
  }
}
