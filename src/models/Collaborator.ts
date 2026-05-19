import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { ProjectInterface } from "./Project.js";
import { User } from "../types.js";
import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import MutateOptions = ApolloClient.MutateOptions;
import {
  AddProjectCollaboratorDocument,
  ProjectCollaboratorsDocument,
  RemoveProjectCollaboratorDocument,
  UpdateProjectCollaboratorDocument
} from "../generated/graphql.js";

/**
 * Represents a Collaborator
 */
export interface CollaboratorInterface {
  id: number;
  projectId: number;
  email: string;
  invitedById: number;
  userId: number;
  created: string;
  createdById: number;
  modified: string;
  modifiedById: number;
  errors?: Record<string, string>;
}

/**
 * The possible response for a Collaborators GraphQL query
 */
export interface CollaboratorsResponse {
  projectCollaborators: CollaboratorInterface[]
}

/**
 * Representation of the GraphQL query response for adding a Collaborator
 */
export interface AddCollaboratorResponse {
  addProjectCollaborator: CollaboratorInterface
}

/**
 * Representation of the GraphQL query response for updating a Collaborator
 */
export interface UpdateCollaboratorResponse {
  updateProjectCollaborator: CollaboratorInterface
}

/**
 * Representation of the GraphQL query response for deleting a Collaborator
 */
export interface DeleteCollaboratorResponse {
  removeProjectCollaborator: CollaboratorInterface
}

/**
 * Represents a Collaborator on a Data Management Plan
 */
export class Collaborator extends BaseGraphQLModel {
  project?: ProjectInterface;
  user?: User
  invitedBy?: User

  email?: string;
  accessLevel?: string;

  constructor(options: Partial<Collaborator> = {}) {
    super(options);

    this.project = options.project;
    this.user = options.user;
    this.invitedBy = options.invitedBy;
    this.email = options.email;
    this.accessLevel = options.accessLevel ?? 'OWN';
    this.errors = options.errors ?? {};
  }

  /**
   * Shortcut helper function to save or update the current Collaborator
   *
   * @param request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async save(request: FastifyRequest): Promise<boolean> {
    return this.id ? await this.update(request) : await this.create(request);
  }

  /**
   * Create the current Collaborator
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async create(request: FastifyRequest): Promise<boolean> {
    const saved: GQLResponse<AddCollaboratorResponse> = await Collaborator.mutate<AddCollaboratorResponse>(
      request,
      {
        mutation: AddProjectCollaboratorDocument,
        variables: {
          projectId: this.project?.id,
          email: this.email
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: CollaboratorInterface | undefined = saved?.data?.addProjectCollaborator;
    // Process any errors that may have occurred
    this.handleMutationErrors("create", saved, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Collaborator.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
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
   * Update the current Collaborator
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async update(request: FastifyRequest): Promise<boolean> {
    // First update the Plan title
    const saved: GQLResponse<UpdateCollaboratorResponse> = await Collaborator.mutate<UpdateCollaboratorResponse>(
      request,
      {
        mutation: UpdateProjectCollaboratorDocument,
        variables: {
          projectCollaboratorId: this.id,
          accessLevel: this.accessLevel
        },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: CollaboratorInterface | undefined = saved?.data?.updateProjectCollaborator;
    // Process any errors that may have occurred
    this.handleMutationErrors("update", saved, data?.errors);

    // If data was returned and we have no errors
    let hadErrors: boolean = Collaborator.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
      this.errors = data.errors ?? {};
    }

    return !hadErrors;
  }

  /**
   * Delete this Collaborator
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the errors object
   */
  async delete(request: FastifyRequest): Promise<boolean> {
    const deleted: GQLResponse<DeleteCollaboratorResponse> = await Collaborator.mutate<DeleteCollaboratorResponse>(
      request,
      {
        mutation: RemoveProjectCollaboratorDocument,
        variables: { projectCollaboratorId: this.id },
        errorPolicy: "all"
      } as MutateOptions
    );
    const data: CollaboratorInterface | undefined = deleted?.data?.removeProjectCollaborator;

    // Process any errors that may have occurred
    this.handleMutationErrors("delete", deleted, data?.errors);

    // If data was returned and we have no errors
    const hadErrors: boolean = Collaborator.hasErrors(data?.errors ?? {});
    if (data && !hadErrors) {
      // Sync the local object with the saved data
      this.modified = data.modified;
      this.modifiedById = data.modifiedById;
    }

    return !hadErrors;
  }

  /**
   * Find Collaborators by a Project id
   *
   * @param request the Fastify request
   * @param projectId the Project's id
   * @returns the Collaborators
   */
  static async findByProjectId(request: FastifyRequest, projectId: number): Promise<Collaborator[] | []> {
    const resp: GQLResponse<CollaboratorsResponse> = await this.query<CollaboratorsResponse>(
      request,
      {
        query: ProjectCollaboratorsDocument,
        variables: { projectId },
        errorPolicy: "all"
      }
    );

    return Array.isArray(resp.data?.projectCollaborators)
      ? resp.data.projectCollaborators.map((c: CollaboratorInterface): Collaborator => new Collaborator(c))
      : [];
  }
}
