import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { IdentifierType } from "../../../types.js";
import { VersionedTemplate } from "../../../models/VersionedTemplate.js";
import { Project } from "../../../models/Project.js";
import { Plan } from "../../../models/Plan.js";
import { loadMaDMPFromDynamo } from "../../../models/maDMP.js";
import { saveMembersWorkflow } from "./memberWorkflow.js";

export type CreateDmpResult =
  | {
    ok: true;
    statusCode: 201;
    data: DMPToolDMPType;
    }
  | {
    ok: false;
    statusCode: 400 | 500;
    errorCode: string;
    message: string;
  }

/**
 * Normalizes the incoming maDMP by adding the default values and ensuring that
 * the specified DMP id is included in the alternate identifiers array.
 * This ensures that we use our own DMP id with our DOI shoulder but retain the
 * calling system's identifier.
 *
 * @param request the Fastify request
 * @param body the maDMP
 */
const normalizeIncomingDMP = (
  request: FastifyRequest,
  body: DMPToolDMPType
): DMPToolDMPType['dmp'] => {
  const dmp = structuredClone(body.dmp);

  dmp.provenance = request.caller || request.dmptoolConfig.defaultCaller;
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
      { planId: plan.id, alternateIdentifiers: dmp.alternat_identifier },
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
 * @returns either a 201 with an ok flag that is true or a 400/500 with an errorCode and message
 */
export async function createPlanWorkflow(
  request: FastifyRequest,
  body: DMPToolDMPType
): Promise<CreateDmpResult> {
  // Verify that the DMP id specified is not one of ours.
  const dmp = normalizeIncomingDMP(request, body);
  if (dmp.dmp_id.identifier.includes(request.dmptoolConfig.dmpIdShoulder)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: `The ${request.dmptoolConfig.applicationName} is responsible for assigning DMP ids.`,
    };
  }

  // Fetch the specified template OR use the default template
  const template: VersionedTemplate | undefined = await VersionedTemplate.findOrDefault(
    request,
    dmp.narrative?.template?.id
  );
  if (!template) {
    return {
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to find a template',
    };
  }

  // Find the Plan or initialize a new one
  const plan = await Plan.findOrInitialize(request, template, dmp);
  if (plan.id) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_already_exists',
      message: 'DMP already exists',
    };
  }

  // The DMP Tool allows a single project to have multiple plans, so we need to
  // try and find the Project or initialize a new one
  const project = await Project.findOrInitialize(request, dmp);
  // If the Project was initialized, create it
  if (!project.id && !(await project.save(request))) {
    const errs = Project.errorsToString(project.errors);
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: errs,
    };
  }

  // Create the new Plan
  plan.projectId = project.id;
  if (!(await plan.save(request))) {
    const errs = Plan.errorsToString(plan.errors);
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: errs,
    };
  }

  // Something went wrong if the new DMP id was not set
  if (!plan.dmpId) {
    return {
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to assign a DMP id to the new plan',
    };
  }

  // Now save the Project and Plan Members
  const finalPlan: Plan = await saveMembersWorkflow(request, project, plan, dmp);

  // Now that the Project and Plan have been saved, go through and save all
  // the associated artifacts
  await saveNonFatalPlanArtifacts(request, dmp, finalPlan);

  // Errors would have been added to the Plan object if any errors occurred while
  // attempting to save the artifacts.
  if (Plan.hasErrors(finalPlan.errors)) {
    const errs = Plan.errorsToString(finalPlan.errors);
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: errs,
    };
  }

  // Generate the maDMP JSON so that we can return it
  const newMaDMP: DMPToolDMPType | undefined = await loadMaDMPFromDynamo(
    request,
    plan.dmpId
  );

  // TODO: Once the RDA group has decided on a way to convey warnings about
  //       data that could not be supported (e.g. the "cost" section), we will
  //       want to attach those warnings to the response

  if (!newMaDMP) {
    return {
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to complete your request at this time. Please try again later.',
    };
  }

  return {
    ok: true,
    statusCode: 201,
    data: newMaDMP,
  };
}
