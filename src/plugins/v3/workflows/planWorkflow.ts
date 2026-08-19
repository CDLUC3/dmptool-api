import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { convertMySQLDateTimeToRFC3339, DMP_LATEST_VERSION } from "@dmptool/utils";
import {
  IdentifierType,
  Plan as PlanRDS,
} from "../../../types.js";
import { VersionedTemplate } from "../../../models/VersionedTemplate.js";
import { Plan } from "../../../models/Plan.js";
import { maDMPHelpers } from "../../../models/maDMP.js";
import {
  ERROR_CODE_ALREADY_EXISTS,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_INTERNAL_SERVER,
  ERROR_CODE_INVALID_DMP, ERROR_CODE_NOT_FOUND,
  ERROR_MSG_CONFLICT, ERROR_MSG_INTERNAL_SERVER, ERROR_MSG_NOT_FOUND,
  newFastifyError
} from "../../../handlers/error.js";

/**
 * Verify that the DMP modification date set in the header matches the current modified timestamp
 *
 * @param ifUnmodifiedSince the timestamp of the IfUnmodifiedSinceHeader
 * @param currentModifiedDate the modified timestamp of the current maDMP
 */
const validateModifiedDateMatch = (
  ifUnmodifiedSince: string,
  currentModifiedDate: string
): void => {
  const requestDate = convertMySQLDateTimeToRFC3339(ifUnmodifiedSince) as string;
  const currentDate = convertMySQLDateTimeToRFC3339(currentModifiedDate) as string;
  if (requestDate !== currentDate) {
    throw newFastifyError(ERROR_CODE_CONFLICT, ERROR_MSG_CONFLICT);
  }
};

/**
 * Normalizes the incoming maDMP by adding the default values and ensuring that
 * the specified DMP id is included in the alternate identifiers array.
 * This ensures that we use our own DMP id with our DOI shoulder but retain the
 * calling system's identifier.
 *
 * @param request the Fastify request
 * @param body the maDMP
 * @returns the normalized maDMP
 */
export const normalizeIncomingDMP = (
  request: FastifyRequest,
  body: DMPToolDMPType
): DMPToolDMPType['dmp'] => {
  const dmp = structuredClone(body.dmp);

  // Make sure we have the provenance set
  dmp.provenance = request.caller || request.dmptoolConfig.defaultCaller;

  // Move the specified `dmp_id` value into the `alternate_identifier` array
  dmp.alternate_identifier ??= [];
  const hasAltId = dmp.alternate_identifier.some((id: IdentifierType): boolean => {
    return id.identifier === dmp.dmp_id.identifier;
  });
  if (!hasAltId) {
    dmp.alternate_identifier.push({
      identifier: dmp.dmp_id.identifier,
      type: dmp.dmp_id.type,
    });
  }

  return dmp;
}

/**
 * Loads the maDMP version from the Dynamo DB, verifies it is up to date with the
 * RDS record and if not, builds a new maDMP record based on that latest information
 *
 * @param request the Fastify request
 * @param dmpId the DMP id to retrieve
 * @param version the version of the maDMP to retrieve (defaults to the latest version)
 * @returns the maDMP record
 * @throws ERROR_CODE_NOT_FOUND error when the DMP id could not be found in the RDS database
 * @throws ERROR_MSG_INTERNAL_SERVER when the maDMP record could not be fetched or constructed
 */
export const getPlanWorkflow = async (
  request: FastifyRequest,
  dmpId: string,
  version: string = DMP_LATEST_VERSION
): Promise<DMPToolDMPType | undefined> => {
  // First: load high-level info about the DMP from the MySQL database
  const plan: PlanRDS | undefined = await maDMPHelpers.loadPlan(request, dmpId);
  if (!plan) {
    request.log.warn({ dmpId }, "No Plan found");
    throw newFastifyError(ERROR_CODE_NOT_FOUND, 'DMP not found');
  }

console.log('PLAN INFO FROM MySQL', plan)

  // Second: fetch the latest maDMP record for the Plan from the DynamoDB table
  let maDMP: DMPToolDMPType | undefined = await maDMPHelpers.loadMaDMPFromDynamo(
    request,
    plan.dmpId,
    version || DMP_LATEST_VERSION
  );
  request.log.debug({ dmpId, maDMPModified: maDMP?.dmp?.modified }, 'Retrieved maDMP metadata from DynamoDB');

  // Third: Determine if the maDMP was missing or is out of date or missing the narrative.
  // If so, generate the current maDMP and update the DynamoDB record.
  const rdsDate: string | null = convertMySQLDateTimeToRFC3339(plan?.modified);

  request.log.debug(
    { dmpId, rdsDate, maDMPModified: maDMP?.dmp?.modified, hasNarrative: !!maDMP?.dmp?.narrative },
    'Comparing DMP metadata from RDS and DynamoDB'
  )

console.log('PLAN FROM DYNAMO', rdsDate, maDMP)

  if (!maDMP || !maDMP.dmp || rdsDate !== maDMP.dmp.modified || !maDMP.dmp.narrative) {
    const outdated: boolean = maDMP?.dmp?.modified && rdsDate !== maDMP?.dmp?.modified
    request.log.debug({ dmpId }, `DMP metadata is ${outdated ? 'outdated' : 'missing'}`);
    maDMP = await maDMPHelpers.handleMissingMaDMP(request, plan, outdated);
  }

  // If the maDMP record could not be generated or retrieved, we need to bail out
  if (!maDMP || !maDMP.dmp) {
    request.log.error({ dmpId }, "Unable to generate narrative for DMP");
    return undefined;
  }

  return maDMP;
}

