import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
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
 * The possible response for a Plan Members/Contributors GraphQL query
 */
export interface PlanMembersResponse {
  planMembers: PlanMember[]
}

/**
 * Representation of the GraphQL query response for adding a Plan Member/Contributor
 */
export interface AddPlanMemberResponse {
  addPlanMember: PlanMember
}

/**
 * Representation of the GraphQL query response for updating a Plan Member/Contributor
 */
export interface UpdatePlanMemberResponse {
  updatePlanMember: PlanMember
}

/**
 * Representation of the GraphQL query response for deleting a Plan Member/Contributor
 */
export interface DeletePlanMemberResponse {
  removePlanMember: PlanMember
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
    // If the members are empty, this is an error (we must have a primary contact!)
    if (!members || members.length === 0) {
      plan.errors['members'] = "maDMP must have at least one contact"
    }
    const memberIds: number[] = members.map((m: PlanMember): number | undefined => m.id)
      .filter(Boolean) as number[];

    // Fetch the existing members associated with the Plan
    const existing: PlanMember[] = await PlanMember.findByPlanId(request, plan.id);
    // Compare them to the list of new members and see if there are any that should
    // be deleted
    const toDelete: PlanMember[] = existing.filter((m: PlanMember): boolean => {
      return m.id ? !memberIds.includes(m.id) : false;
    });

    // Loop through and save each member that was in the maDMP
    const errs: string[] = [];
    const warns: string[] = [];
    await Promise.all(members.map(async (member: PlanMember): Promise<void> => {
      const success: boolean = member.id
        ? await member.update(request)
        : await member.create(request);

      // Capture any errors and warnings
      warns.push(member.warningsToString())
      if (!success) errs.push(member.errorsToString());
    }));
    if (errs.length > 0) plan.errors['members'] = errs.join('; ');
    if (warns.length > 0) plan.warnings['members'] = warns.join('; ');

    // Now that the new members have been added, we can delete any that are no longer
    // valid. We do this last because otherwise Apollo throws an error because there
    // must be at least one PlanMember
    const deleteErrs: string[] = [];
    if (toDelete.length > 0) {
      // Delete each one
      await Promise.all(toDelete.map(async (member: PlanMember): Promise<void> => {
        const deleted: boolean = await member.delete(request);
        if (!deleted) deleteErrs.push(member.errorsToString());
      }));
    }
    // Log any deletion errors and then continue with the creates/updates to hopefully
    // ensure that we set the primary contact one
    if (deleteErrs.length > 0) plan.errors['members'] = deleteErrs.join('; ');

    return !plan.hasErrors();
  }

  /**
   * Create the current Plan Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<AddPlanMemberResponse> = await PlanMember.mutate<AddPlanMemberResponse>(
      request,
      {
        mutation: AddPlanMemberDocument,
        variables: {
          planId: this.plan?.id,
          projectMemberId: this.projectMember?.id,
          roleIds: this.memberRoles.map((r: MemberRole): number | undefined => r.id)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMember | undefined = saved?.data?.addPlanMember;
    this.processGQLResponse(saved, data as PlanMember, 'create PlanMember');
    return !this.hasErrors();
  }

  /**
   * Update the current Plan Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async update(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<UpdatePlanMemberResponse> = await PlanMember.mutate<UpdatePlanMemberResponse>(
      request,
      {
        mutation: UpdatePlanMemberDocument,
        variables: {
          planId: this.plan?.id,
          planMemberId: this.id,
          isPrimaryContact: this.isPrimaryContact,
          memberRoleIds: this.memberRoles.map((r: MemberRole): number | undefined => r.id)
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanMember | undefined = saved?.data?.updatePlanMember;
    this.processGQLResponse(saved, data as PlanMember, 'update PlanMember');
    return !this.hasErrors();
  }

  /**
   * Delete this Plan Member/Contributor
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
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
    const data: PlanMember | undefined = deleted?.data?.removePlanMember;
    this.processGQLResponse(deleted, data as PlanMember, 'delete PlanMember');
    return !this.hasErrors();
  }

  /**
   * Initialize Plan Members from a list of Project Members
   *
   * @param plan the Plan
   * @param projectMembers the Project Members to create Plan Members/Contributors from
   * @returns the created Plan Members/Contributors
   */
  static async fromProjectMembers(
    plan: Plan,
    projectMembers: ProjectMember[]
  ): Promise<PlanMember[]> {
    if (!projectMembers || projectMembers.length === 0) return [];

    return projectMembers.map((member: ProjectMember): PlanMember => {
      return new PlanMember({
        plan: plan,
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
      ? resp.data.planMembers.map((p: PlanMember): PlanMember => new PlanMember(p))
      : [];
  }
}
