import { Logger } from 'pino';
import { FastifyInstance } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { ConfigurationOptions } from "../types.js";
import {
  createDMP,
  DMP_LATEST_VERSION,
  getDMPs,
  queryTable,
  randomHex,
} from '@dmptool/utils';

/**
 * This is a placeholder for now.
 *
 * It may be used in the future to convert the maDMP JSON records to the Rails
 * system's MySQL database tables.
 *
 * Leaving it in place until a decision is made on whether we want to go this route.
 */


/*
 * Bitflag conversion for Contributor Roles
 * 1: data_curation,
 * 2: investigation,
 * 3: data_curation + investigation
 * 4: project_administration,
 * 5: data_curation + project_administration
 * 6: investigation + project_administration
 * 7: data_curation + investigation + project_administration
 * 8: other
 * 9: data_curation + other
 * 10: investigation + other
 * 11: data_curation + investigation + other
 * 12: project_administration + other
 * 13: data_curation + project_administration + other
 * 14: investigation + project_administration + other
 * 15: data_curation + investigation + project_administration + other
 */
// Convert a Rails BitFlag Role id to a maDMP roles array
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const railsRoleToMaDMPRoles = (role: number): string[] => {
  const roles: string[] = [];

  if ([1, 3, 5, 7, 9, 11, 13, 15].includes(role)) {
    roles.push('https://credit.niso.org/contributor-roles/data-curation/');
  }
  if ([2, 3, 6, 7, 10, 11, 14, 15].includes(role)) {
    roles.push('https://credit.niso.org/contributor-roles/investigation/');
  }
  if ([4, 5, 6, 7, 12, 13, 14, 15].includes(role)) {
    roles.push('https://credit.niso.org/contributor-roles/project-administration/');
  }
  if ([8, 9, 10, 11, 12, 13, 14, 15].includes(role)) {
    roles.push('http://dmptool.org/contributor_roles/other');
  }

  // Return the converted roles or default to "other"
  return roles.length > 0 ? roles : ['http://dmptool.org/contributor_roles/other'];
}

// Convert from maDMP roles array to a Rails numeric BitFlag value
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const maDMPRolesToRailsRole = (roles: string[]): number => {
  let role = 0;
  if (roles.includes('https://credit.niso.org/contributor-roles/data-curation/')) {
    role += 1;
  }
  if (roles.includes('https://credit.niso.org/contributor-roles/investigation/')) {
    role += 2;
  }
  if (roles.includes('https://credit.niso.org/contributor-roles/project-administration/')) {
    role += 4;
  }
  if (roles.includes('http://dmptool.org/contributor-roles/other')) {
    role += 8;
  }

  // Return the converted role or default to "other"
  return role > 0 ? role : 8;
}

// SQL Query to get the current plan, funder and template
const GET_CURRENT_PLAN_SQL = '\
  SELECT p.id AS plan_id, p.dmp_id, p.created_at, p.updated_at, l.abbreviation AS language, \
    p.org_id, COALESCE(ror.name, o.name) AS org_name, ror.ror_id AS org_ror, \
    p.template_id, t.title AS template_title, t.version AS template_version, \
    p.title AS plan_title, p.description AS plan_description, p.visibility AS plan_visibility, \
    p.funder_id, COALESCE(fror.name, fo.name) AS funder_name, fror.ror_id AS funder_ror, \
    p.funding_status, p.identifier AS opportunity_number, p.grant_id, gi.value AS grant_identifier, \
    p.research_domain_id, rd.label AS research_domain, p.start_date, p.end_date, \
    p.ethical_issues, p.ethical_issues_description, p.ethical_issues_report \
  FROM plans AS p \
    JOIN orgs AS o ON p.org_id = o.id \
      LEFT JOIN registry_orgs AS ror ON o.id = ror.org_id \
    JOIN languages AS l ON p.language_id = l.id \
    JOIN templates AS t ON p.template_id = t.id \
    LEFT JOIN orgs AS fo ON p.funder_id = fo.id \
      LEFT JOIN registry_orgs AS fror ON fo.id = fror.org_id \
    LEFT JOIN identifiers AS gi ON p.grant_id = gi.id \
    LEFT JOIN research_domains AS rd ON p.research_domain_id = rd.id \
  WHERE dmp_id = ?;';