/**
 * Workflow to transform a maDMP into a Project and Plan and process all of it's
 * associated dependencies like Members and Funding
 *
 * @param request the Fastify request
 * @param body the maDMP
 * @returns the maDMP JSON of the new Plan
 * @throws Fastify errors if something went wrong
 */
export async function createPlanWorkflow(
  request: FastifyRequest,
  body: DMPToolDMPType
): Promise<DMPToolDMPType> {
  // 1st: Normalize the incoming JSON and then verify that the DMP id specified
  // is not one of ours. Apollo server is responsible for assigning DMP ids.
  const dmp = normalizeIncomingDMP(request, body);
  const idIn: string = dmp.dmp_id.identifier ?? 'none-defined';
  request.log.debug({ alternateIdentifier: idIn }, 'Create DMP Workflow started');

  if (idIn.includes(request.dmptoolConfig.dmpIdShoulder)) {
    request.log.error(
      { dmpId: idIn, provenance: dmp.provenance },
      `Attempt to create a DMP using our DOI shoulder.`
    );
    throw newFastifyError(ERROR_CODE_INVALID_DMP, 'Invalid DMP id');
  }

  if (Array.isArray(dmp.project) && dmp.project.length > 1) {
    request.log.warn('DMP had more than one project.');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, 'Only one project is currently supported per DMP.');
  }

  // 2nd: Load the latest version of the specified template (if applicable)
  const versionedTemplate: VersionedTemplate | undefined = dmp.narrative?.template?.id
    ? await VersionedTemplate.findOrDefault(request, dmp.narrative.template.id)
    : await VersionedTemplate.findDefault(request);

  if (!versionedTemplate) {
    request.log.fatal('Unable to find a default template!');
    throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, ERROR_MSG_INTERNAL_SERVER);
  }

  // 3rd: Initialize the Plan
  request.log.debug({ alternateIdentifier: idIn }, 'Initializing Plan');
  // Find the Plan or initialize a new one
  const plan: Plan = await Plan.findOrInitialize(request, dmp, versionedTemplate);
  if (plan.id) {
    request.log.warn({ alternateIdentifier: idIn, planId: plan.id }, 'DMP already exists');
    throw newFastifyError(ERROR_CODE_ALREADY_EXISTS, 'DMP already exists', 400);
  }

  // 4th: Create the Plan
  request.log.debug({ alternateIdentifier: idIn, projectId: plan.project.id }, 'Saving plan');
  const created: boolean = await plan.save(request);
  if (!created || plan.hasErrors()) {
    request.log.error({ errors: plan.errors, alternateIdentifier: idIn }, 'Unable to save plan model');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, plan.errorsToString());
  }

  // Verify that the dmpId was assigned
  if (!plan.dmpId) {
    request.log.error({ alternateIdentifier: idIn, planId: plan.id }, 'DMP id was not assigned during save');
    throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, 'Unable to generate DMP id.');
  }

  // Generate the maDMP JSON so that we can return it
  const newMaDMP: DMPToolDMPType | undefined = await getPlanWorkflow(request, plan.dmpId);

  // TODO: Once the RDA group has decided on a way to convey warnings about
  //       data that could not be supported (e.g. the "cost" section), we will
  //       want to attach those warnings to the response
  request.log.warn({ warnings: plan.warnings }, 'Non fatal errors occurred.');

  if (!newMaDMP) {
    request.log.fatal(
      { alternateIdentifier: idIn, dmpId: plan.dmpId },
      'Unable to load newly-created maDMP'
    );
    throw newFastifyError(
      ERROR_CODE_INTERNAL_SERVER,
      `Your DMP was created but we could not generate a valid JSON response. Try "GET /dmps/${encodeURI(plan.dmpId)}"`
    );
  }

  request.log.debug(
    { alternateIdentifier: idIn, projectId: plan.project.id, dmpId: plan.dmpId },
    'Finished creating new Plan'
  );
  return newMaDMP;
}

