import { FastifyRequest } from "fastify";
import { BaseGraphQLModel, GQLResponse } from "./gqlHelper.js";
import {
  AddProjectDocument,
  ArchiveProjectDocument, MyProjectsDocument,
  ProjectDocument,
  UpdateProjectDocument,
} from "../generated/graphql.js"
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { DMPToolDMPType } from "@dmptool/types";
import { isValidDate } from "@dmptool/utils";
import { ProjectMember } from "./ProjectMember.js";
import { Plan } from "./Plan.js";
import { stringToInteger } from "../utils.js";

/**
 * Represents a Research Project
 */
export interface ProjectInterface {
  id: number;
  title: string;
  abstractText?: string;
  endDate?: string;
  startDate?: string;
  researchDomainId?: string;
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  plans: Plan[];
  members: ProjectMember[];
  errors?: Record<string, string>;
}

/**
 * Representation of the GraphQL query response for a Research Project
 */
export interface ProjectResponse {
  project: ProjectInterface
}

/**
 * Representation of the GraphQL query response for adding a Project
 */
export interface AddProjectResponse {
  addProject: ProjectInterface
}

/**
 * Representation of the GraphQL query response for updating a Project
 */
export interface UpdateProjectResponse {
  updateProject: ProjectInterface
}

/**
 * Representation of the GraphQL query response for deleting a Project
 */
export interface ArchiveProjectResponse {
  archiveProject: ProjectInterface
}

/**
 * Representation of a GraphQL query response to get all the caller's Projects
 */
export interface CallerProjectResponse {
  myProjects: {
    items: ProjectInterface[]
  };
}

/**
 * A research project
 */
export class Project extends BaseGraphQLModel {
  title: string;
  abstractText?: string;
  researchDomainId?: string;
  startDate?: string;
  endDate?: string;
  plans: Plan[] = [];
  members: ProjectMember[] = [];

  constructor(options: Partial<Project> = {}) {
    super(options);

    this.title = options.title ?? 'Research Project';
    this.abstractText = options.abstractText;
    this.researchDomainId = options.researchDomainId;
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.plans = options.plans ?? [];
    this.members = options.members ?? [];

    this.errors = options.errors ?? {};
  }

  /**
   * Get the primary contact from the project members/contributors
   */
  primaryContact(): ProjectMember | undefined {
    return this.members.find((m: ProjectMember): boolean => m.isPrimaryContact ?? false);
  }

  /**
   * Set project ownership
   *
   * @param request the Fastify request
   * @param contact the primary contact on the maDMP record
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async setOwnership(
    request: FastifyRequest,
    contact: ProjectMember
  ): Promise<boolean> {
    // TODO: Once we've implemented OAuth and the caller is not necessarily the owner
    //       use the designated primary contact as the primary owner of the project
    return true;
  }

  /**
   * Shortcut helper function to save or update the current Project
   *
   * @param request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async save(request: FastifyRequest): Promise<boolean> {
    return this.id ? await this.update(request) : await this.create(request);
  }

  /**
   * Create the current Project
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<AddProjectResponse> = await Project.mutate<AddProjectResponse>(
      request,
      {
        mutation: AddProjectDocument,
        variables: {
          title: this.title,
          isTestProject: false
        },
        errorPolicy: "all"
      } as MutateOptions
    );

    const data: ProjectInterface | undefined = saved?.data?.addProject;
    // Process any errors that may have occurred
    this.handleMutationErrors("create", saved, saved?.data?.addProject?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Project.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      const primary: ProjectMember | undefined = this.primaryContact();
      if (primary && !(await this.setOwnership(request, primary))){
        this.errors.general = "Project was created but there was an issue setting ownership to the primary contact.";
      }

      // Sync the local object with the saved data
      this.id = data.id;
      this.created = data.created;
      this.createdById = data.createdById;
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }
    return !hadErrors;
  }

  /**
   * Update the current Project
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async update(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<UpdateProjectResponse> = await Project.mutate<UpdateProjectResponse>(
      request,
      {
        mutation: UpdateProjectDocument,
        variables: {
          input: {
            id: this.id,
            title: this.title,
            abstractText: this.abstractText?.trim(),
            startDate: this.startDate?.trim(),
            endDate: this.endDate?.trim(),
            researchDomainId: this.researchDomainId,
            isTestProject: true
          }
        },
        errorPolicy: "all"
      } as MutateOptions
    );

    const data: ProjectInterface | undefined = saved?.data?.updateProject;
    // Process any errors that may have occurred
    this.handleMutationErrors("update", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Project.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
      this.errors = data.errors ?? {};
    }

    return !hadErrors;
  }

  /**
   * Delete this project
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async delete(request: FastifyRequest): Promise<boolean> {
    const deleted: GQLResponse<ArchiveProjectResponse> = await Project.mutate<ArchiveProjectResponse>(
      request,
      {
        mutation: ArchiveProjectDocument,
        variables: { projectIid: this.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: ProjectInterface | undefined = deleted?.data?.archiveProject;
    // Process any errors that may have occurred
    this.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Project.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    return !hadErrors;
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

    // 1st: we have a project id, see if it exists
    if (dmpProject?.project_id?.identifier) {
      const pathParts: string[] = dmpProject.project_id.identifier.split(/\/[a-zA-Z]+\/[0-9]+/);
      const projectId: string | undefined = pathParts.find((p: string) => p.startsWith("/projects/"))

      if (projectId) {
        const id: number | undefined = stringToInteger(projectId.replace("/projects/", ""));
        const found: Project | undefined = await Project.findById(request, id ?? 0);
        if (found) return found;
      }
    }

    // 2nd: Fetch the caller's projects and see if any titles match
    const title: string = dmpProject?.title?.trim() ?? dmp.title.trim();
    const existingProjects: Project[] = await Project.callerProjects(request);

    if (Array.isArray(existingProjects) && existingProjects.length > 0) {
      const existing: Project | undefined = existingProjects.find((project: Project): boolean => {
        return project.title === title;
      });

      if (existing && existing.id) {
        // We found an existing one, so go fetch all of its information
        request.log.debug(`Found existing project with id ${existing.id}`);
        const fullProject: Project | undefined = await Project.findById(request, existing.id ?? "0");
        if (fullProject) return fullProject;
      }
    }

    // We didn't find an existing Project, so initialize one
    request.log.debug({ title }, `Initializing a new project`);
    return new Project({
      title: title,
      abstractText: dmpProject?.description?.trim() ?? dmp.description?.trim() ?? null,
      endDate: isValidDate(dmpProject?.end) ? dmpProject.end : null,
      startDate: isValidDate(dmpProject?.start) ? dmpProject.start : null,
      researchDomainId: dmp.research_domain?.research_domain_identifier || null
    });
  }

  /**
   * Find the caller's projects'
   * @param request the Fastify request
   * @returns the id and title for each project
   */
  static async callerProjects(request: FastifyRequest): Promise<Project[]> {
   const resp: GQLResponse<CallerProjectResponse> = await this.query<CallerProjectResponse>(request, {
     query: MyProjectsDocument,
     errorPolicy: "all"
   });
   return resp.data && Array.isArray(resp.data.myProjects.items)
     ? resp.data.myProjects.items.map((item: ProjectInterface) => new Project(item))
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
