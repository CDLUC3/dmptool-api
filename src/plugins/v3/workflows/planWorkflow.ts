import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { convertMySQLDateTimeToRFC3339, DMP_LATEST_VERSION } from "@dmptool/utils";
import {IdentifierType, Plan as PlanRDS, ProjectType} from "../../../types.js";
import { VersionedTemplate } from "../../../models/VersionedTemplate.js";
import { Project } from "../../../models/Project.js";
import { Plan } from "../../../models/Plan.js";
import { ResearchDomain } from "../../../models/ResearchDomain.js";
import {
  handleMissingMaDMP,
  loadMaDMPFromDynamo,
  loadPlan,
} from "../../../models/maDMP.js";
import { saveMembersWorkflow } from "./memberWorkflow.js";
import { saveFundingWorkflow } from "./fundingWorkflow.js";
import { createNarrativeWorkflow } from "./narrativeWorkflow.js";
import {
  ERROR_CODE_ALREADY_EXISTS,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_INTERNAL_SERVER,
  ERROR_CODE_INVALID_DMP, ERROR_CODE_NOT_FOUND,
  ERROR_MSG_CONFLICT, ERROR_MSG_INTERNAL_SERVER, ERROR_MSG_NOT_FOUND,
  newFastifyError
} from "../../../handlers/error.js";
import {
  DEFAULT_LANGUAGE,
  isValidISO3,
  LangISO3,
  LanguageMapThreeToFive
} from "../../../utils.js";
import {
  DMP_TOOL_CONTENT_TYPE,
  RDA_COMMON_STANDARD_CONTENT_TYPE
} from "../routeSchema.js";

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