/**
 * Workflow for update route preconditions and response shaping.
 * Note: the actual update persistence is still TODO in the route layer.
 */
export const updateDmpWorkflow = async (
  request: FastifyRequest,
  id: string,
  ifUnmodifiedSince: string,
  payload: DMPToolDMPType['dmp']
): Promise<DMPToolDMPType> => {
  // Fetch the maDMP record
  const currentDMP: DMPToolDMPType | undefined = await getPlanWorkflow(request, id);
  request.log.debug({ id }, 'Update DMP Workflow started');

  if (!currentDMP || !currentDMP.dmp || !currentDMP.dmp.modified) {
    request.log.error({ planId: id }, 'Unable to plan using PlanWorkflow');
    throw newFastifyError(ERROR_CODE_NOT_FOUND, ERROR_MSG_NOT_FOUND);
  }

  // Convert the DOI specified in the path into a full DMP id
  const cleanId = id.startsWith('/') ? id.replace('/', '') : id;
  const dmpId = `${request.dmptoolConfig.dmpIdBaseUrl}/${cleanId}`;

  // Validate that the modification timestamps match
  validateModifiedDateMatch(ifUnmodifiedSince, currentDMP.dmp.modified);

  // 1st: find the Project and Plan
  const plan: Plan | undefined = await Plan.findByDMPId(request, dmpId);
  if (!plan || !plan.id || !plan.project || !plan.project.id || !plan.versionedTemplate) {
    request.log.error({ dmpId }, 'Unable to load plan information');
    throw newFastifyError(ERROR_CODE_NOT_FOUND, ERROR_MSG_NOT_FOUND);
  }
  const logBase = { dmpId, projectId: plan.project.id, planId: plan.id };

  // 2nd: Reconcile the incoming changes with the current Plan
  request.log.debug(logBase, 'Replacing project information');
  const reconciledPlan: Plan = Plan.reconcileFromMaDMP(payload, plan.versionedTemplate, plan.project, plan)
  const updated: boolean = await reconciledPlan.save(request);
  if (!updated || reconciledPlan.hasErrors()) {
    request.log.error({ ...logBase, errors: reconciledPlan.errors }, 'Unable to replace plan information');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, reconciledPlan.errorsToString());
  }

  // Generate the maDMP JSON so that we can return it
  const replacedMaDMP: DMPToolDMPType | undefined = await getPlanWorkflow(request, plan.dmpId);

  // TODO: Once the RDA group has decided on a way to convey warnings about
  //       data that could not be supported (e.g. the "cost" section), we will
  //       want to attach those warnings to the response
  request.log.warn({ warnings: reconciledPlan.warnings }, 'Non fatal errors occurred.');

  if (!replacedMaDMP) {
    request.log.fatal(logBase, 'Unable to load newly-replaced maDMP');
    throw newFastifyError(
      ERROR_CODE_INTERNAL_SERVER,
      `Your DMP was replaced but we could not generate a valid JSON response. Try "GET /dmps/${encodeURI(reconciledPlan.dmpId)}"`
    );
  }

  request.log.debug(logBase, 'Finished updating Plan');
  return replacedMaDMP;
};

/**
 * Workflow for delete route preconditions.
 * Note: the actual deletion persistence is still TODO in the route layer.
 */
export const deleteDmpWorkflow = async (
  request: FastifyRequest,
  dmpId: string,
  ifUnmodifiedSince: string,
): Promise<boolean> => {
  // Fetch the maDMP record
  const plan: Plan | undefined = await Plan.findByDMPId(request, dmpId);
  if (!plan || !plan.modified) {
    request.log.warn({ dmpId }, 'Unable to delete Plan because it does not exist');
    throw newFastifyError(ERROR_CODE_NOT_FOUND, ERROR_MSG_NOT_FOUND);
  }
  request.log.debug({ dmpId }, 'Delete DMP Workflow started');

  // Validate that the modification timestamps match
  validateModifiedDateMatch(ifUnmodifiedSince, plan.modified);

  // Delete or Tombstone the maDMP
  if(!(await plan.delete(request)) || plan.hasErrors()) {
    request.log.error({ dmpId, planId: plan.id, errors: plan.errors }, 'Unable to delete plan information');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, plan.errorsToString());
  }

  // Generate the maDMP JSON so that we can return it
  const removedMaDMP: DMPToolDMPType | undefined = await getPlanWorkflow(request, plan.dmpId);

  // If the plan was NOT published/registered we should not have been able to reload the MaDMP
  // Otherwise check that the maDMP record is tomb-stoned
  return (!removedMaDMP && !plan.registered) || (removedMaDMP && removedMaDMP.dmp.tombstoned);
};
