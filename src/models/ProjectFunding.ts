import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { Project } from "./Project.js";
import { Affiliation } from "./Affiliation.js";
import {
  AddProjectFundingDocument,
  ProjectFundingStatus,
  ProjectFundingsDocument,
  RemoveProjectFundingDocument,
  UpdateProjectFundingDocument,
} from "../generated/graphql.js";

/**
 * Funding that supports a Project.
 */
export interface ProjectFundingInterface {
  id: number;
  project: Project;
  affiliation: Affiliation;
  status?: ProjectFundingStatus;
  funderProjectNumber?: string;
  grantId?: string;
  funderOpportunityNumber?: string;
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

export interface ProjectFundingsResponse {
  projectFundings: ProjectFundingInterface[];
}

export interface AddProjectFundingResponse {
  addProjectFunding: ProjectFundingInterface;
}

export interface UpdateProjectFundingResponse {
  updateProjectFunding: ProjectFundingInterface;
}

export interface RemoveProjectFundingResponse {
  removeProjectFunding: ProjectFundingInterface;
}

/**
 * Represents funding information for a Project
 */
export class ProjectFunding extends BaseGraphQLModel {
  project?: Project;
  affiliation?: Affiliation;
  status?: ProjectFundingStatus;
  funderProjectNumber?: string;
  grantId?: string;
  funderOpportunityNumber?: string;

  constructor(options: Partial<ProjectFundingInterface> = {}) {
    super(options);

    this.project = options.project ? new Project(options.project) : undefined;
    this.affiliation = options.affiliation
      ? new Affiliation(options.affiliation)
      : undefined;
    this.status = options.status;
    this.funderProjectNumber = options.funderProjectNumber;
    this.grantId = options.grantId;
    this.funderOpportunityNumber = options.funderOpportunityNumber;
    this.errors = options.errors ?? {};
  }

  /**
   * Create or update the Project funding information
   *
   * @param request the Fastify request
   * @param project the Project
   * @param fundings the funding information
   * @returns true if the save was successful. The Project will have errors if not
   */
  static async save(
    request: FastifyRequest,
    project: Project,
    fundings: ProjectFunding[]
  ): Promise<boolean> {
    if (!project?.id) return false;

    // Reset stale funding-specific errors before re-synchronizing.
    delete project.errors.fundings;

    const existing: ProjectFunding[] = await ProjectFunding.findByProjectId(
      request,
      project.id
    );
    const desired: ProjectFunding[] = [...(fundings ?? [])];
    const unmatchedExisting: ProjectFunding[] = [...existing];

    // Match by stable attributes so we can avoid unnecessary deletes/creates.
    for (const funding of desired) {
      const exactMatch: ProjectFunding | undefined = unmatchedExisting.find(
        (existingFunding: ProjectFunding): boolean => {
          return ProjectFunding.fingerprint(existingFunding)
            === ProjectFunding.fingerprint(funding);
        }
      );

      if (exactMatch) {
        funding.id = exactMatch.id;
        unmatchedExisting.splice(unmatchedExisting.indexOf(exactMatch), 1);
        continue;
      }

      const sameFunder: ProjectFunding | undefined = unmatchedExisting.find(
        (existingFunding: ProjectFunding): boolean => {
          return existingFunding.affiliation?.uri === funding.affiliation?.uri;
        }
      );

      if (sameFunder) {
        funding.id = sameFunder.id;
        unmatchedExisting.splice(unmatchedExisting.indexOf(sameFunder), 1);
      }
    }

    const errs: string[] = [];

    // Remove any funding information that is no longer there
    await Promise.all(
      unmatchedExisting.map(async (funding: ProjectFunding): Promise<void> => {
        const deleted = await ProjectFunding.delete(request, funding);
        if (!deleted) errs.push(ProjectFunding.errorsToString(funding.errors));
      })
    );

    // Add or update the funding information
    await Promise.all(
      desired.map(async (funding: ProjectFunding): Promise<void> => {
        funding.project = project;

        const success = funding.id
          ? await ProjectFunding.update(request, funding)
          : await ProjectFunding.create(request, funding);

        if (!success) errs.push(ProjectFunding.errorsToString(funding.errors));
      })
    );

    if (errs.length > 0) {
      project.errors.fundings = errs.join('; ');
      return false;
    }

    return true;
  }

