import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { Plan } from "./Plan.js";
import { ProjectFunding } from "./ProjectFunding.js";
import {
  AddPlanFundingDocument,
  PlanFundingsDocument,
  RemovePlanFundingDocument,
  UpdatePlanFundingDocument,
} from "../generated/graphql.js";

export interface PlanFundingsResponse {
  planFundings: PlanFunding[];
}

export interface AddPlanFundingResponse {
  addPlanFunding: Plan;
}

export interface UpdatePlanFundingResponse {
  updatePlanFunding: PlanFunding[];
}

export interface RemovePlanFundingResponse {
  removePlanFunding: PlanFunding;
}

/**
 * Represents funding information for a Plan.
 */
export class PlanFunding extends BaseGraphQLModel {
  plan?: Plan;
  projectFunding?: ProjectFunding;

  constructor(options: Partial<PlanFunding> = {}) {
    super(options);

    this.plan = options.plan ? new Plan(options.plan) : undefined;
    this.projectFunding = options.projectFunding
      ? new ProjectFunding(options.projectFunding)
      : undefined;
    this.errors = options.errors ?? {};
  }

  /**
   * Create or update the Plan funding information
   *
   * @param request the Fastify request
   * @param plan the Plan
   * @param fundings the funding information
   * @returns true if the save was successful. The Plan will have errors if not
   */
  static async save(
    request: FastifyRequest,
    plan: Plan,
    fundings: PlanFunding[]
  ): Promise<boolean> {
    if (!plan?.id) return false;

    // Reset stale funding-specific errors before re-synchronizing.
    delete plan.errors.fundings;

    const fundingIds: number[] = [
      ...new Set(
        (fundings ?? [])
          .map((funding: PlanFunding): number | undefined => {
            return funding.projectFunding?.id;
          })
          .filter(Boolean) as number[]
      ),
    ];

    const existing = await PlanFunding.findByPlanId(request, plan.id);
    const errs: string[] = [];

    // Remove any funding information that is no longer there
    if (fundingIds.length === 0) {
      await Promise.all(
        existing.map(async (funding: PlanFunding): Promise<void> => {
          const removed = await funding.delete(request);
          if (!removed) errs.push(funding.errorsToString());
        })
      );

      if (errs.length > 0) {
        plan.errors.fundings = errs.join('; ');
        return false;
      }

      return true;
    }

    // Create or update the funding information
    const syncedFundings = existing.length === 0
      ? await PlanFunding.create(request, plan, fundingIds)
      : await PlanFunding.update(request, plan, fundingIds);

    if (!syncedFundings) {
      errs.push('Unable to synchronize plan funding information');
    } else {
      fundings.forEach((funding: PlanFunding): void => {
        funding.plan = plan;

        const matched = syncedFundings.find((synced: PlanFunding): boolean => {
          return synced.projectFunding?.id === funding.projectFunding?.id;
        });

        if (matched) {
          funding.id = matched.id;
        }
      });
    }

    if (errs.length > 0) {
      plan.errors.fundings = errs.join('; ');
      return false;
    }

    return true;
  }

  /**
   * Create the plan funding information
   *
   * @param request the Fastify request
   * @param plan the Plan
   * @param projectFundingIds the project funding ids
   * @returns the created PlanFunding objects, or undefined if there was an error
   */
  static async create(
    request: FastifyRequest,
    plan: Plan,
    projectFundingIds: number[]
  ): Promise<PlanFunding[] | undefined> {
    if (!plan.id) return undefined;

    const saved: GQLResponse<AddPlanFundingResponse> =
      await PlanFunding.mutate<AddPlanFundingResponse>(
        request,
        {
          mutation: AddPlanFundingDocument,
          variables: { planId: plan.id, projectFundingIds },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data: Plan | undefined = saved?.data?.addPlanFunding;
    if (!data) {
      plan.errors.general = 'Unable to add plan funding information';
      return undefined;
    }

    // If there were any errors
    if (data.errors.general) {
      plan.errors.general = data.errors.general;
      return undefined;
    }

    return PlanFunding.findByPlanId(request, plan.id);
  }

  /**
   * Update the plan funding information
   *
   * @param request the Fastify request
   * @param plan the Plan
   * @param projectFundingIds the project funding ids
   * @returns the updated PlanFunding objects, or undefined if there was an error
   */
  static async update(
    request: FastifyRequest,
    plan: Plan,
    projectFundingIds: number[]
  ): Promise<PlanFunding[] | undefined> {
    if (!plan || !plan.id) return undefined;

    const updated: GQLResponse<UpdatePlanFundingResponse> =
      await PlanFunding.mutate<UpdatePlanFundingResponse>(
        request,
        {
          mutation: UpdatePlanFundingDocument,
          variables: { planId: plan.id, projectFundingIds },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data: PlanFunding[] | undefined = updated?.data?.updatePlanFunding;
    if (!data || !Array.isArray(data)) {
      plan.errors.general = 'Unable to update plan funding information';
      return undefined;
    }

    const failedUpdates: PlanFunding[] = data.filter((pf: PlanFunding) => {
      return !!pf.errors?.general;
    });
    if (failedUpdates.length > 0) {
      plan.errors.fundings = failedUpdates.map((pf: PlanFunding) => pf.errorsToString()).join(', ');
    }

    return PlanFunding.findByPlanId(request, plan.id);
  }

  /**
   * Remove the plan funding information
   *
   * @param request the Fastify request
   * @returns true if successful, adds errors to the funding if not
   */
  async delete(
    request: FastifyRequest
  ): Promise<boolean> {
    const deleted: GQLResponse<RemovePlanFundingResponse> =
      await PlanFunding.mutate<RemovePlanFundingResponse>(
        request,
        {
          mutation: RemovePlanFundingDocument,
          variables: { planFundingId: this.id },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = deleted?.data?.removePlanFunding;
    this.processGQLResponse(deleted, data as PlanFunding, 'delete PlanFunding');
    return !this.hasErrors();
  }

  /**
   * Fetch all funding information for a Plan
   *
   * @param request the Fastify request
   * @param planId the Plan id
   * @returns an array of PlanFunding objects, or an empty array if there was an error
   */
  static async findByPlanId(
    request: FastifyRequest,
    planId: number
  ): Promise<PlanFunding[]> {
    const resp: GQLResponse<PlanFundingsResponse> =
      await this.query<PlanFundingsResponse>(request, {
        query: PlanFundingsDocument,
        variables: { planId },
        errorPolicy: "all",
      });

    return Array.isArray(resp.data?.planFundings)
      ? resp.data.planFundings.map(
          (funding: PlanFunding): PlanFunding =>
            new PlanFunding(funding)
        )
      : [];
  }

  /**
   * Convert Project funding information into Plan funding information
   *
   * @param plan the Plan
   * @param fundings the Project funding information
   * @returns an array of PlanFunding objects
   */
  static fromProjectFundings(plan: Plan, fundings: ProjectFunding[]): PlanFunding[] {
    return (fundings ?? []).map((funding: ProjectFunding): PlanFunding => {
      return new PlanFunding({
        plan,
        projectFunding: funding,
      });
    });
  }
}