// SQL Query to get the current contributors and contact for the plan
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GET_CURRENT_CONTRIBUTORS_SQL = '\
SELECT * FROM (\
  SELECT c.id, c.name COLLATE utf8mb3_unicode_ci AS name, c.email COLLATE utf8mb3_unicode_ci AS email, \
    c.org_id, COALESCE(ror.name COLLATE utf8mb3_unicode_ci, o.name) AS org_name, ror.ror_id AS org_ror, \
    i.value COLLATE utf8mb3_unicode_ci AS orcid, roles, \'contributor\' AS person_type, 0 AS priority \
  FROM plans AS p \
    JOIN contributors AS c ON p.id = c.plan_id \
      JOIN orgs AS o ON c.org_id = o.id \
        LEFT JOIN registry_orgs AS ror ON o.id = ror.org_id \
      LEFT JOIN identifiers AS i \
      ON c.id = i.identifiable_id AND i.identifiable_type = \'Contributor\' AND i.identifier_scheme_id = 1 \
  WHERE p.dmp_id = ? \
  \
  UNION ALL \
  \
  (SELECT u.id, TRIM(CONCAT(u.firstname, \' \', u.surname)) AS name, u.email, \
     u.org_id, COALESCE(ror.name COLLATE utf8mb3_unicode_ci, o.name) AS org_name, ror.ror_id AS org_ror, \
     i.value AS orcid, 8 AS roles, \'contact\' AS person_type, 1 AS priority \
   FROM plans AS p \
     JOIN roles AS r ON p.id = r.plan_id \
       JOIN users AS u ON r.user_id = u.id \
         JOIN orgs AS o ON u.org_id = o.id \
           LEFT JOIN registry_orgs AS ror ON o.id = ror.org_id \
         LEFT JOIN identifiers AS i \
         ON u.id = i.identifiable_id AND i.identifiable_type = \'User\' AND i.identifier_scheme_id = 1 \
   WHERE p.dmp_id = ? AND r.access in (14, 15) \
   ORDER BY r.access DESC, r.created_at ASC \
   LIMIT 1) \
) AS combined \
GROUP BY email -- Grouping by email collapses duplicates \
ORDER BY priority ASC; -- Priority helps us deduplicate by preferring the contact';

/**
 * Generate a new DMP ID for the plan.
 *
 * @param fastify The Fastify instance
 * @param publishable Whether the DMP ID should be publishable (a DOI)
 * @returns The new DMP ID
 */
const generateDMPId = async (
  fastify: FastifyInstance,
  publishable = false
): Promise<DMPToolDMPType['dmp']['dmp_id']> => {
  const dmpIdPrefix: string = publishable
    ? fastify.dmptoolConfig.dmpIdBaseUrl
    : `${fastify.dmptoolConfig.domainWithProtocol}/dmps`;

  let id = randomHex(8);
  let i = 0;

  // Check if the ID already exists up to 5 times
  while (i < 5) {
    const dmpId = `${dmpIdPrefix}${id}`;
    const sql = 'SELECT dmpId FROM plans WHERE dmpId = ?';
    const results = await executeMySQLQuery(
      fastify.log as Logger,
      fastify.dmptoolConfig,
      sql,
      [dmpId]
    );
    if (Array.isArray(results) && results.length <= 0) {
      return {
        identifier: dmpId,
        type: publishable ? 'doi' : 'url',
      };
    }
    id = randomHex(8);
    i++;
  }

  fastify.log.error(`Unable to generate a DMP ID! Using a temporary ID of TEMP-${id}.`);
  return { identifier: `TEMP-${id}`, type: 'other' };
}

/**
 * Persist a DMP to the Rails MySQL database
 *
 * @param fastify The Fastify instance
 * @param dmp The DMP to persist
 * @returns Whether the DMP was persisted successfully
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const persistMaDMPToMySQL = async (
  fastify: FastifyInstance,
  dmp: DMPToolDMPType
): Promise<boolean> => {
  const log = fastify.log as Logger;
  const config: ConfigurationOptions = fastify.dmptoolConfig;

  // Determine if we're creating or updating
  const vals: string[] = [dmp.dmp.dmp_id.identifier];
  const currentPlan = await executeMySQLQuery(log, config, GET_CURRENT_PLAN_SQL, vals);
  console.log(currentPlan);

  // Process the Plan

  // Process the Contributors

  // Search for a user to become the Plan owner

  // Process the narrative
  // Process the research outputs

  // Process the related identifiers
  return false;
}

/**
 * Execute a MySQL query
 *
 * @param logger the Fastify logger to use
 * @param fastifyConfig the configuration used by Fastify
 * @param sql the SQL query to execute
 * @param vals the values to use in the query
 * @returns the resultset of the query
 */