  /**
   * Add the project funding information
   *
   * @param request the Fastify request
   * @param funding the funding information
   * @returns true if successful. If not, the error object will have messages
   */
  static async create(
    request: FastifyRequest,
    funding: ProjectFunding
  ): Promise<boolean> {
    if (!(await this.ensureFunderAffiliation(request, funding))) {
      return false;
    }

    const saved: GQLResponse<AddProjectFundingResponse> =
      await ProjectFunding.mutate<AddProjectFundingResponse>(
        request,
        {
          mutation: AddProjectFundingDocument,
          variables: {
            input: {
              projectId: funding.project?.id,
              affiliationId: funding.affiliation?.uri,
              status: funding.status,
              funderProjectNumber: funding.funderProjectNumber?.trim(),
              grantId: funding.grantId?.trim(),
              funderOpportunityNumber: funding.funderOpportunityNumber?.trim(),
            },
          },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = saved?.data?.addProjectFunding;
    funding.handleMutationErrors("create", saved, data?.errors);

    const hadErrors = ProjectFunding.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      funding.id = data.id;
      funding.created = data.created;
      funding.createdById = data.createdById;
      funding.modified = data.modified;
      funding.modifiedById = data.modifiedById;
    }


    return !hadErrors;
  }

  /**
   * Update the project funding information
   *
   * @param request the Fastify request
   * @param funding the funding information
   * @returns true if successful. If not, the error object will have messages
   */
  static async update(
    request: FastifyRequest,
    funding: ProjectFunding
  ): Promise<boolean> {
    if (!(await this.ensureFunderAffiliation(request, funding))) {
      return false;
    }

    const saved: GQLResponse<UpdateProjectFundingResponse> =
      await ProjectFunding.mutate<UpdateProjectFundingResponse>(
        request,
        {
          mutation: UpdateProjectFundingDocument,
          variables: {
            input: {
              projectFundingId: funding.id,
              status: funding.status,
              funderProjectNumber: funding.funderProjectNumber?.trim(),
              grantId: funding.grantId?.trim(),
              funderOpportunityNumber: funding.funderOpportunityNumber?.trim(),
            },
          },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = saved?.data?.updateProjectFunding;
    funding.handleMutationErrors("update", saved, data?.errors);

    const hadErrors = ProjectFunding.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      funding.modified = data.modified;
      funding.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Remove the funding information
   *
   * @param request the Fastify request
   * @param funding the funding information to remove
   * @returns true if successful. If not, the error object will have messages
   */
  static async delete(
    request: FastifyRequest,
    funding: ProjectFunding
  ): Promise<boolean> {
    const deleted: GQLResponse<RemoveProjectFundingResponse> =
      await ProjectFunding.mutate<RemoveProjectFundingResponse>(
        request,
        {
          mutation: RemoveProjectFundingDocument,
          variables: { projectFundingId: funding.id },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = deleted?.data?.removeProjectFunding;
    funding.handleMutationErrors("delete", deleted, data?.errors);

    const hadErrors = ProjectFunding.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      funding.modified = data.modified;
      funding.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Fetch all the funding information for the specified Project
   *
   * @param request the Fastify request
   * @param projectId the Project id
   * @returns an array of Project funding information
   */
  static async findByProjectId(
    request: FastifyRequest,
    projectId: number
  ): Promise<ProjectFunding[]> {
    const resp: GQLResponse<ProjectFundingsResponse> =
      await this.query<ProjectFundingsResponse>(request, {
        query: ProjectFundingsDocument,
        variables: { projectId },
        errorPolicy: "all",
      });

    return Array.isArray(resp.data?.projectFundings)
      ? resp.data.projectFundings.map(
          (funding: ProjectFundingInterface): ProjectFunding =>
            new ProjectFunding(funding)
        )
      : [];
  }

  /**
   * Ensure that the funder has been persisted to the DB
   *
   * @param request the Fastify Request
   * @param funding the funding information
   * @returns true if the affiliation is valid. If not, the funding error object
   * will have messages
   */
  private static async ensureFunderAffiliation(
    request: FastifyRequest,
    funding: ProjectFunding
  ): Promise<boolean> {
    if (!funding.affiliation?.uri) {
      funding.errors.affiliationId = 'Funding affiliation URI is required';
      return false;
    }

    if (!funding.affiliation.id) {
      const existing = await Affiliation.findByURI(request, funding.affiliation.uri);
      if (existing?.id) {
        funding.affiliation = existing;
      }
    }

    return true;
  }

  /**
   * Create a unique identifier for the project funding to facilitate matches
   *
   * @param funding the funding information
   * @returns a unique fingerprint for the funding
   */
  private static fingerprint(funding: ProjectFunding): string {
    return [
      funding.affiliation?.uri ?? '',
      funding.status ?? '',
      funding.funderProjectNumber?.trim() ?? '',
      funding.funderOpportunityNumber?.trim() ?? '',
      funding.grantId?.trim() ?? '',
    ].join('|');
  }
}

