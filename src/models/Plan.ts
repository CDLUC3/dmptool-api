import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { DMPToolDMPType } from "@dmptool/types";
import { ProjectInterface } from "./Project.js";
import { PlanMember } from "./PlanMember.js";
import { VersionedTemplate, VersionedTemplateInterface } from "./VersionedTemplate.js";
import { AlternateIdentifierType } from "../types.js";
import {
  AddAlternateIdentifierDocument,
  AddPlanDocument,
  ArchivePlanDocument,
  PlanByAlternateIdentifierDocument,
  PlanByDmpIdDocument,
  PlanDocument,
  PlansDocument,
  PlanStatus,
  PlanVisibility,
  RemoveAlternateIdentifierDocument,
  UpdatePlanStatusDocument,
  UpdatePlanTitleDocument
} from "../generated/graphql.js";
import { randomHex } from "@dmptool/utils";

/**
 * Represents a Data Management Plan
 */
export interface PlanInterface {
  id: number;
  projectId: number;
  dmpId: string;
  title: string;
  visibility: PlanVisibility;
  status: PlanStatus;
  registered: string;
  project: ProjectInterface;
  versionedTemplate: VersionedTemplateInterface;
  alternateIdentifiers: AlternateIdentifierInterface[];
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

/**
 * Represents an alternate identifier for a Data Management Plan
 */
export interface AlternateIdentifierInterface {
  id: number;
  alternateIdentifier: string;
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

/**
 * The possible response for a Plan GraphQL query
 */
export interface PlanResponse {
  plan: PlanInterface
}

/**
 * The possible response for a Plans GraphQL query
 */
export interface PlansResponse {
  plans: PlanInterface[]
}

/**
 * The response from the planByDMPId GraphQL query
 */
export interface PlanByDMPIdResponse {
  planByDMPId: PlanInterface
}

/**
 * The response from the planByAlternateIdentifier GraphQL query
 */
export interface PlanByAlternateIdentifierResponse {
  planByAlternateIdentifier: PlanInterface
}

/**
 * Representation of the GraphQL query response for adding a Plan
 */
export interface AddPlanResponse {
  addPlan: PlanInterface
}

/**
 * Representation of the GraphQL query response for updating a Plan title
 */
export interface UpdatePlanTitleResponse {
  updatePlanTitle: PlanInterface
}

/**
 * Representation of the GraphQL query response for updating a Plan status
 */
export interface UpdatePlanStatusResponse {
  updatePlanStatus: PlanInterface
}

/**
 * Representation of the GraphQL query response for deleting a Plan
 */
export interface ArchivePlanResponse {
  archivePlan: PlanInterface
}

/**
 * Representation of the GraphQL query response for adding an alternate identifier
 */
export interface AddAlternateIdentifierResponse {
  addAlternateIdentifierToPlan: AlternateIdentifierInterface
}

/**
 * Representation of the GraphQL query response for removing an alternate identifier
 */
export interface RemoveAlternateIdentifierResponse {
  removeAlternateIdentifierFromPlan: AlternateIdentifierInterface
}

/**
 * Represents a Data Management Plan
 */
export class Plan extends BaseGraphQLModel {
  projectId?: number;
  versionedTemplate?: VersionedTemplateInterface;

  dmpId: string;
  title?: string;
  visibility?: PlanVisibility;
  status?: PlanStatus;
  registered?: string;
  alternateIdentifiers?: AlternateIdentifierInterface[];
  members?: PlanMember[];

  constructor(options: Partial<Plan> = {}) {
    super(options);

    this.projectId = options.projectId;
    this.versionedTemplate = options.versionedTemplate;
    this.dmpId = options.dmpId ?? `tmp-dmps-${randomHex(12)}`;
    this.title = options.title;
    this.visibility = options.visibility ?? 'PRIVATE';
    this.status = options.status ?? 'DRAFT';
    this.registered = options.registered;
    this.alternateIdentifiers = options.alternateIdentifiers ?? [];

    this.members = options.members ? options.members.map((m: PlanMember) => new PlanMember(m)) : [];

    this.errors = options.errors ?? {};
  }

