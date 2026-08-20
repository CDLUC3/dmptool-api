import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { DMPToolDMPType } from "@dmptool/types";
import { randomHex, removeNullAndUndefinedFromObject } from "@dmptool/utils";
import {
  AddEntirePlanInput,
  AddPlanDocument,
  EntirePlanAnswerFragment,
  EntirePlanFundingFragment,
  EntirePlanMemberFragment,
  PlanByAlternateIdentifierDocument,
  PlanByDmpIdDocument,
  PlanStatus,
  PlanVisibility,
  RemovePlanDocument,
  UpdateEntirePlanInput,
  UpdatePlanDocument
} from "../generated/graphql.js";
import { AlternateIdentifierType } from "../types.js";
import { DEFAULT_LANGUAGE, LangISO5 } from "../utils.js";
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { Project, ProjectQueryResponse } from "./Project.js";
import {
  VersionedTemplate,
  VersionedTemplateQueryResponse
} from "./VersionedTemplate.js";
import { ProjectFunding } from "./ProjectFunding.js";
import { ProjectMember } from "./ProjectMember.js";
import { Answer, AnswerQueryResponse } from "./Answer.js";
import {
  createNarrativeWorkflow
} from "../plugins/v3/workflows/narrativeWorkflow.js";

/**
 * Represents the structure of a plan from a GraphQL query
 */
export interface PlanQueryResponse {
  id?: number;
  dmpId?: string;
  title?: string;
  visibility?: string;
  status?: string;
  registered?: string;
  project?: ProjectQueryResponse;
  members?: {
    id?: number;
    projectMember?: {
      id?: number;
      }
    memberRoles?: {
      id?: number;
      uri?: string;
    }[]
  }[];
  fundings?: {
    id?: number;
    projectFunding?: {
      id?: number;
    }
  }[];
  answers?: AnswerQueryResponse[];
  versionedTemplate?: VersionedTemplateQueryResponse;
  alternateIdentifiers?: {
    id?: number;
    alternateIdentifier: string;
  }[];
  acceptedWorks?: {
    id?: number;

  }
}

/**
 * The shape of a plan's alternate identifier within a GraphQL query response
 */
export interface AlternateIdentifierQueryResponse {
  id?: number;
  alternateIdentifier: string;
}

/**
 * The response from the planByDMPId GraphQL query
 */
export interface PlanByDMPIdResponse {
  planByDMPId: PlanQueryResponse
}

/**
 * The response from the planByAlternateIdentifier GraphQL query
 */
export interface PlanByAlternateIdentifierResponse {
  planByAlternateIdentifier: PlanQueryResponse
}

/**
 * Representation of the GraphQL query response for adding an entire Plan
 */
export interface AddEntirePlanResponse {
  addEntirePlan: Plan
}

/**
 * Representation of the GraphQL query response for updating an entire Plan
 */
export interface UpdateEntirePlanResponse {
  updateEntirePlan: Plan
}

/**
 * Representation of the GraphQL query response for deleting an entire Plan
 */
export interface RemoveEntirePlanResponse {
  removeEntirePlan: Plan
}

/**
 * Represents a Data Management Plan
 */
export class Plan extends BaseGraphQLModel {
  dmpId: string;
  title: string;
  status: PlanStatus;
  visibility: PlanVisibility;
  languageId: LangISO5;
  registered?: string;
  templateId?: number;

  project: Project;

  versionedTemplate?: VersionedTemplate;

  alternateIdentifiers?: string[];
  // TODO: Update this once we've got the related works fixed in the maDMP record
  //       they are currently including too much (suggested/proposed matches)
  relatedWorks?: string[];

  members?: ProjectMember[];
  funding?: ProjectFunding[];
  answers?: Answer[];

  constructor(options: Partial<Plan> = {}) {
    super(options);

    this.dmpId = options.dmpId || `tmp-dmps-${randomHex(12)}`;
    this.title = options.title || 'Untitled Plan';
    this.status = options.status || 'DRAFT';
    this.visibility = options.visibility || 'PRIVATE';
    this.languageId = options.languageId ? options.languageId : DEFAULT_LANGUAGE;
    this.registered = options.registered;
    this.templateId = options.templateId;

    this.versionedTemplate = options.versionedTemplate;

    // Use the specified Project or initialize one using the Plan title
    this.project = options.project
      ? new Project(options.project)
      : new Project({ title: options.title });

    this.alternateIdentifiers = options.alternateIdentifiers || [];
    this.relatedWorks = options.relatedWorks || [];

    this.members = options.members
      ? options.members.map((m: ProjectMember) => new ProjectMember(m))
      : [];

    this.funding = options.funding
      ? options.funding.map((f: ProjectFunding) => new ProjectFunding(f))
      : [];

    this.answers = options.answers
      ? options.answers.map((a: Answer) => new Answer(a))
    : [];

    this.graphQLErrorsThatShouldBeWarnings = new Set<string>([
      'alternateIdentifiers',
      'relatedWorks'
    ]);
  }

