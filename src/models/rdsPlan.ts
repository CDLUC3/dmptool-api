import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import {
  ConnectionParams,
  LoadPlanInfo,
  LoadProjectInfo,
  LoadFundingInfo,
  LoadMemberInfo,
  LoadRelatedWorkInfo,
  queryTable,
} from "@dmptool/utils";
import {loadPlan} from "./maDMP.js";
import {Plan} from "../types.js";

interface MaDMPIdentifier {
  identifier: string;
  type: string;
}

interface LoadAffiliationInfo {
  id: number;
  affiliationId: number;
  name: string;
  displayName: string;
}

interface LoadNarrativeInfo {
  templateId: number;
  title: string;
  version: string;
}

interface PersistPlanResponse {
  id?: number;
  errors: string[];
}

/**
 * Helper function to fetch the user Id to use when creating/updating records in RDS
 *
 * @param request the Fastify request
 * @returns the id of the user associated with the request
 */
const getUserId = async (request: FastifyRequest): Promise<number> => {
  // TODO: Eventually this should either come from the request.user or a lookup of the user associated with caller
  const resp: { results: any[], fields: any[] } = await queryTable(
    request.dmptoolConfig.rds as ConnectionParams,
    'SELECT id FROM users WHERE role = ? ORDER BY id DESC LIMIT 1;',
    ['SUPERADMIN']
  );
  return resp && resp.results.length > 0 ? resp.results[0].id : 0;
}

/**
 * Helper function to fetch a Plan from RDS based on the alternate identifiers
 *
 * @param request the Fastify request
 * @param alternateIdentifiers the alternate identifiers for the DMP
 * @returns the Plan information from RDS
 */
const getPlanByAlternateIdentifier = async (
  request: FastifyRequest,
  alternateIdentifiers: MaDMPIdentifier[],
): Promise<LoadPlanInfo | undefined> => {
  if (!Array.isArray(alternateIdentifiers) || alternateIdentifiers.length === 0) return undefined;

  // Create placeholders for the SQL query for each alternate id
  const placeholders: string = alternateIdentifiers.map(() => '?').join(', ');
  const sql = `
    SELECT p.id, p.dmpId, p.projectId, p.versionedTemplateId,
           p.createdById, p.created, p.modifiedById, p.modified,
           p.title, p.status, p.visibility, p.featured,
           p.registeredBy, p.registered, p.languageId
    FROM alternateIdentifiers AS ai
      JOIN plans AS p ON ai.planId = p.id
    WHERE ai.identifier IN (${placeholders})
    ORDER BY p.id DESC;
  `;
  const params: string[] = alternateIdentifiers.map((id: MaDMPIdentifier) => id.identifier);
  const resp: { results: unknown[], fields: unknown[] } = await queryTable(
    request.dmptoolConfig.rds as ConnectionParams,
    sql,
    params
  );

  return Array.isArray(resp.results) && resp.results.length > 0
    ? resp.results[0] as LoadPlanInfo
    : undefined;
}

/**
 * Determine which VersionedTemplate record to use for the Plan
 */
const determineVersionedTemplate = async (
  request: FastifyRequest,
  maDMP: DMPToolDMPType,
): Promise<number | undefined> => {
  // Determine which VersionedTemplate to use for the Plan
  const template: DMPToolDMPType['dmp']['narrative']['template'] = maDMP.dmp.narrative?.template;
  if (template && template.id && !isNaN(template.id)) {
    const versionedTemplateId: number | undefined = await fetchVersionedTemplate(request, template.id);
    if (versionedTemplateId) return versionedTemplateId;
  }

  // If the versionedTemplate was not found, use the latest best practice template
  request.log.debug('maDMP does not have a valid template defined. Fetching the default.');
  return await getDefaultTemplate(request);
}

/**
 * Find the id of the latest published version of the template
 *
 * @param request the Fastify request
 * @param versionedTemplateId the template id specified in the maDMP
 * @returns the id of the latest published version of the template
 */
