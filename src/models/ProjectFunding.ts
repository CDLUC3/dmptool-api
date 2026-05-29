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

export interface ProjectFundingsResponse {
  projectFundings: ProjectFunding[];
}

export interface AddProjectFundingResponse {
  addProjectFunding: ProjectFunding;
}

export interface UpdateProjectFundingResponse {
  updateProjectFunding: ProjectFunding;
}

export interface RemoveProjectFundingResponse {
  removeProjectFunding: ProjectFunding;
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

  constructor(options: Partial<ProjectFunding> = {}) {
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
        const deleted = await funding.delete(request);
        if (!deleted) errs.push(funding.errorsToString());
      })
    );

    // Add or update the funding information
    await Promise.all(
      desired.map(async (funding: ProjectFunding): Promise<void> => {
        funding.project = project;

        const success = funding.id
          ? await funding.update(request)
          : await funding.create(request);

        if (!success) errs.push(funding.errorsToString());
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
   * @returns true if successful. If not, the error object will have messages
   */
  async create(
    request: FastifyRequest
  ): Promise<boolean> {
    if (!(await this.ensureFunderAffiliation(request))) {
      return false;
    }

    const saved: GQLResponse<AddProjectFundingResponse> =
      await ProjectFunding.mutate<AddProjectFundingResponse>(
        request,
        {
          mutation: AddProjectFundingDocument,
          variables: {
            input: {
              projectId: this.project?.id,
              affiliationId: this.affiliation?.uri,
              status: this.status,
              funderProjectNumber: this.funderProjectNumber?.trim(),
              grantId: this.grantId?.trim(),
              funderOpportunityNumber: this.funderOpportunityNumber?.trim(),
            },
          },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = saved?.data?.addProjectFunding;
    this.processGQLResponse(saved, data as ProjectFunding, 'create ProjectFunding');
    return !this.hasErrors();
  }

  /**
   * Update the project funding information
   *
   * @param request the Fastify request
   * @returns true if successful. If not, the error object will have messages
   */
  async update(
    request: FastifyRequest
  ): Promise<boolean> {
    if (!(await this.ensureFunderAffiliation(request))) {
      return false;
    }

    const saved: GQLResponse<UpdateProjectFundingResponse> =
      await ProjectFunding.mutate<UpdateProjectFundingResponse>(
        request,
        {
          mutation: UpdateProjectFundingDocument,
          variables: {
            input: {
              projectFundingId: this.id,
              status: this.status,
              funderProjectNumber: this.funderProjectNumber?.trim(),
              grantId: this.grantId?.trim(),
              funderOpportunityNumber: this.funderOpportunityNumber?.trim(),
            },
          },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = saved?.data?.updateProjectFunding;
    this.processGQLResponse(saved, data as ProjectFunding, 'update ProjectFunding');
    return !this.hasErrors();
  }

  /**
   * Remove the funding information
   *
   * @param request the Fastify request
   * @returns true if successful. If not, the error object will have messages
   */
  async delete(
    request: FastifyRequest
  ): Promise<boolean> {
    const deleted: GQLResponse<RemoveProjectFundingResponse> =
      await ProjectFunding.mutate<RemoveProjectFundingResponse>(
        request,
        {
          mutation: RemoveProjectFundingDocument,
          variables: { projectFundingId: this.id },
          errorPolicy: "all",
        } as MutateOptions
      );

    const data = deleted?.data?.removeProjectFunding;
    this.processGQLResponse(deleted, data as ProjectFunding, 'delete ProjectFunding');
    return !this.hasErrors();
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
          (funding: ProjectFunding): ProjectFunding =>
            new ProjectFunding(funding)
        )
      : [];
  }

  /**
   * Ensure that the funder has been persisted to the DB
   *
   * @param request the Fastify Request
   * @returns true if the affiliation is valid. If not, the funding error object
   * will have messages
   */
  private async ensureFunderAffiliation(
    request: FastifyRequest
  ): Promise<boolean> {
    if (!this.affiliation?.uri) {
      this.errors.affiliationId = 'Funding affiliation URI is required';
      return false;
    }

    if (!this.affiliation.id) {
      const existing = await Affiliation.findByURI(request, this.affiliation.uri);
      if (existing?.id) {
        this.affiliation = existing;
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

