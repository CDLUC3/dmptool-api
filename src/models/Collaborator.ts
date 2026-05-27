import { BaseGraphQLModel, GQLResponse } from "./BaseGQL.js";
import { User } from "../types.js";
import { FastifyRequest } from "fastify";
import { ApolloClient } from "@apollo/client";
import { Project } from "./Project.js";
import MutateOptions = ApolloClient.MutateOptions;
import {
  AddProjectCollaboratorDocument,
  ProjectCollaboratorsDocument,
  RemoveProjectCollaboratorDocument,
  UpdateProjectCollaboratorDocument
} from "../generated/graphql.js";

/**
 * The possible response for a Collaborators GraphQL query
 */
export interface CollaboratorsResponse {
  projectCollaborators: Collaborator[]
}

/**
 * Representation of the GraphQL query response for adding a Collaborator
 */
export interface AddCollaboratorResponse {
  addProjectCollaborator: Collaborator
}

/**
 * Representation of the GraphQL query response for updating a Collaborator
 */
export interface UpdateCollaboratorResponse {
  updateProjectCollaborator: Collaborator
}

/**
 * Representation of the GraphQL query response for deleting a Collaborator
 */
export interface DeleteCollaboratorResponse {
  removeProjectCollaborator: Collaborator
}

/**
 * Represents a Collaborator on a Data Management Plan
 */
export class Collaborator extends BaseGraphQLModel {
  project?: Project;
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
  }

  /**
   * Shortcut helper function to save or update the current Collaborator
   *
   * @param request
   * @returns true if successful. If not, any errors are added to the error object
   */
  async save(request: FastifyRequest): Promise<boolean> {
    return this.id ? await this.update(request) : await this.create(request);
  }

  /**
   * Create the current Collaborator
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
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
    const data: Collaborator | undefined = saved?.data?.addProjectCollaborator;
    this.processGQLResponse(saved, data as Collaborator, 'create ProjectCollaborator');
    return !this.hasErrors();
  }

  /**
   * Update the current Collaborator
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
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
    const data: Collaborator | undefined = saved?.data?.updateProjectCollaborator;
    this.processGQLResponse(saved, data as Collaborator, 'update ProjectCollaborator');
    return !this.hasErrors();
  }

  /**
   * Delete this Collaborator
   *
   * @param request the Fastify request
   * @returns true if successful. If not, any errors are added to the error object
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
    const data: Collaborator | undefined = deleted?.data?.removeProjectCollaborator;

    this.processGQLResponse(deleted, data as Collaborator, 'delete ProjectCollaborator');
    return !this.hasErrors();
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
      ? resp.data.projectCollaborators.map((c: Collaborator): Collaborator => new Collaborator(c))
      : [];
  }
}