const fetchVersionedTemplate = async (
  request: FastifyRequest,
  versionedTemplateId: number,
): Promise<number | undefined> => {
  const config: ConnectionParams = request.dmptoolConfig.rds as ConnectionParams;

  // Fetch the record for the specified template id
  request.log.debug({ versionedTemplateId },'Looking up specified template.');
  const checkIdResp: { results: any[], fields: any[] } = await queryTable(
    config,
    'SELECT id, active, templateId FROM versionedTemplates WHERE id = ?;',
    [versionedTemplateId]
  );

  // If the template was not found
  if (!checkIdResp || checkIdResp.results.length === 0) {
    request.log.warn({ versionedTemplateId },'maDMP specified an unknown template');
    return undefined;
  }
  // If it was found and is the current active version
  if (checkIdResp.results[0].active) return versionedTemplateId;

  // Otherwise, get the current active version of the specified template
  request.log.debug({ versionedTemplateId },'maDMP specified an outdated template. Fetching latest version.');
  const getLatestResp: { results: any[], fields: any[] } = await queryTable(
    config,
    'SELECT id FROM versionedTemplates WHERE templateId = ? AND active = 1;',
    [checkIdResp.results[0].templateId]
  );
  return getLatestResp && getLatestResp.results[0] ? getLatestResp.results[0] : undefined;
}

/**
 * Helper function to fetch the default template id from RDS
 *
 * @param request the Fastify request
 * @returns the id of the default template
 */
const getDefaultTemplate = async (
  request: FastifyRequest
): Promise<number | undefined> => {
  const config: ConnectionParams = request.dmptoolConfig.rds as ConnectionParams;

  // Fetch the most recent published best practice template
  request.log.debug('Looking up default template.');
  const resp: { results: any[], fields: any[] } = await queryTable(
    config,
    'SELECT id FROM versionedTemplates WHERE bestPractice = 1 AND active = 1 ORDER BY id DESC LIMIT 1;',
    []
  );
  return !resp || resp.results.length === 0 ? undefined : resp.results[0].id;
}

/**
 * Helper function to create a Plan and all of its information in RDS
 *
 * @param request the Fastify request
 * @param maDMP the maDMP record to persist
 * @param userId the id of the user creating the Plan
 * @returns the id of the newly created Plan and any errors that occurred
 */
const createPlan = async (
  request: FastifyRequest,
  maDMP: DMPToolDMPType,
  userId: number
): Promise<PersistPlanResponse> => {
  const errors: string[] = [];

  // 1: Create the Project record
  const project: LoadProjectInfo | undefined = await persistProject(request, maDMP.dmp.project, userId, true);
  if (!project) errors.push('Unable to save the Project information.');

  // 2: Determine which VersionedTemplate to use for the Plan
  const versionedTemplateId: number | undefined = await determineVersionedTemplate(request, maDMP);
  if (!versionedTemplateId) errors.push('Unable to determine a valid DMP Tool template.');

  // We need to bail out if there are any errors at this point
  if (errors.length > 0) return { errors };

  return { id: plan.id, errors };
}

/**
 * Helper function to update a Plan and all of its information in RDS
 *
 * @param request the Fastify request
 * @param maDMP the maDMP record to persist
 * @param existingPlan the existing plan
 * @param userId the id of the user creating the Plan
 * @returns the id of the newly created Plan and any errors that occurred
 */
const updatePlan = async (
  request: FastifyRequest,
  maDMP: DMPToolDMPType,
  existingPlan: Plan,
  userId: number
): Promise<PersistPlanResponse> => {

  return { errors: ['Not implemented yet.']};
}

/**
 * Helper function to persist the Project record in RDS
 *
 * @param request the Fastify request
 * @param project the project portion of the maDMP record
 * @param userId the id of the user creating the Plan
 * @param isNewPlan whether the Plan is new (true) or an update (false)
 * @returns the id of the newly created Project record
 */
