import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./gqlHelper.js";
import { ProjectMember } from "./ProjectMember.js";
import { Plan } from "./Plan.js";
import { MemberRole } from "./MemberRole.js";
import {
  AddPlanMemberDocument,
  PlanMembersDocument,
  RemovePlanMemberDocument,
  UpdatePlanMemberDocument,
} from "../generated/graphql.js";

/**
 * Represents a Plan Member/Contributor
 */
export interface PlanMemberInterface {
  id: number;
  plan: Plan;
  projectMember: ProjectMember;
  isPrimaryContact: boolean;
  memberRoles: MemberRole[];
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
  plan?: Plan;
  projectMember?: ProjectMember;

  isPrimaryContact: boolean;
  memberRoles: MemberRole[];

  constructor(options: Partial<PlanMember> = {}) {
    super(options);

    this.plan = options.plan;
    this.projectMember = options.projectMember;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoles = options.memberRoles ?? [];
    this.errors = options.errors ?? {};
  }

  /**
   * Save the Project Members/Contributors
   *
   * @param request
   * @param plan the Plan
   * @param members the Plan Members/Contributors
   * @returns true if successful. If not, any errors are added to the error object
   */
  static async save(
    request: FastifyRequest,
    plan: Plan,
    members: PlanMember[]
  ): Promise<boolean> {
    if (!plan || !plan.id) return false;
    // If the members are empty this is an error (we must have a primary contact!)
    if (!members || members.length === 0) {
      plan.errors['members'] = "maDMP must have at least one contact"
    }
    const memberIds: number[] = members.map((m: PlanMember): number => m.id!)
      .filter(Boolean) as number[];

    // Fetch the existing members associated with the Plan
    const existing: PlanMember[] = await PlanMember.findByPlanId(request, plan.id);
    // Compare them to the list of new members and see if there are any that should
    // be deleted
    const deleteErrs: string[] = [];
    const toDelete: PlanMember[] = existing.filter((m: PlanMember): boolean => {
      return !memberIds.includes(m.id!);
    });
    if (toDelete.length > 0) {
      // Delete each one
      await Promise.all(toDelete.map(async (member: PlanMember): Promise<void> => {
        const deleted: boolean = await PlanMember.delete(request, member);
        if (!deleted) deleteErrs.push(PlanMember.errorsToString(member.errors));
      }));
    }
    // Log any deletion errors and then continue with the creates/updates to hopefully
    // ensure that we set the primary contact one
    if (deleteErrs.length > 0) plan.errors['members'] = deleteErrs.join('; ');

    // Loop through and save each member that was in the maDMP
    const errs: string[] = [];
    await Promise.all(members.map(async (member: PlanMember): Promise<void> => {
      const success: boolean = member.id
        ? await PlanMember.update(request, member)
        : await PlanMember.create(request, member);

      if (!success) errs.push(ProjectMember.errorsToString(member.errors));
    }));
    if (errs.length > 0) plan.errors['members'] = errs.join('; ');

    return !Plan.hasErrors(plan.errors);
  }

  /**
   * Create the current Plan Member/Contributor
   *
   * @param request the Fastify request
   * @param member the Plan member/contributor
   * @returns true if successful. If not, any errors are added to the errors object
   */
  static async create(request: FastifyRequest, member: PlanMember): Promise<boolean> {
    const saved: GQLResponse<AddPlanMemberResponse> = await PlanMember.mutate<AddPlanMemberResponse>(
      request,
      {
        mutation: AddPlanMemberDocument,
        variables: {
          planId: member.plan?.id,
          projectMemberId: member.projectMember?.id,
          memberRoleIds: member.memberRoles.map((r: MemberRole): number => r.id!)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMemberInterface | undefined = saved?.data?.addPlanMember;
    // Process any errors that may have occurred
    member.handleMutationErrors("create", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = PlanMember.hasErrors(data?.errors ?? {});
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
   * Update the current Plan Member/Contributor
   *
   * @param request the Fastify request
   * @param member the Plan member/contributor
   * @returns true if successful. If not, any errors are added to the errors object
   */
  static async update(request: FastifyRequest, member: PlanMember): Promise<boolean> {
    const saved: GQLResponse<UpdatePlanMemberResponse> = await PlanMember.mutate<UpdatePlanMemberResponse>(
      request,
      {
        mutation: UpdatePlanMemberDocument,
        variables: {
          planMemberId: member.id,
          isPrimaryContact: member.isPrimaryContact,
          memberRoleIds: member.memberRoles.map((r: MemberRole): number => r.id!)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMemberInterface | undefined = saved?.data?.updatePlanMember;
    // Process any errors that may have occurred
    member.handleMutationErrors("update", saved, data?.errors);

    // If data was returned and we have no errors
    let hadErrors: boolean = PlanMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      member.modified = data.modified;
      member.modifiedById = data.modifiedById;
      member.errors = data.errors ?? {};
    }
    return !hadErrors;
  }

  /**
   * Delete this Plan Member/Contributor
   *
   * @param request the Fastify request
   * @param member the Plan member/contributor
   * @returns true if successful. If not, any errors are added to the errors object
   */
  static async delete(request: FastifyRequest, member: PlanMember): Promise<boolean> {
    const deleted: GQLResponse<DeletePlanMemberResponse> = await PlanMember.mutate<DeletePlanMemberResponse>(
      request,
      {
        mutation: RemovePlanMemberDocument,
        variables: { planMemberId: member.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMemberInterface | undefined = deleted?.data?.removePlanMember;

    // Process any errors that may have occurred
    member.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = PlanMember.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      member.modified = data.modified;
      member.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Initialize Plan Members from a list of Project Members
   *
   * @param projectMembers the Project Members to create Plan Members/Contributors from
   * @returns the created Plan Members/Contributors
   */
  static async fromProjectMembers(
    projectMembers: ProjectMember[]
  ): Promise<PlanMember[]> {
    if (!projectMembers || projectMembers.length === 0) return [];

    return projectMembers.map((member: ProjectMember): PlanMember => {
      return new PlanMember({
        projectMember: member,
        isPrimaryContact: member.isPrimaryContact || false,
        memberRoles: member.memberRoles
      });
    });
  }

  /**
   * Find Plan Members/Contributors by a Plan id
   *
   * @param request the Fastify request
   * @param planId the Plan's id
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
