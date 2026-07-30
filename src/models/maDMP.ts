import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { AccessiblePlan, ConfigurationOptions, Plan, User } from "../types.js";
import {
  ConnectionParams,
  createDMP,
  DMP_LATEST_VERSION,
  DynamoConnectionParams,
  EnvironmentEnum,
  getDMPs,
  planToDMPCommonStandard,
  queryTable, randomHex,
  updateDMP
} from "@dmptool/utils";

/**
 * Generate a unique DMP ID for a Plan.
 *
 * @param request the Fastify request
 * @returns the unique DMP ID
 */
export async function generateDMPId(request: FastifyRequest): Promise<string> {
  const dmpIdPrefix = `${request.dmptoolConfig.dmpIdBaseUrl}${request.dmptoolConfig.dmpIdShoulder}`;
  let id = randomHex(8);
  let i = 0;

  // Check if the ID already exists up to 5 times
  while (i < 5) {
    const dmpId = `${dmpIdPrefix}${id}`;
    const sql = `SELECT dmpId FROM plans WHERE dmpId = ?`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: { results: any[], fields: any[] } = await queryTable(
      request.dmptoolConfig.rds as ConnectionParams,
      sql,
      [dmpId]
    );

    if (Array.isArray(resp.results) && resp.results.length <= 0) {
      return dmpId;
    }
    id = randomHex(16);
    i++;
  }

  request.log.fatal('Unable to generate a unique DMP ID.');
  return `TEMP-API${id}`;
}

/**
 * Determines if the user has permission to access the entirety of the metadata
 *
 * @param data The maDMP record for the DMP
 * @param userDMPs The list of DMPs the user has access to
 * @param user The user making the request
 * @returns true if the user has permission to download the narrative
 */
export function userHasPermission(
  data: DMPToolDMPType,
  userDMPs: AccessiblePlan[],
  user: User
): boolean {
  // The full metadata and narrative are always available for Public plans
  if (data?.dmp?.privacy === "public") return true;

  // Otherwise a user is required, so bail out if it's not present
  if (!user) return false;

  // SuperAdmins can always access DMP narratives
  if (user?.role === "SUPERADMIN") return true;

  const affiliations = [data.dmp.contact?.affiliation[0]?.affiliation_id?.identifier];

  // Now collect all the contributors
  if (Array.isArray(data.dmp.contributor)) {
    affiliations.push(...data.dmp.contributor.map((c: DMPToolDMPType['dmp']['contributor']) => {
      return c?.affiliation[0]?.affiliation_id?.identifier;
    }));
  }

  // Admins can always access private DMP metadata and make changes to DMPs that
  // belong to their affiliation
  return (user?.role === "ADMIN" && affiliations.includes(user?.affiliationId))
    // Otherwise the user only has access to plans they are associated with
    || userDMPs?.some(d => d.dmpId === data?.dmp.dmp_id?.identifier);
}

/**
 * Determines if the calling system has permission to access the entirety of the metadata
 *
 * @param data The maDMP record for the DMP
 * @param callerDMPs The list of DMPs the user has access to
 * @param caller The system making the request
 * @returns true if the user has permission to download the narrative
 */
export function callerHasPermission(
  data: DMPToolDMPType,
  callerDMPs: AccessiblePlan[],
  caller: string
): boolean {
  // The full metadata and narrative are always available for Public plans
  if (data?.dmp?.privacy === "public") return true;

  // Otherwise a user is required, so bail out if it's not present
  if (!caller) return false;

  // Calling systems can access the private metadata and make changes to the DMP
  // if it is in their list of DMPs
  return callerDMPs?.some(d => d.dmpId === data?.dmp.dmp_id?.identifier);
}

/**
 * Load all the Plan ids and access levels from RDS for the user's email.'
 *
 * @param request the Fastify request
 * @returns the results from RDS
 */
export async function loadPlansForUser(
  request: FastifyRequest,
): Promise<AccessiblePlan[]> {
  const user = request.user as User;
  if (!user) return [];

  // Fetch the list of DMPs the user has access to
  const sql = `
      SELECT DISTINCT p.id, p.dmpId, pcs.accessLevel
      FROM plans p
        INNER JOIN projects prj ON p.projectId = prj.id
          INNER JOIN projectCollaborators pcs ON prj.id = pcs.projectId
      WHERE prj.provenance = ?
      ORDER BY p.id;
    `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans: { results: any[], fields: any[] } = await queryTable(
    request.dmptoolConfig.rds as ConnectionParams,
    sql,
    [user?.email || ""]
  );
  return Array.isArray(plans.results) ? plans.results : [];
}

/**
 * Load all the Plan ids and access levels from RDS for the calling system
 *
 * @param request the Fastify request
 * @returns the results from RDS
 */
export async function loadPlansForCaller(
  request: FastifyRequest,
): Promise<AccessiblePlan[]> {
  if (!request.caller) return [];

  // Fetch the list of DMPs the user has access to
  const sql = `
      SELECT DISTINCT p.id, p.dmpId, pcs.accessLevel
      FROM plans p
        INNER JOIN projects prj ON p.projectId = prj.id
          INNER JOIN projectCollaborators pcs ON prj.id = pcs.projectId
      WHERE prj.provenance = ?
      ORDER BY p.id;
    `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans: { results: any[], fields: any[] } = await queryTable(
    request.dmptoolConfig.rds as ConnectionParams,
    sql,
    [request.caller || ""]
  );
  return Array.isArray(plans.results) ? plans.results : [];
}