const persistProject = async (
  request: FastifyRequest,
  project: DMPToolDMPType['dmp']['project'],
  userId: number,
  isNewPlan = false
): Promise<LoadProjectInfo | undefined> => {
  if (!project || !userId) return undefined;

  if (isNewPlan) {

  } else {
    const resp = { results: [], fields: [] } = await queryTable(
      request.dmptoolConfig.rds as ConnectionParams,
      `UPDATE projects
        SET title = :title, abstractText = :abstractText, researchDomainId = :researchDomainId,
            startDate = :startDate, endDate = :endDate, modifiedById = userId, modified = NOW()
        WHERE id = :id;`,
      {}
    );
  }
  return undefined;
}

/**
 * Helper function to persist the Member record in RDS
 *
 * @param request the Fastify request
 * @param member the contributor or contact portion of the maDMP record
 * @param isNewPlan whether the Plan is new (true) or an update (false)
 */
const persistMember = async (
  request: FastifyRequest,
  member: DMPToolDMPType['dmp']['contributor'][0] | DMPToolDMPType['dmp']['contact'],
  isNewPlan = false
): Promise<LoadMemberInfo | undefined> => {
  return undefined;
}

/**
 * Helper function to persist the Funding record in RDS
 *
 * @param request the Fastify request
 * @param funding the funding portion of the maDMP record
 * @param isNewPlan whether the Plan is new (true) or an update (false)
 */
const persistFunding = async (
  request: FastifyRequest,
  funding: DMPToolDMPType['dmp']['project']['funding'][0],
  isNewPlan = false
): Promise<LoadFundingInfo | undefined> => {
  return undefined;
}

/**
 * Helper function to persist the Affiliation record in RDS
 *
 * @param request the Fastify request
 * @param affiliation the affiliation portion of the maDMP record
 * @param isNewPlan whether the Plan is new (true) or an update (false)
 */
const persistAffiliation = async (
  request: FastifyRequest,
  affiliation: DMPToolDMPType['dmp']['contact']['affiliation'][0],
  isNewPlan = false
): Promise<LoadAffiliationInfo | undefined> => {
  return undefined;
}

/**
 * Helper function to persist the Related Work record in RDS
 *
 * @param request the Fastify request
 * @param relatedWork the related_identifier portion of the maDMP record
 * @param isNewPlan whether the Plan is new (true) or an update (false)
 */
const persistRelatedWork = async (
  request: FastifyRequest,
  relatedWork: DMPToolDMPType['dmp']['project']['related_work'][0],
  isNewPlan = false
): Promise<LoadRelatedWorkInfo | undefined> => {
  return undefined;
}

/**
 * Helper function to persist the Narrative content in RDS
 *
 * @param request the Fastify request
 * @param narrative the narrative content portion of the maDMP record
 * @param isNewPlan whether the Plan is new (true) or an update (false)
 */
const persistNarrative = async (
  request: FastifyRequest,
  narrative: DMPToolDMPType['dmp']['narrative'],
  isNewPlan = false
): Promise<LoadNarrativeInfo | undefined> => {
  return undefined;
}

/**
 * Persist the maDMP record to RDS
 *
 * @param request the Fastify request
 * @param maDMP the maDMP record to persist
 * @returns true if the record was persisted successfully, false otherwise
 */
export const persistMaDMPToRds = async (
  request: FastifyRequest,
  maDMP: DMPToolDMPType
): Promise<boolean> => {
  const userId: number = await getUserId(request);
  if (!userId || userId === 0) return false;

  // Check if the DMP already exists in RDS by dmpId
  let existing: Plan | undefined = await loadPlan(request, maDMP.dmp.dmp_id.identifier);

  // If it doesn't see if it exists by alternate identifier
  if (!existing) {
    existing = await getPlanByAlternateIdentifier(request, maDMP.dmp.alternate_identifier);
  }

  // Persist the maDMP record to RDS
  const resp: PersistPlanResponse = existing
    ? await updatePlan(request, maDMP, existing, userId)
    : await createPlan(request, maDMP, userId);

  return resp && resp.errors.length === 0;
}
