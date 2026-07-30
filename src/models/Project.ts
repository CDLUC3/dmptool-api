import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { isValidDate } from "@dmptool/utils";
import {
  EntirePlanProjectFragment,
  MyProjectsDocument,
  ProjectDocument,
} from "../generated/graphql.js"
import { stringToInteger } from "../utils.js";
import {ContactType, ProjectType} from "../types.js";
import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { ProjectMember, ProjectMemberQueryResponse } from "./ProjectMember.js";
import { ProjectFunding, ProjectFundingQueryResponse } from "./ProjectFunding.js";
import { ResearchDomain } from "./ResearchDomain.js";

/**
 * The shape of a Project within a GraphQL query response
 */
export interface ProjectQueryResponse {
  id?: number;
  title?: string;
  abstractText?: string;
  startDate?: string;
  endDate?: string;
  isTestProject?: boolean;
  researchDomain?: {
    uri?: string;
  }
  members?: ProjectMemberQueryResponse[];
  fundings?: ProjectFundingQueryResponse[];
}

/**
 * Representation of the GraphQL query response for a Research Project
 */
export interface ProjectResponse {
  project: Project
}

/**
 * Representation of a GraphQL query response to get all the caller's Projects
 */
export interface CallerProjectResponse {
  myProjects: {
    items: Project[]
  };
}

/**
 * A research project
 */
export class Project extends BaseGraphQLModel {
  title: string;
  abstractText?: string;
  startDate?: string;
  endDate?: string;
  researchDomainURI?: string;
  isTestProject: boolean;

  members: ProjectMember[] = [];
  funding: ProjectFunding[] = [];

  constructor(options: Partial<Project> = {}) {
    super(options);

    this.title = options.title || 'Research Project';
    this.abstractText = options.abstractText;
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.researchDomainURI = options.researchDomainURI;
    this.isTestProject = options.isTestProject || false;

    this.members = options.members
      ? options.members.map((m: ProjectMember) => new ProjectMember(m))
      : [];

    this.funding = options.funding
      ? options.funding.map((f: ProjectFunding) => new ProjectFunding(f))
      : [];
  }

  /**
   * Convert a maDMP Project entry
   *
   * @param maDMP the maDMP record
   * @param currentProject the current Project
   * @returns a new Project object
   */
  static reconcileFromMaDMP(
    maDMP: DMPToolDMPType['dmp'],
    currentProject?: Project
  ): Project {
    const maDMPProject: ProjectType | undefined = maDMP.project?.[0];
    const members: ProjectMember[] = ProjectMember.reconcileFromMaDMP(maDMP, currentProject?.members);
    const funding: ProjectFunding[] = ProjectFunding.reconcileFromMaDMP(maDMP, currentProject?.funding);

    const researchDomainURI: string | undefined = maDMP.research_domain?.research_domain_identifier?.identifier;

    // If the current project is present, we are replacing it, so always return
    // a new object.
    return new Project({
      id: currentProject?.id,
      title: maDMPProject?.title?.trim() || maDMP.title,
      abstractText: maDMPProject?.description?.trim() || maDMP.description,
      startDate: maDMPProject?.start?.trim(),
      endDate: maDMPProject?.end?.trim(),
      isTestProject: currentProject?.isTestProject || false,
      researchDomainURI: researchDomainURI?.trim(),
      members,
      funding
    });
  }

  /**
   * Convert a project from a GraphQL query response
   *
   * @param graphQLResponse the shape of the project within a GraphQL query response
   * @returns a new Project object
   */
  static fromGraphQL(graphQLResponse: ProjectQueryResponse): Project {
    const members: ProjectMember[] = graphQLResponse.members
      ? graphQLResponse.members.map((member: ProjectMemberQueryResponse) => {
        return ProjectMember.fromGraphQL(member);
      })
      : [];
    const funding: ProjectFunding[] = graphQLResponse.fundings
      ? graphQLResponse.fundings.map((f: ProjectFundingQueryResponse) => {
        return ProjectFunding.fromGraphQL(f);
      })
      : [];

    return new Project({
      id: graphQLResponse.id,
      title: graphQLResponse.title,
      abstractText: graphQLResponse.abstractText,
      startDate: graphQLResponse.startDate,
      endDate: graphQLResponse.endDate,
      isTestProject: graphQLResponse.isTestProject,
      researchDomainURI: graphQLResponse.researchDomain?.uri,
      members,
      funding
    });
  }

  /**
   * Convert the Project object into the expected GraphQL input
   *
   * @returns the answer's info as an EntirePlanProjectFragment for GraphQL
   */
  toGraphQLInput(): EntirePlanProjectFragment {
    return {
      title: this.title,
      abstractText: this.abstractText || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      isTestProject: this.isTestProject || false,
      researchDomainUrl: this.researchDomainURI || undefined,
    };
  }

  /**
   * Get the primary contact from the project members/contributors
   */
  primaryContact(): ProjectMember | undefined {
    return this.members.find((m: ProjectMember): boolean => m.isPrimaryContact || false);
  }

  /**
   * Set project ownership
   *
   * @param request the Fastify request
   * @param contact the primary contact on the maDMP record
   * @returns true if successful. If not, any errors are added to the error object
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setOwnership(request: FastifyRequest, contact: ContactType): Promise<boolean> {
    // TODO: Once we've implemented OAuth and the caller is not necessarily the owner
    //       use the designated primary contact as the primary owner of the project
    return true;
  }

  /**
   * Find the Project or initialize a new one
   *
   * @param request the Fastify request
   * @param dmp the maDMP metadata
   * @returns the project
   */
  static async findOrInitialize(request: FastifyRequest, dmp: DMPToolDMPType['dmp']): Promise<Project> {
    const dmpProject: DMPToolDMPType['dmp']['project'][0] = dmp.project?.[0];

    // 1st: If we have a project id, see if it exists. The DMP Tool sets the
    //      value of the project_id.identifier to match the UI path: /projects/<project_id>
    if (dmpProject?.project_id?.identifier) {
      const pathParts: string[] = dmpProject.project_id.identifier.split(/\/[a-zA-Z]+\/[0-9]+/);
      const projectId: string | undefined = pathParts.find((p: string) => p.startsWith("/projects/"))

      if (projectId) {
        const id: number | undefined = stringToInteger(projectId.replace("/projects/", ""));
        const found: Project | undefined = await Project.findById(request, id ?? 0);
        if (found) return found;
      }
    }

    return Project.reconcileFromMaDMP(dmp);
  }

  /**
   * Find the caller's projects (right now, this is just based on the user's JWT)
   *
   * @param request the Fastify request
   * @returns the id and title for each project
   */
  static async callerProjects(request: FastifyRequest): Promise<Project[]> {
    const resp: GQLResponse<CallerProjectResponse> = await this.query<CallerProjectResponse>(request, {
      query: MyProjectsDocument,
      errorPolicy: "all"
    });
    return resp.data && Array.isArray(resp.data.myProjects.items)
      ? resp.data.myProjects.items.map((item: Project) => new Project(item))
      : [];
  }

  /**
   * Find a project by its id
   *
   * @param request the Fastify request
   * @param id the Project's id
   * @returns the Project
   */
  static async findById(request: FastifyRequest, id: number): Promise<Project | undefined> {
    const resp: GQLResponse<ProjectResponse> = await this.query<ProjectResponse>(request, {
      query: ProjectDocument,
      variables: { projectId: id },
      errorPolicy: "all"
    });
    return resp.data?.project ? new Project(resp.data.project) : undefined;
  }
}