/**
 * Load the Plan based on its dmpId from RDS.
 *
 * @param request the Fastify request
 * @param dmpId the Plan's dmpId
 * @returns the results from RDS
 */
export async function loadPlan(
  request: FastifyRequest,
  dmpId: string
): Promise<Plan | undefined> {
  const fullDmpId = `${request.dmptoolConfig.dmpIdBaseUrl}/${dmpId}`;
  // Fetch the list of DMPs the user has access to
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans: { results: any[], fields: any[] } = await queryTable(
    request.dmptoolConfig.rds as ConnectionParams,
    'SELECT id, dmpId, modified, visibility FROM plans WHERE dmpId = ?',
    [fullDmpId]
  );
  return Array.isArray(plans.results) ? plans.results[0] : undefined;
}


/**
 * Helper function to fetch a mADMP from Dynamo based on the DMP id
 *
 * @param request the Fastify request
 * @param dmpId the DMP id to fetch
 * @param version the version of the DMP to fetch (default: latest)
 * @returns the results from DynamoDB
 */
export async function loadMaDMPFromDynamo(
  request: FastifyRequest,
  dmpId: string,
  version: string = DMP_LATEST_VERSION
): Promise<DMPToolDMPType | undefined> {
  const config: ConfigurationOptions = request.dmptoolConfig;
  request.log.debug(`Fetching maDMP record for ${dmpId} from DynamoDB`);
  // Fetch the Plan's latest maDMP JSON from the DynamoDB Table
  const data: DMPToolDMPType[] = await getDMPs(
    config.dynamo as DynamoConnectionParams,
    `${config.landingPageDomain}:${config.landingPagePort}`,
    dmpId,
    version,
    true
  );
  const hasNarrative = Array.isArray(data) && data[0]?.dmp?.narrative !== undefined;
  request.log.debug(`Fetched maDMP record for ${dmpId}. Has narrative? ${hasNarrative}`);
  return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
}

/**
 * Helper function to persist the maDMP record in DynamoDB
 *
 * @param request the Fastify request
 * @param domainName The domain name to use for generating links
 * @param dmpId The DMP id to fetch
 * @param maDMP The maDMP record to persist
 * @param wasJustOutdated Whether the record already existed in the DynamoDB table
 */
export async function persistMaDMPRecord(
  request: FastifyRequest,
  domainName: string,
  dmpId: string,
  maDMP: DMPToolDMPType,
  wasJustOutdated = false,
): Promise<void> {
  const config: ConfigurationOptions = request.dmptoolConfig;
  // If the DynamoDB did have a maDMP record for the plan, then we need to update it
  if (wasJustOutdated) {
    await updateDMP(
      config.dynamo as DynamoConnectionParams,
      `${config.landingPageDomain}:${config.landingPagePort}`,
      dmpId,
      maDMP,
      100, // Use a short grace period since it was missing
      false // We don't need the extensions returned
    );

    // Otherwise, we need to create the initial maDMP record for the plan
  } else {
    await createDMP(
      request.dmptoolConfig.dynamo as DynamoConnectionParams,
      domainName,
      dmpId,
      maDMP,
      DMP_LATEST_VERSION,
      false // We don't need the extensions returned
    );
  }
}

/**
 * If the DynamoDB table did not have a maDMP record for the plan OR
 * the Plan's modified timestamp does not match the DynamoDB record's
 * modified timestamp, then we should generate the maDMP record
 *
 * @param request the Fastify request
 * @param plan The Plan to generate the maDMP record for
 * @param wasJustOutdated Whether the Plan was just updated and is now outdated
 * @returns The maDMP record generated from the Plan's data'
 */
export async function handleMissingMaDMP(
  request: FastifyRequest,
  plan: Plan,
  wasJustOutdated: boolean
): Promise<DMPToolDMPType | undefined> {
  const config: ConfigurationOptions = request.dmptoolConfig;
  if (!request.dmptoolConfig.rds) {
    request.log.error("RDS connection is not configured");
    throw new Error("Unable to generate maDMP record. Please try again later.");
  }

  // Generate the maDMP record from the Plan's data
  const maDMP = await planToDMPCommonStandard(
    config.rds as ConnectionParams,
    request.dmptoolConfig.applicationName,
    `${config.landingPageDomain}:${config.landingPagePort}`,
    config.deploymentEnv as EnvironmentEnum,
    plan.id,
    true
  );

  if (maDMP && maDMP.dmp) {
    // Persist the maDMP record to the DynamoDB table
    await persistMaDMPRecord(
      request,
      `${config.landingPageDomain}:${config.landingPagePort}`,
      plan.dmpId,
      maDMP,
      wasJustOutdated,
    );
  }
  return maDMP;
}

export const maDMPHelpers = {
  loadPlan,
  loadMaDMPFromDynamo,
  handleMissingMaDMP,
};
