import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { Plan, PlanInterface } from "./Plan.js";
import { ProjectFunding } from "./ProjectFunding.js";
import {
  AddPlanFundingDocument,
  PlanFundingsDocument,
  RemovePlanFundingDocument,
  UpdatePlanFundingDocument,
} from "../generated/graphql.js";

export interface PlanFundingInterface {
  id: number;
  plan: Plan;
  projectFunding: ProjectFunding;
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

export interface PlanFundingsResponse {
  planFundings: PlanFundingInterface[];
}

export interface AddPlanFundingResponse {
  addPlanFunding: PlanInterface;
}

export interface UpdatePlanFundingResponse {
  updatePlanFunding: PlanFundingInterface[];
}

export interface RemovePlanFundingResponse {
  removePlanFunding: PlanFundingInterface;
}

export class PlanFunding extends BaseGraphQLModel {
  plan?: Plan;
  projectFunding?: ProjectFunding;

  constructor(options: Partial<PlanFundingInterface> = {}) {
    super(options);

    this.plan = options.plan ? new Plan(options.plan) : undefined;
    this.projectFunding = options.projectFunding
      ? new ProjectFunding(options.projectFunding)
      : undefined;
    this.errors = options.errors ?? {};
  }

  static async save(
    request: FastifyRequest,
    plan: Plan,
    fundings: PlanFunding[]
  ): Promise<boolean> {
    if (!plan?.id) return false;

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

    if (fundingIds.length === 0) {
      await Promise.all(
        existing.map(async (funding: PlanFunding): Promise<void> => {
          const removed = await PlanFunding.delete(request, funding);
          if (!removed) errs.push(PlanFunding.errorsToString(funding.errors));
        })
      );

      if (errs.length > 0) plan.errors.fundings = errs.join('; ');
      return !Plan.hasErrors(plan.errors);
    }

    const syncedFundings = existing.length === 0
      ? await PlanFunding.create(request, plan.id, fundingIds)
      : await PlanFunding.update(request, plan.id, fundingIds);

    if (!syncedFundings) {
      errs.push('Unable to synchronize plan fundings');
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
    }

    return !Plan.hasErrors(plan.errors);
  }

  static async create(
    request: FastifyRequest,
    planId: number,
    projectFundingIds: number[]
  ): Promise<PlanFunding[] | undefined> {
    const saved: GQLResponse<AddPlanFundingResponse> =
      await PlanFunding.mutate<AddPlanFundingResponse>(
        request,
        {
          mutation: AddPlanFundingDocument,
          variables: { planId, projectFundingIds },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = saved?.data?.addPlanFunding;
    if (!data) return undefined;

    const hadErrors = PlanFunding.hasErrors(data.errors ?? {});
    if (hadErrors) return undefined;

    return PlanFunding.findByPlanId(request, planId);
  }

  static async update(
    request: FastifyRequest,
    planId: number,
    projectFundingIds: number[]
  ): Promise<PlanFunding[] | undefined> {
    const updated: GQLResponse<UpdatePlanFundingResponse> =
      await PlanFunding.mutate<UpdatePlanFundingResponse>(
        request,
        {
          mutation: UpdatePlanFundingDocument,
          variables: { planId, projectFundingIds },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = updated?.data?.updatePlanFunding;
    if (!Array.isArray(data)) return undefined;

    const hasErrors = data.some((planFunding: PlanFundingInterface): boolean => {
      return PlanFunding.hasErrors(planFunding.errors ?? {});
    });

    if (hasErrors) return undefined;

    return data.map((planFunding: PlanFundingInterface): PlanFunding => {
      return new PlanFunding(planFunding);
    });
  }

  static async delete(
    request: FastifyRequest,
    funding: PlanFunding
  ): Promise<boolean> {
    const deleted: GQLResponse<RemovePlanFundingResponse> =
      await PlanFunding.mutate<RemovePlanFundingResponse>(
        request,
        {
          mutation: RemovePlanFundingDocument,
          variables: { planFundingId: funding.id },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = deleted?.data?.removePlanFunding;
    funding.handleMutationErrors("delete", deleted, data?.errors);

    const hadErrors = PlanFunding.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      funding.modified = data.modified;
      funding.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

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
          (funding: PlanFundingInterface): PlanFunding =>
            new PlanFunding(funding)
        )
      : [];
  }

  static fromProjectFundings(plan: Plan, fundings: ProjectFunding[]): PlanFunding[] {
    return (fundings ?? []).map((funding: ProjectFunding): PlanFunding => {
      return new PlanFunding({
        plan,
        projectFunding: funding,
      });
    });
  }
}