  static fromGraphQL(graphQLPlan: PlanByDMPIdResponse | PlanByAlternateIdentifierResponse): Plan {
    if (!graphQLPlan) {
      throw new Error('Invalid GraphQL plan');
    }

    const payload: PlanQueryResponse = 'planByDMPId' in graphQLPlan
      ? graphQLPlan.planByDMPId
      : graphQLPlan.planByAlternateIdentifier;

    if (!payload || !payload.project || !payload.versionedTemplate) {
      throw new Error('Invalid GraphQL plan payload');
    }

    const versionedTemplate: VersionedTemplate = VersionedTemplate.fromGraphQL(payload.versionedTemplate);
    const project: Project = Project.fromGraphQL(payload.project);

    const answers: Answer[] = payload.answers
      ? payload.answers.map((a: AnswerQueryResponse): Answer => Answer.fromGraphQL(a))
      : [];

    const alternateIdentifiers = payload.alternateIdentifiers
      ? payload.alternateIdentifiers.map((id: AlternateIdentifierQueryResponse): string => {
          return id.alternateIdentifier;
        })
      : [];

    return new Plan({
      id: payload.id,
      dmpId: payload.dmpId,
      title: payload.title,
      visibility:  payload.visibility?.toUpperCase() as PlanVisibility,
      status: payload.status?.toUpperCase() as PlanStatus,
      registered: payload.registered,

      versionedTemplate,
      project,
      alternateIdentifiers,
      members: project.members,
      funding: project.funding,
      answers
    });
  }

  /**
   * Convert a maDMP record
   *
   * @param maDMP the maDMP record
   * @param versionedTemplate the versionedTemplate to use for the narrative
   * @param currentProject the current Project
   * @param currentPlan the current Plan
   * @returns a new Plan object
   */
  static reconcileFromMaDMP(
    maDMP: DMPToolDMPType['dmp'],
    versionedTemplate: VersionedTemplate,
    currentProject?: Project,
    currentPlan?: Plan
  ): Plan {
    const project: Project = currentProject || Project.reconcileFromMaDMP(maDMP, currentProject);

    const alternateIdentifiers: string[] = (maDMP.alternate_identifier ?? []).map((entry: AlternateIdentifierType): string => {
      return entry.identifier?.trim();
    });

    // If the current plan is present, we are replacing it, so always return
    // a new object.
    const newPlan: Plan = new Plan({
      id: currentPlan?.id,
      versionedTemplate: currentPlan?.versionedTemplate || versionedTemplate,
      dmpId: currentPlan?.dmpId,
      project,
      members: project.members || [],
      funding: project.funding || [],
      title: maDMP.title?.trim(),
      status: maDMP.status?.toUpperCase() as PlanStatus,
      visibility: maDMP.visibility?.toUpperCase() as PlanVisibility,
      registered: currentPlan?.registered,
      alternateIdentifiers: alternateIdentifiers.filter(Boolean),
    });

    // Process the maDMP narrative and dataset array
    newPlan.answers = createNarrativeWorkflow(newPlan, maDMP);
    return newPlan;
  }

  /**
   * Find the Plan or initialize a new one
   *
   * @param request the Fastify request
   * @param dmp the maDMP metadata
   * @param versionedTemplate the VersionedTemplate to use for the Plan narrative
   * @returns the plan
   */
  static async findOrInitialize(
    request: FastifyRequest,
    dmp: DMPToolDMPType['dmp'],
    versionedTemplate: VersionedTemplate
  ): Promise<Plan> {
    const dmpId: string = dmp.dmp_id.identifier;
    // Try to find it by the DMP id
    let plan: Plan | undefined = await Plan.findByDMPId(request, dmpId);

    // Try to find it by its alternate identifiers
    if (Array.isArray(dmp.alternate_identifier) && dmp.alternate_identifier.length > 0) {
      const altIds: AlternateIdentifierType[] = dmp.alternate_identifier;
      // Loop through the alternate identifiers and see if any match an existing plan
      for (const altId of altIds) {
        const identifier = altId?.identifier?.trim();
        if (!identifier) continue;

        plan = await Plan.findByAlternateIdentifier(request, identifier);
      }
    }

    const project: Project = plan && plan.project?.id
      ? plan.project
      : await Project.findOrInitialize(request, dmp);

    return Plan.reconcileFromMaDMP(dmp, versionedTemplate, project, plan);
  }