const executeMySQLQuery = async (
  logger: Logger,
  fastifyConfig: ConfigurationOptions,
  sql: string,
  vals: string[]
): Promise<{ results: unknown[], fields: unknown[] }> => {
  // If the logger is not provided, throw an error
  if (!logger) throw new Error('No logger provided');

  // If the RDS configuration is not provided, throw an error
  if (!fastifyConfig.rds) {
    logger.error('No RDS configuration provided');
    throw new Error('No RDS configuration provided');
  }

  const resp = await queryTable(fastifyConfig.rds, sql, vals)

  if (resp && Array.isArray(resp.results) && resp.results.length > 0) {
    logger.debug('It worked!', resp.results[0]);
  } else {
    logger.warn('No results found');
  }

  return { results: resp.results, fields: resp.fields };
}

/**
 * Get a DMP by its ID
 *
 * @param fastify the Fastify instance
 * @param dmpId the ID of the DMP to get
 * @param version the version of the DMP to get. Defaults to the latest version
 * @returns the DMP
 */
export const getMaDMP = async (
  fastify: FastifyInstance,
  dmpId: string,
  version = DMP_LATEST_VERSION
): Promise<DMPToolDMPType | undefined> => {
  // If there is no DynamoDB configuration, throw an error
  if (!fastify.dmptoolConfig.dynamo) {
    fastify.log.error('No DynamoDB configuration provided');
    throw new Error('Unable to process your request. Please try again later.');
  }

  // Always fetch from the DynamoDB table
  const dmps: DMPToolDMPType[] = await getDMPs(
    fastify.dmptoolConfig.dynamo,
    fastify.dmptoolConfig.domainName,
    dmpId,
    version,
    true
  );

  return dmps.length === 0 ? undefined : dmps[0];
}

/**
 * Create a DMP
 *
 * @param fastify the Fastify instance
 * @param dmp the DMP metadata
 * @returns the DMP
 */
export const createMaDMP = async (
  fastify: FastifyInstance,
  dmp: DMPToolDMPType
): Promise<DMPToolDMPType | undefined> => {
  // If there is no DynamoDB configuration, throw an error
  if (!fastify.dmptoolConfig.dynamo) {
    fastify.log.error('No DynamoDB configuration provided');
    throw new Error('Unable to process your request. Please try again later.');
  }

  // Move the incoming dmp_id to alternate_identifier (if applicable)
  dmp.dmp.alternate_identifier = dmp.dmp.dmp_id ? [dmp.dmp.dmp_id] : [];

  // Generate a new DMP ID (if the registered timestamp was included, it should be a DOI)
  dmp.dmp.dmp_id = await generateDMPId(fastify, !!dmp.dmp.registered);

  // Update the MySQL DB tables


  // Create the DynamoDB records
  return await createDMP(
    fastify.dmptoolConfig.dynamo,
    fastify.dmptoolConfig.domainName,
    dmp.dmp.dmp_id.identifier,
    dmp,
    DMP_LATEST_VERSION,
    true
  );
}

/**
 * Update a DMP
 *
 * @param fastify the Fastify instance
 * @param dmp the DMP metadata
 * @returns the DMP
 */
export const updateMaDMP = async (
  fastify: FastifyInstance,
  dmp: DMPToolDMPType
): Promise<DMPToolDMPType | undefined> => {
  // If there is no DynamoDB configuration, throw an error
  if (!fastify.dmptoolConfig.dynamo) {
    fastify.log.error('No DynamoDB configuration provided');
    throw new Error('Unable to process your request. Please try again later.');
  }

  // Fetch the latest version of the DMP from the DynamoDB table

  // Update the MySQL DB tables

  // Update the DynamoDB records
  return dmp;
}

/**
 * Delete a DMP by its ID
 *
 * @param fastify the Fastify instance
 * @param dmpId the ID of the DMP to get
 */
export const deleteMaDMP = async (
  fastify: FastifyInstance,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dmpId: string
): Promise<void> => {
  // If there is no DynamoDB configuration, throw an error
  if (!fastify.dmptoolConfig.dynamo) {
    fastify.log.error('No DynamoDB configuration provided');
    throw new Error('Unable to process your request. Please try again later.');
  }

  // Fetch the latest version of the DMP from the DynamoDB table

  // Delete or tomb-stone the MySQL DB tables

  // Delete or tomb-stone the DynamoDB records
  return;
}
