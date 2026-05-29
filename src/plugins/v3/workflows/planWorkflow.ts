import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { convertMySQLDateTimeToRFC3339 } from "@dmptool/utils";
import { IdentifierType } from "../../../types.js";
import { VersionedTemplate } from "../../../models/VersionedTemplate.js";
import { Project } from "../../../models/Project.js";
import { Plan } from "../../../models/Plan.js";
import { loadMaDMPFromDynamo } from "../../../models/maDMP.js";
import { saveMembersWorkflow } from "./memberWorkflow.js";
import {
  ERROR_CODE_ALREADY_EXISTS,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_INTERNAL_SERVER,
  ERROR_CODE_INVALID_DMP,
  ERROR_MSG_CONFLICT,
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
const normalizeIncomingDMP = (
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
 * Persists all non-critical dependency information to the database
 *
 * @param request the Fastify request
 * @param dmp the maDMP
 * @param plan the Plan
 */
const saveNonFatalPlanArtifacts = async (
  request: FastifyRequest,
  dmp: DMPToolDMPType['dmp'],
  plan: Plan
): Promise<void> => {
  // Save the alternate identifiers
  if (!await plan.saveAlternateIdentifiers(request, dmp.alternate_identifier)){
    // Log any errors, the Plan.alternateIdentiers error will have been set
    request.log.error(
      { planId: plan.id, alternateIdentifiers: dmp.alternate_identifier },
      'Unable to save alternate identifiers for the new plan'
    );
  }
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
  // Verify that the DMP id specified is not one of ours.
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

  // Fetch the specified template OR use the default template
  const templateId: number | undefined = dmp.narrative?.template?.id;
  const template: VersionedTemplate | undefined = await VersionedTemplate.findOrDefault(
    request,
    templateId
  );
  if (!template) {
    request.log.fatal({ templateId }, 'Unable to find a template (or default) for DMP creation');
    throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, 'Missing template');
  }

  request.log.debug({ alternateIdentifier: idIn }, 'Initializing Plan');
  // Find the Plan or initialize a new one
  const plan = await Plan.findOrInitialize(request, template, dmp);
  if (plan.id) {
    request.log.warn({ alternateIdentifier: idIn, planId: plan.id }, 'DMP already exists');
    throw newFastifyError(ERROR_CODE_ALREADY_EXISTS, 'DMP already exists', 400);
  }

  // If the template specified doesn't match what we are using add a warning message
  if (templateId && template.id !== templateId) {
    plan.warnings['template'] = 'Unable to find specified DMP Tool template so the default template was used instead.';
  }

  // The DMP Tool allows a single project to have multiple plans, so we need to
  // try and find the Project or initialize a new one
  request.log.debug({ alternateIdentifier: idIn }, 'Initializing Project');
  const project = await Project.findOrInitialize(request, dmp);
  // If the Project was initialized, create it
  if (!project.id && !(await project.save(request))) {
    request.log.error({ errors: project.errors, alternateIdentifier: idIn }, 'Unable to save project model');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, project.errorsToString());
  }

  // Create the new Plan
  plan.projectId = project.id;
  request.log.debug({ alternateIdentifier: idIn, projectId: project.id }, 'Saving plan');
  if (!(await plan.save(request))) {
    request.log.error({ errors: plan.errors, alternateIdentifier: idIn }, 'Unable to save plan model');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, plan.errorsToString());
  }

  // Something went wrong if the new DMP id was not set
  if (!plan.dmpId) {
    request.log.fatal({ alternateIdentifier: idIn, plan }, 'Plan save completed but no DMP id was assigned');
    throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, 'Unable to generate DMP id.');
  }

  // Now save the Project and Plan Members
  request.log.debug(
    { alternateIdentifier: idIn, projectId: project.id, dmpId: plan.dmpId },
    'Saving project and plan members'
  );
  const finalPlan: Plan = await saveMembersWorkflow(request, project, plan, dmp);

  // Now that the Project and Plan have been saved, go through and save all
  // the associated artifacts
  request.log.debug(
    { alternateIdentifier: idIn, projectId: project.id, dmpId: finalPlan.dmpId },
    'Saving non-critical information'
  );
  await saveNonFatalPlanArtifacts(request, dmp, finalPlan);

  // Errors would have been added to the Plan object if any errors occurred while
  // attempting to save the artifacts.
  if (finalPlan.hasErrors()) {
    request.log.error(
      { errors: finalPlan.errors, dmpId: finalPlan.dmpId },
      'Failed to create Plan.'
    );
    throw newFastifyError(ERROR_CODE_INVALID_DMP, finalPlan.errorsToString());
  }

  // Generate the maDMP JSON so that we can return it
  const newMaDMP: DMPToolDMPType | undefined = await loadMaDMPFromDynamo(
    request,
    plan.dmpId
  );

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
      ERROR_CODE_INVALID_DMP,
      `Your DMP was created but we could not generate a valid JSON response. Try "GET /dmps/${encodeURI(finalPlan.dmpId)}"`
    );
  }

  request.log.debug(
    { alternateIdentifier: idIn, projectId: project.id, dmpId: plan.dmpId },
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
  dmpId: string,
  ifUnmodifiedSince: string,
  currentDmp: DMPToolDMPType
): Promise<DMPToolDMPType> => {
  request.log.debug({ dmpId }, 'Update DMP Workflow started');
  validateModifiedDateMatch(ifUnmodifiedSince, currentDmp.dmp.modified);

  return currentDmp;
};

/**
 * Workflow for delete route preconditions.
 * Note: the actual deletion persistence is still TODO in the route layer.
 */
export const deleteDmpWorkflow = async (
  request: FastifyRequest,
  dmpId: string,
  ifUnmodifiedSince: string,
  currentDmpModifiedDate: string
): Promise<boolean> => {
  request.log.debug({ dmpId }, 'Started delete Plan Workflow');
  validateModifiedDateMatch(ifUnmodifiedSince, currentDmpModifiedDate);

  return true;
};
