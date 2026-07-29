import { BaseGraphQLModel } from "./BaseGQL.js";
import { ProjectFundingStatus, EntirePlanFundingFragment } from "../generated/graphql.js";
import { DMPToolDMPType } from "@dmptool/types";
import { FundingType, ProjectType } from "../types.js";

/**
 * The shape of a project funding within a GraphQL query response
 */
export interface ProjectFundingQueryResponse {
  id?: number;
  affiliation?: {
    uri: string;
  }
  status?: string;
  funderProjectNumber?: string;
  funderOpportunityNumber?: string;
  grantId?: string;
}

/**
 * Converts a maDMP funding_status value into a ProjectFundingStatus for the DMP Tool
 *
 * @param maDMPStatus the maDMP funding_status
 * @returns a ProjectFundingStatus value
 */
const maDMPFundingStatusToProjectFundingStatus = (
  maDMPStatus: string
): ProjectFundingStatus => {
  switch (maDMPStatus) {
    case "granted":
      return "GRANTED";
    case "rejected":
      return "DENIED";
    default:
      return "PLANNED";
  }
}

/**
 * Represents funding information for a Project
 */
export class ProjectFunding extends BaseGraphQLModel {
  projectId?: number;
  affiliationId: string;
  status?: ProjectFundingStatus;
  funderProjectNumber?: string;
  grantId?: string;
  funderOpportunityNumber?: string;

  constructor(options: Partial<ProjectFunding> = {}) {
    super(options);

    if (!options.affiliationId) {
      throw new Error("affiliationId is required");
    }

    this.projectId = options.projectId;
    this.affiliationId = options.affiliationId;
    this.status = options.status;
    this.funderProjectNumber = options.funderProjectNumber;
    this.grantId = options.grantId;
    this.funderOpportunityNumber = options.funderOpportunityNumber;
    this.errors = options.errors ?? {};
  }

  /**
   * Response the shape of the project funding within a GraphQL query response
   * @returns a new ProjectFunding object
   */
  static fromGraphQL(graphQLResponse: ProjectFundingQueryResponse): ProjectFunding {
    return new ProjectFunding({
      id: graphQLResponse.id,
      affiliationId: graphQLResponse.affiliation?.uri,
      status: graphQLResponse.status ? maDMPFundingStatusToProjectFundingStatus(graphQLResponse.status) : undefined,
      funderProjectNumber: graphQLResponse.funderProjectNumber,
      grantId: graphQLResponse.grantId,
      funderOpportunityNumber: graphQLResponse.funderOpportunityNumber
    });
  }

  /**
   * Convert the ProjectFunding object into the expected GraphQL input
   *
   * @returns the answer's info as an EntirePlanFundingFragment for GraphQL
   */
  toGraphQLInput(): EntirePlanFundingFragment {
    return {
      projectFundingId: this.id,
      funder: this.affiliationId,
      status: this.status,
      funderProjectNumber: this.funderProjectNumber,
      funderOpportunityNumber: this.funderOpportunityNumber,
      grantId: this.grantId,
    };
  }

  /**
   * Convert a maDMP ProjectFunding entry
   *
   * @param maDMP the maDMP record
   * @param currentFunding the current list of ProjectFunding objects
   * @returns an array of ProjectFunding objects
   */
  static reconcileFromMaDMP(
    maDMP: DMPToolDMPType['dmp'],
    currentFunding: ProjectFunding[] = []
  ): ProjectFunding[] {
    if (!maDMP.project || !maDMP.project[0] || !maDMP.project[0].funding) {
      return [];
    }

    const newFunding: (ProjectFunding | undefined)[] = [];
    const maDMPProject: ProjectType = maDMP.project[0];

    // Gather all the project numbers from the maDMP
    const projectNumbers: Map<string, string> = new Map<string, string>();
    for (const projectNumber of maDMP.funder_project || []) {
      if (projectNumber
        && projectNumber.funder_id && projectNumber.funder_id.identifier
        && projectNumber.project_identifier && projectNumber.project_identifier.identifier
      ) {
        projectNumbers.set(
          projectNumber.funder_id.identifier.toLowerCase().trim(),
          projectNumber.project_identifier.identifier.trim()
        );
      }
    }

    // Gather all the project opportunities from the maDMP
    const opportunityNumbers: Map<string, string> = new Map<string, string>();
    for (const opportunityNumber of maDMP.funder_opportunity || []) {
      if (opportunityNumber
        && opportunityNumber.funder_id && opportunityNumber.funder_id.identifier
        && opportunityNumber.opportunity_identifier && opportunityNumber.opportunity_identifier.identifier
      ) {
        opportunityNumbers.set(
          opportunityNumber.funder_id.identifier.toLowerCase().trim(),
          opportunityNumber.opportunity_identifier.identifier.trim()
        );
      }
    }

    // Find or initialize all other contributors
    const funding: FundingType[] = maDMPProject.funding ?? [];
    for (const entry of funding) {
      const current: ProjectFunding | undefined = currentFunding.find((funding: ProjectFunding): boolean => {
        return funding.affiliationId === entry.funder_id?.identifier?.trim();
      });

      const funderProjectNumber: string | undefined = projectNumbers
        .get(entry.funder_id?.identifier?.trim() ?? '') || undefined
      const funderOpportunityNumber: string | undefined = opportunityNumbers
        .get(entry.funder_id?.identifier?.trim() ?? '') || undefined

      // If the current funding is present, we are replacing it, so always return
      // a new object.
      newFunding.push(new ProjectFunding({
        id: current?.id,
        affiliationId: current?.affiliationId ?? entry.funder_id?.identifier?.trim(),
        status: entry.funding_status ? maDMPFundingStatusToProjectFundingStatus(entry.funding_status) : undefined,
        funderProjectNumber,
        funderOpportunityNumber,
        grantId: entry.grant_id?.identifier?.trim(),
      }));
    }

    return newFunding.filter((m): m is ProjectFunding => Boolean(m));
  }
}