  /**
   * Create or update the Plan, Project and all of its associated objects
   * (e.g. members, funding, etc.)
   *
   * @param request the Fastify request
   * @returns true if successful otherwise it returns false and the plan will
   * have an errors property with the error messages
   */
  async save(request: FastifyRequest): Promise<boolean> {
    const members: EntirePlanMemberFragment[] = this.members
      ? this.members.map((member: ProjectMember): EntirePlanMemberFragment => {
        return member.toGraphQLInput();
      })
      : [];

    const funding: EntirePlanFundingFragment[] = this.funding
      ? this.funding.map((fundingItem: ProjectFunding): EntirePlanFundingFragment => {
        return fundingItem.toGraphQLInput();
      })
      : [];

    const answers: EntirePlanAnswerFragment[] = this.answers
      ? this.answers.map((answer: Answer): EntirePlanAnswerFragment => {
        return answer.toGraphQLInput();
      })
      : [];

    const input: AddEntirePlanInput | UpdateEntirePlanInput = {
      title: this.title,
      status: this.status,
      visibility: this.visibility,
      languageId: this.languageId,

      project: this.project.toGraphQLInput(),

      members,
      funding,
      answers,
      alternateIdentifiers: this.alternateIdentifiers,
    };

    if (!this.id) {
      request.log.debug({ input }, 'Creating new EntirePlan');
      const created: GQLResponse<AddEntirePlanResponse> = await Plan.mutate<AddEntirePlanResponse>(
        request,
        {
          mutation: AddPlanDocument,
          variables: {
            input: {
              ...removeNullAndUndefinedFromObject(input),
              versionedTemplateId: this.versionedTemplate?.id,
            }
          },
          errorPolicy: "all"
        } as MutateOptions
      );
      const data: Plan | undefined = created?.data?.addEntirePlan;
      this.processGQLResponse(created, data as Plan, 'create EntirePlan');
      // The above gets the id, created, modified, etc. but we need to assign the following too
      this.dmpId = data?.dmpId || this.dmpId;
      this.registered = data?.registered || this.registered;

    } else {
      request.log.debug({ input: { ...input, id: this.id } }, 'Updating an EntirePlan');
      const updated: GQLResponse<UpdateEntirePlanResponse> = await Plan.mutate<UpdateEntirePlanResponse>(
        request,
        {
          mutation: UpdatePlanDocument,
          variables: {
            input: {
              ...removeNullAndUndefinedFromObject(input),
              id: this.id
            },
          },
          errorPolicy: "all"
        } as MutateOptions
      );
      const data: Plan | undefined = updated?.data?.updateEntirePlan;
      this.processGQLResponse(updated, data as Plan, 'update EntirePlan');
    }

    return !this.hasErrors();
  }

  /**
   * Delete or tomb-stone the Plan
   *
   * @param request the Fastify request
   * @returns true if the deletion was successful
   */
  async delete(request: FastifyRequest): Promise<boolean> {
    if (this.id) {
      request.log.debug({ planId: this.id }, 'Archiving plan');
      const archived: GQLResponse<RemoveEntirePlanResponse> = await Plan.mutate<RemoveEntirePlanResponse>(
        request,
        {
          mutation: RemovePlanDocument,
          variables: {
            planId: this.id,
          },
          errorPolicy: "all"
        } as MutateOptions
      );
      const data: Plan | undefined = archived?.data?.removeEntirePlan;
      this.processGQLResponse(archived, data as Plan, 'remove EntirePlan');
      return data?.hasErrors() === false;
    }
    return false;
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
    return resp.data?.planByDMPId ? Plan.fromGraphQL(resp.data) : undefined;
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
    return resp.data?.planByAlternateIdentifier ? Plan.fromGraphQL(resp.data) : undefined;
  }
}
