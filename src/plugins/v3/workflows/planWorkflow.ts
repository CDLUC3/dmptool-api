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
    // Allows the route handler to consistently log by severity
    logLevel?: 'warn' | 'error' | 'fatal' | 'debug';
  }

// Model errors in this allowlist are non-blocking and should not fail the request.
const LENIENT_MODEL_ERROR_KEYS = new Set<string>(['alternateIdentifiers']);

const serializeModelErrors = (errors: Record<string, string> = {}): string => {
  return Object.entries(errors)
    .filter(([key, value]) => key !== '__typename' && !!value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

const splitModelErrors = (errors: Record<string, string> = {}): {
  strictErrors: Record<string, string>;
  lenientErrors: Record<string, string>;
} => {
  const strictErrors: Record<string, string> = {};
  const lenientErrors: Record<string, string> = {};

  Object.entries(errors)
    .filter(([key, value]) => key !== '__typename' && !!value)
    .forEach(([key, value]) => {
      if (LENIENT_MODEL_ERROR_KEYS.has(key)) {
        lenientErrors[key] = value;
      } else {
        strictErrors[key] = value;
      }
    });

  return { strictErrors, lenientErrors };
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
      logLevel: 'warn',
    };
  }

  // Fetch the specified template OR use the default template
  const template: VersionedTemplate | undefined = await VersionedTemplate.findOrDefault(
    request,
    dmp.narrative?.template?.id
  );
  if (!template) {
    request.log.fatal({ templateId: dmp.narrative?.template?.id }, 'Unable to find a template for DMP creation');
    return {
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to find a template',
      logLevel: 'fatal',
    };
  }

  // Find the Plan or initialize a new one
  const plan = await Plan.findOrInitialize(request, template, dmp);
  if (plan.id) {
    request.log.warn({ dmpId: dmp.dmp_id.identifier, planId: plan.id }, 'DMP already exists');
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_already_exists',
      message: 'DMP already exists',
      logLevel: 'warn',
    };
  }

  // The DMP Tool allows a single project to have multiple plans, so we need to
  // try and find the Project or initialize a new one
  const project = await Project.findOrInitialize(request, dmp);
  // If the Project was initialized, create it
  if (!project.id && !(await project.save(request))) {
    const errs = serializeModelErrors(project.errors) || 'Unable to save project';
    request.log.error({ errors: project.errors, dmpId: dmp.dmp_id.identifier }, 'Unable to save project model');
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: errs,
      logLevel: 'error',
    };
  }

  // Create the new Plan
  plan.projectId = project.id;
  if (!(await plan.save(request))) {
    const errs = serializeModelErrors(plan.errors) || 'Unable to save plan';
    request.log.error({ errors: plan.errors, dmpId: dmp.dmp_id.identifier }, 'Unable to save plan model');
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: errs,
      logLevel: 'error',
    };
  }

  // Something went wrong if the new DMP id was not set
  if (!plan.dmpId) {
    request.log.fatal({ plan }, 'Plan save completed but no DMP id was assigned');
    return {
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to assign a DMP id to the new plan',
      logLevel: 'fatal',
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
    const { strictErrors, lenientErrors } = splitModelErrors(finalPlan.errors);

    if (Object.keys(lenientErrors).length > 0) {
      request.log.warn({ errors: lenientErrors, dmpId: finalPlan.dmpId }, 'Non-fatal model errors occurred');
    }

    if (Object.keys(strictErrors).length > 0) {
      const errs = serializeModelErrors(strictErrors) || 'Unable to process DMP model errors';
      request.log.error({ errors: strictErrors, dmpId: finalPlan.dmpId }, 'Strict model errors occurred');

      return {
        ok: false,
        statusCode: 400,
        errorCode: 'dmp_invalid',
        message: errs,
        logLevel: 'error',
      };
    }
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
    request.log.fatal({ dmpId: plan.dmpId }, 'Unable to load newly-created maDMP');
    return {
      ok: false,
      statusCode: 500,
      errorCode: 'generic_error',
      message: 'Unable to complete your request at this time. Please try again later.',
      logLevel: 'fatal',
    };
  }

  return {
    ok: true,
    statusCode: 201,
    data: newMaDMP,
  };
}
