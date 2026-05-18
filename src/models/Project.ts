import { FastifyRequest } from "fastify";
import { BaseGraphQLModel, GQLResponse } from "./gqlHelper.js";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import { DMPToolDMPType } from "@dmptool/types";
import { isValidDate } from "@dmptool/utils";
import { Plan } from "./Plan.js";
import { ProjectMember } from "./ProjectMember.js";
import { ResearchDomain } from "./ResearchDomain.js";
import { stringToInteger } from "../utils.js";
import { ContactType } from "../types.js";
import {
  AddProjectDocument,
  ArchiveProjectDocument, MyProjectsDocument,
  ProjectDocument,
  UpdateProjectDocument,
} from "../generated/graphql.js"

/**
 * Represents a Research Project
 */
export interface ProjectInterface {
  id: number;
  title: string;
  abstractText?: string;
  endDate?: string;
  startDate?: string;
  researchDomain?: ResearchDomain;
  isTestProject: boolean;
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
  researchDomain?: ResearchDomain;
  startDate?: string;
  endDate?: string;
  isTestProject: boolean;
  plans: Plan[] = [];
  members: ProjectMember[] = [];

  constructor(options: Partial<Project> = {}) {
    super(options);

    this.title = options.title ?? 'Research Project';
    this.abstractText = options.abstractText;
    this.researchDomain = options.researchDomain ? new ResearchDomain(options.researchDomain) : undefined;
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.isTestProject = options.isTestProject ?? false;
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
   * @returns true if successful. If not, any errors are added to the error object
   */
  async setOwnership(
    request: FastifyRequest,
    contact: ContactType
  ): Promise<boolean> {
    // TODO: Once we've implemented OAuth and the caller is not necessarily the owner
    //       use the designated primary contact as the primary owner of the project
    return true;
  }

  /**
   * Shortcut helper function to save or update the current Project
   *
   * @param request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async save(request: FastifyRequest): Promise<boolean> {
    if (!this.id) {
      // We always update after creation because that only sets the Project title
      // and whether it's a test project.
      if (await this.create(request)) {
        return await this.update(request);
      }
    }

    return await this.update(request);
  }

  /**
   * Create the current Project
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    // Create the project and let the Apollo server set default values for the majority of fields
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

      // We are eventually going to want to figure out how to let a system create
      // a project on a user's behalf, so adding this stub function for now as
      // a placeholder for where we will eventually implement that.
      if (primary && !(await this.setOwnership(request, primary))){
        this.errors.general = "Project was created but we were unable to set ownership.";
      }

      // Sync the local object with the saved data
      this.id = data.id;
      this.created = data.created;
      this.createdById = data.createdById;
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    // Now that the project has been created, we need to set its other properties,
    // the ones that Apollo sets by default, or we're not allowed to send in the
    // mutation to create the project.
    return hadErrors ? false : await this.update(request);
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
            researchDomainId: this.researchDomain?.id,
            isTestProject: this.isTestProject ?? false
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

    // 2nd: No project id matched, so fetch the caller's projects and see if any
    //      titles match.
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

    // We didn't find an existing Project, so initialize a new one
    request.log.debug({ title }, `Initializing a new project`);

    // Fetch the research domain (we only accept known domains at this time)
    const domain: ResearchDomain | undefined = await ResearchDomain.findByURI(
      request,
      dmp.research_domain?.research_domain_identifier?.identifier
    )
    return new Project({
      title: title,
      abstractText: dmpProject?.description?.trim() ?? dmp.description?.trim() ?? null,
      endDate: isValidDate(dmpProject?.end) ? dmpProject.end : null,
      startDate: isValidDate(dmpProject?.start) ? dmpProject.start : null,
      researchDomain: domain,
      isTestProject: false
    });
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
