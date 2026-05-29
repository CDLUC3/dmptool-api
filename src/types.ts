// Add our config to the FastifyInstance and FastifyRequest
import { LogLevel } from "fastify";
import { ApolloClient } from "@apollo/client";
import { DMPToolDMPType } from "@dmptool/types";
import {
  ConnectionParams,
  DynamoConnectionParams,
  SsmConnectionParams
} from "@dmptool/utils";

/**
 * Add our additional properties to the FastifyInstance and FastifyRequest
 */
declare module 'fastify' {
  export interface FastifyInstance {
    dmptoolConfig: ConfigurationOptions;
  }

  export interface FastifyRequest {
    dmptoolConfig: ConfigurationOptions;
    graphQLClient?: ApolloClient;
    caller?: string;
  }
}

/**
 * The structure of an API error
 */
export interface ApiError {
  status_code: number;
  error_code: string;
  error_message: string;
}

/**
 * The structure of the GraphQL parameters
 */
export interface GraphQLParams {
  uri: string;
}

/**
 * The structure of the configuration options for this API
 */
export interface ConfigurationOptions {
  nodeEnv: string;
  deploymentEnv: string;
  logLevel: LogLevel;

  pathPrefixes: {
    v3: string;
  }

  port: number;

  applicationName: string;
  defaultCaller: string;

  domainWithProtocol: string;
  domainName: string;

  jwtSecret: string;
  jwtCookieName?: string;

  dmpIdBaseUrl: string;
  dmpIdShoulder: string;

  payloadSizeLimit: number;

  narrativeDownloadDomain: string;
  narrativeDownloadPort: number;

  landingPageDomain: string;
  landingPagePort: number;

  graphQL?: GraphQLParams;
  rds?: ConnectionParams;
  dynamo?: DynamoConnectionParams;
  ssm?: SsmConnectionParams;
}

/**
 * A Plan the User has access to
 */
export interface AccessiblePlan {
  id: number,
  dmpId: string,
  accessLevel: string,
}

/**
 * A snippet of a Plan's data
 */
export interface Plan {
  id: number,
  dmpId: string,
  modified: string,
  visibility: string,
}

/**
 * The structure of a User
 */
export interface User {
  id?: number;
  email?: string;
  role?: string;
  affiliationId?: string;
}

/**
 * Shortcuts to different segments of the maDMP record
 */
export type IdentifiersType = DMPToolDMPType['dmp']['alternate_identifier'];
export type IdentifierType = DMPToolDMPType['dmp']['dmp_id'];
export type AffiliationType = DMPToolDMPType['dmp']['contact']['affiliation'];
export type AffiliationIdType =AffiliationType['affiliation_id'][0];
export type ContactType = DMPToolDMPType['dmp']['contact'];
export type ContributorsType = DMPToolDMPType['dmp']['contributor'];
export type ContributorType = DMPToolDMPType['dmp']['contributor'][0];
export type ProjectsType = DMPToolDMPType['dmp']['project'];
export type ResearchDomainType = DMPToolDMPType['dmp']['research_domain'];
export type AlternateIdentifiersType = DMPToolDMPType['dmp']['alternate_identifier'];
export type AlternateIdentifierType = AlternateIdentifiersType[0];