console.log('REQUEST DATE', requestDate, 'CURRENT DATE', currentDate);

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

  // Save the narrative if it was provided
  const planWithNarrative: Plan = await createNarrativeWorkflow(request, plan, dmp);
  if (!planWithNarrative || planWithNarrative.hasErrors()) {
    request.log.error(
      {planId: plan.id, errors: planWithNarrative.errors},
      'Unable to save the plan narrative'
    );
  }
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
): Promise<DMPToolDMPType> => {
  // First: load high-level info about the DMP from the MySQL database
  const plan: PlanRDS | undefined = await loadPlan(request, dmpId);
  if (!plan) {
    request.log.warn({ dmpId }, "No Plan found");
    throw newFastifyError(ERROR_CODE_NOT_FOUND, 'DMP not found');
  }

  // Second: fetch the latest maDMP record for the Plan from the DynamoDB table
  let maDMP: DMPToolDMPType | undefined = await loadMaDMPFromDynamo(
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

  if (!maDMP || !maDMP.dmp || rdsDate !== maDMP.dmp.modified || !maDMP.dmp.narrative) {
    const outdated: boolean = maDMP?.dmp?.modified && rdsDate !== maDMP?.dmp?.modified
    request.log.debug({ dmpId }, `DMP metadata is ${outdated ? 'outdated' : 'missing'}`);
    maDMP = await handleMissingMaDMP(request, plan, outdated);
  }

  // If the maDMP record could not be generated or retrieved, we need to bail out
  if (!maDMP || !maDMP.dmp) {
    request.log.error({ dmpId }, "Unable to generate narrative for DMP");
    throw newFastifyError(ERROR_CODE_INTERNAL_SERVER, ERROR_MSG_INTERNAL_SERVER);
  }

console.log('RETURNING', maDMP)

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

  if (Array.isArray(dmp.project) && dmp.project.length > 1) {
    request.log.warn('DMP had more than one project.');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, 'Only one project is currently supported per DMP.');
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

  // Now save the Project and Plan Funding
  request.log.debug(
    { alternateIdentifier: idIn, projectId: project.id, dmpId: plan.dmpId },
    'Saving project and plan funding'
  );
  const fundedPlan: Plan = await saveFundingWorkflow(request, project, plan, dmp);

  // Now save the Project and Plan Members
  request.log.debug(
    { alternateIdentifier: idIn, projectId: project.id, dmpId: fundedPlan.dmpId },
    'Saving project and plan members'
  );
  const finalPlan: Plan = await saveMembersWorkflow(request, project, fundedPlan, dmp);

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
    finalPlan.dmpId
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
  id: string,
  ifUnmodifiedSince: string,
  payload: DMPToolDMPType['dmp']
): Promise<DMPToolDMPType> => {
  // Fetch the maDMP record
  const currentDMP: DMPToolDMPType = await getPlanWorkflow(request, id);
  request.log.debug({ id }, 'Update DMP Workflow started');

console.log('CURRENT', currentDMP);

  // Convert the DOI specified in the path into a full DMP id
  const cleanId = id.startsWith('/') ? id.replace('/', '') : id;
  const dmpId = `${request.dmptoolConfig.dmpIdBaseUrl}/${cleanId}`;
  const contentType: string = request.headers['content-type'] || RDA_COMMON_STANDARD_CONTENT_TYPE;

  // Validate that the modification timestamps match
  validateModifiedDateMatch(ifUnmodifiedSince, currentDMP.dmp.modified);

  // First: find the Project and Plan
  const plan: Plan | undefined = await Plan.findByDMPId(request, dmpId);
  if (!plan) {
    request.log.error({ dmpId }, 'Unable to load plan information');
    throw newFastifyError(ERROR_CODE_NOT_FOUND, ERROR_MSG_NOT_FOUND);
  }

  const projectId: number | undefined = plan.project ? plan.project.id : plan.projectId;
  if (!projectId) {
    request.log.error({ dmpId, planId: plan.id }, 'Unable to determine project ID');
    throw newFastifyError(ERROR_CODE_NOT_FOUND, ERROR_MSG_NOT_FOUND);
  }
  const project: Project | undefined = await Project.findById(request, projectId);
  // If the Project was initialized, create it
  if (!project) {
    request.log.error(
      { dmpId, projectId: plan.projectId, planId: plan.id },
      'Unable to load project information');
    throw newFastifyError(ERROR_CODE_NOT_FOUND, ERROR_MSG_NOT_FOUND);
  }

  const logBase = { dmpId, projectId: project.id, planId: plan.id };

console.log('PAYLOAD', payload)

  // Second Replace the Project information
  request.log.debug(logBase, 'Replacing project information');
  const payloadProject: ProjectType = payload.dmp.project[0];
  const researchDomain: string | null = payloadProject.researchDomain
    ? payloadProject.researchDomain?.research_domain_identifier?.identifier
    : null;

  // Process the standard project level information
  project.title = payloadProject.title ?? payload.dmp.title;
  project.abstractText = payloadProject.description ?? payload.dmp.description;
  project.startDate = payloadProject.start;
  project.endDate = payloadProject.end;

  // Only process the following fields if the incoming content type was fpr the
  // DMP Tool extended schema format (otherwise we are inadvertently blanking out data)
  if (contentType === DMP_TOOL_CONTENT_TYPE) {
    project.isTestProject = payload.isTestProject || false;
    project.researchDomain = researchDomain
      ? await ResearchDomain.findByURI(request, researchDomain)
      : undefined;
  }

console.log('PROJECT PRE SAVE', project)

  if (!(await project.save(request))) {
    request.log.error({ ...logBase, errors: project.errors }, 'Unable to replace project information');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, project.errorsToString());
  }

  // Third: Replace the Plan information
  request.log.debug(logBase, 'Replacing plan information');

  plan.title = payload.title;
  plan.languageId = isValidISO3(payload.language)
    ? LanguageMapThreeToFive[payload.language as LangISO3]
    : DEFAULT_LANGUAGE;

  // Only process the following fields if the incoming content type was fpr the
  // DMP Tool extended schema format (otherwise we are inadvertently blanking out data)
  if (contentType === DMP_TOOL_CONTENT_TYPE) {
    plan.status = payload.status;
    plan.visibility = payload.visibility;
  }

console.log('PLAN PRE SAVE', plan)

  if (!(await plan.save(request))) {
    request.log.error({ ...logBase, errors: plan.errors }, 'Unable to replace plan information');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, plan.errorsToString());
  }

  // Fourth: Save the Project and Plan Funding
  request.log.debug(logBase, 'Replacing project and plan funding');
  const fundedPlan: Plan = await saveFundingWorkflow(request, project, plan, payload);

  // Fifth: Save the Project and Plan Members
  request.log.debug(logBase, 'Replacing project and plan members');
  const finalPlan: Plan = await saveMembersWorkflow(request, project, fundedPlan, payload);

  // Sixth: Now that the Project and Plan have been saved, go through and save all
  // the associated artifacts
  request.log.debug(logBase, 'Replacing non-critical information');
  await saveNonFatalPlanArtifacts(request, payload, finalPlan);

  // Errors would have been added to the Plan object if any errors occurred while
  // attempting to save the artifacts.
  if (finalPlan.hasErrors()) {
    request.log.error({ ...logBase, errors: finalPlan.errors }, 'Failed to replace Plan.');
    throw newFastifyError(ERROR_CODE_INVALID_DMP, finalPlan.errorsToString());
  }

  // Generate the maDMP JSON so that we can return it
  const replacedMaDMP: DMPToolDMPType | undefined = await loadMaDMPFromDynamo(request, finalPlan.dmpId);

  // TODO: Once the RDA group has decided on a way to convey warnings about
  //       data that could not be supported (e.g. the "cost" section), we will
  //       want to attach those warnings to the response
  request.log.warn({ warnings: plan.warnings }, 'Non fatal errors occurred.');

  if (!replacedMaDMP) {
    request.log.fatal(logBase, 'Unable to load newly-replaced maDMP');
    throw newFastifyError(
      ERROR_CODE_INVALID_DMP,
      `Your DMP was replaced but we could not generate a valid JSON response. Try "GET /dmps/${encodeURI(finalPlan.dmpId)}"`
    );
  }

  request.log.debug(logBase, 'Finished creating new Plan');

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
  const currentDMP: DMPToolDMPType = await getPlanWorkflow(request, dmpId);
  request.log.debug({ dmpId }, 'Delete DMP Workflow started');

  // Validate that the modification timestamps match
  validateModifiedDateMatch(ifUnmodifiedSince, currentDMP.dmp.modified);

  // Delete or Tombstone the maDMP
  // TODO: Implement the actual DMP delete logic

  return false;
};