  /**
   * Shortcut helper function to save or update the current Plan
   *
   * @param request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async save(request: FastifyRequest): Promise<boolean> {
    if (this.id) return await this.update(request);

    const created: boolean = await this.create(request);
    if (created) {
      // If the creation was successful, follow it up with an update since the
      // creat process does not set the title or status!
      return await this.update(request);
    }
    return false;
  }

  /**
   * Create the current Plan
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<AddPlanResponse> = await Plan.mutate<AddPlanResponse>(
      request,
      {
        mutation: AddPlanDocument,
        variables: {
          projectId: this.projectId,
          versionedTemplateId: this.versionedTemplate?.id
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanInterface | undefined = saved?.data?.addPlan;
    // Process any errors that may have occurred
    this.handleMutationErrors("create", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Plan.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.id = data.id;
      this.created = data.created;
      this.createdById = data.createdById;
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
      this.dmpId = data.dmpId;
    }

    return !hadErrors;
  }

  /**
   * Update the current Plan
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async update(request: FastifyRequest): Promise<boolean> {
    // First update the Plan title
    const savedTitle: GQLResponse<UpdatePlanTitleResponse> = await Plan.mutate<UpdatePlanTitleResponse>(
      request,
      {
        mutation: UpdatePlanTitleDocument,
        variables: {
          planId: this.id,
          title: this.title
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const titleData: PlanInterface | undefined = savedTitle?.data?.updatePlanTitle;
    // Process any errors that may have occurred
    this.handleMutationErrors("update title", savedTitle, titleData?.errors);

    // If data was returned and we have no errors
    let hadErrors: boolean = Plan.hasErrors(titleData?.errors ?? {});
    if (titleData && !hadErrors) {
      // If successful, then update the Plan status
      const savedStatus: GQLResponse<UpdatePlanStatusResponse> = await Plan.mutate<UpdatePlanStatusResponse>(
        request,
        {
          mutation: UpdatePlanStatusDocument,
          variables: {
            planId: this.id,
            status: this.status
          },
          errorPolicy: "all"
        } as MutateOptions
      );
      const data: PlanInterface | undefined = savedStatus?.data?.updatePlanStatus;
      // Process any errors that may have occurred
      this.handleMutationErrors("update status", savedStatus, data?.errors);

      // If data was returned and we have no errors
      hadErrors = Plan.hasErrors(data?.errors ?? {});
      if (data && !hadErrors) {
        this.modified = data.modified;
        this.modifiedById = data.modifiedById;
        this.errors = data.errors ?? {};
      }
    }

    return !hadErrors;
  }

  /**
   * Delete this plan
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async delete(request: FastifyRequest): Promise<boolean> {
    const deleted: GQLResponse<ArchivePlanResponse> = await Plan.mutate<ArchivePlanResponse>(
      request,
      {
        mutation: ArchivePlanDocument,
        variables: { planId: this.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: PlanInterface | undefined = deleted?.data?.archivePlan;
    // Process any errors that may have occurred
    this.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Plan.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Find the Plan or initialize a new one
   *
   * @param request the Fastify request
   * @param versionedTemplate the versioned template
   * @param dmp the maDMP metadata
   * @returns the plan
   */
  static async findOrInitialize(
    request: FastifyRequest,
    versionedTemplate: VersionedTemplate,
    dmp: DMPToolDMPType['dmp']
  ): Promise<Plan> {
    const dmpId: string = dmp.dmp_id.identifier;
    // Try to find it by the DMP id
    const plan: Plan | undefined = await Plan.findByDMPId(request, dmpId);
    if (plan) return plan;

    // Try to find it by its alternate identifiers
    if (Array.isArray(dmp.alternate_identifier) && dmp.alternate_identifier.length > 0) {
      const altIds: AlternateIdentifierType[] = dmp.alternate_identifier;
      // Loop through the alternate identifiers and see if any match an existing plan
      for (const altId of altIds) {
        const identifier = altId?.identifier?.trim();
        if (!identifier) continue;

        const found: Plan | undefined = await Plan.findByAlternateIdentifier(request, identifier);
        if (found) return found;
      }
    }

    // Otherwise we couldn't find it, so initialize a new one
    return new Plan({
      versionedTemplate,
      title: dmp.title.trim(),
      visibility: dmp.visibility ? dmp.visibility.toUpperCase() : null,
      status: dmp.status ? dmp.status.toUpperCase() : null,
    });
  }

  /**
   * Save alternate identifiers for this plan
   *
   * @param request the Fastify request
   * @param altIds the alternate identifiers to save
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async saveAlternateIdentifiers(
    request: FastifyRequest,
    altIds: AlternateIdentifierType[]
  ): Promise<boolean> {
    // Just return true if there are no alternate identifiers to save
    if (!altIds || !Array.isArray(altIds) || altIds.length === 0) return true;

    const oldIds: string[] = this.alternateIdentifiers?.map((a: AlternateIdentifierInterface): string => a.alternateIdentifier) ?? [];
    const newIds: string[] = altIds.map((a: AlternateIdentifierType): string => a.identifier);
    const errs: string[] = [];

    // Remove whatever ones we currently have if they're not included in the altIds list
    await Promise.all(oldIds.map(async (oldId: string): Promise<void> => {
      // Check if it is still in the new list. If so, continue
      if (newIds.includes(oldId)) return;

      const deleted: GQLResponse<RemoveAlternateIdentifierResponse> = await Plan.mutate<RemoveAlternateIdentifierResponse>(
        request,
        {
          mutation: RemoveAlternateIdentifierDocument,
          variables: { planId: this.id, alternateIdentifier: oldId },
          errorPolicy: "all"
        } as MutateOptions
      );
      const data: AlternateIdentifierInterface | undefined = deleted?.data?.removeAlternateIdentifierFromPlan;
      // Process any errors that may have occurred
      this.handleMutationErrors("delete", deleted, data?.errors);

      // If data was returned and we have no errors
      const hadErrors: boolean = Plan.hasErrors(data?.errors ?? {});
      if (!data || hadErrors) {
        // The removal failed so record the error
        errs.push(`Unable to remove old alternate identifier: ${oldId}`);
      }
    }));

    // If any errors occurred, return false
    if (errs.length > 0) {
      this.errors.alternateIdentifiers = errs.join("\n");
      return false;
    }

    // Add all new alternate identifiers
    await Promise.all(newIds.map(async (newId: string): Promise<void> => {
      // If it is already in the old list, then we don't need to add it
      if (oldIds.includes(newId)) return;

      const added: GQLResponse<AddAlternateIdentifierResponse> = await Plan.mutate<AddAlternateIdentifierResponse>(
        request,
        {
          mutation: AddAlternateIdentifierDocument,
          variables: { planId: this.id, alternateIdentifier: newId },
          errorPolicy: "all"
        } as MutateOptions
      );
      const data: AlternateIdentifierInterface | undefined = added?.data?.addAlternateIdentifierToPlan;
      // Process any errors that may have occurred
      this.handleMutationErrors("create", added, data?.errors);

      // If data was returned and we have no errors
      const hadErrors: boolean = Plan.hasErrors(data?.errors ?? {});
      if (!data || hadErrors) {
        // The removal failed so record the error
        errs.push(`Unable to add new alternate identifier: ${newId}`);
      }
    }));

    return errs.length === 0;
  }

  /**
   * Find a plan by its id
   *
   * @param request the Fastify request
   * @param id the Plan's id
   * @returns the Plan
   */
  static async findById(request: FastifyRequest, id: number): Promise<Plan | undefined> {
    const resp: GQLResponse<PlanResponse> = await this.query<PlanResponse>(
      request,
      {
        query: PlanDocument,
        variables: { planId: id },
        errorPolicy: "all"
      }
    );

    return resp.data?.plan ? new Plan(resp.data.plan) : undefined;
  }

  /**
   * Find a plan by a DMP id
   *
   * @param request the Fastify request
   * @param dmpId the Plan's DMP id
   * @returns the Plan
   */
  static async findByDMPId(request: FastifyRequest, dmpId: string): Promise<Plan | undefined> {
    const resp: GQLResponse<PlanByDMPIdResponse> = await this.query<PlanByDMPIdResponse>(
      request,
      {
        query: PlanByDmpIdDocument,
        variables: { dmpId: dmpId },
        errorPolicy: "all"
      }
    );

    return resp.data?.planByDMPId ? new Plan(resp.data.planByDMPId) : undefined;
  }

  /**
   * Find a plan by an alternate identifier
   *
   * @param request the Fastify request
   * @param alternateId the Plan's alternate identifier
   * @returns the Plan
   */
  static async findByAlternateIdentifier(request: FastifyRequest, alternateId: string): Promise<Plan | undefined> {
    const resp: GQLResponse<PlanByAlternateIdentifierResponse> = await this.query<PlanByAlternateIdentifierResponse>(
      request,
      {
        query: PlanByAlternateIdentifierDocument,
        variables: { alternateIdentifier: alternateId },
        errorPolicy: "all"
      }
    );

    return resp.data?.planByAlternateIdentifier ? new Plan(resp.data.planByAlternateIdentifier) : undefined;
  }

  /**
   * Find plans by a Project id
   *
   * @param request the Fastify request
   * @param projectId the Project's id
   * @returns the Plans
   */
  static async findByProjectId(request: FastifyRequest, projectId: number): Promise<Plan[] | []> {
    const resp: GQLResponse<PlansResponse> = await this.query<PlansResponse>(
      request,
      {
        query: PlansDocument,
        variables: { projectId },
        errorPolicy: "all"
      }
    );
    return Array.isArray(resp.data?.plans)
      ? resp.data.plans.map((plan: PlanInterface) => new Plan(plan))
      : [];
  }
}
