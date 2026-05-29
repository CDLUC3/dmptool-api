import { DMPToolDMPType } from "@dmptool/types";
import { Affiliation } from "../../../models/Affiliation.js";
import { Plan } from "../../../models/Plan.js";
import { PlanFunding } from "../../../models/PlanFunding.js";
import { Project } from "../../../models/Project.js";
import { ProjectFunding } from "../../../models/ProjectFunding.js";
import { ProjectFundingStatus } from "../../../generated/graphql.js";
import { extractIdentifier } from "../../../utils.js";
import { FundingType, ProjectType } from "../../../types.js";
import {FastifyRequest} from "fastify";

interface FundingExtensionType {
  project_id?: { identifier?: string } | { identifier?: string }[];
  funder_id?: { identifier?: string };
  opportunity_identifier?: { identifier?: string };
  project_identifier?: { identifier?: string };
}

/**
 * Convert the RDA Common Standard funding status to the GraphQL enum.
 *
 * @param status the status code
 * @returns the status code as a GraphQL enum value
 */
const toStatus = (
  status?: string
): ProjectFundingStatus | undefined => {
  const val = status?.trim().toUpperCase();

  if (val === 'PLANNED' || val === 'DENIED' || val === 'GRANTED') {
    return val;
  }

  return undefined;
};

const extensionKey = (projectIdentifier?: string, funderIdentifier?: string): string => {
  return `${projectIdentifier ?? ''}|${funderIdentifier ?? ''}`;
};

/**
 * Locate the Project+funding associated with the specified funder opportunity id
 * or funder project number
 *
 * @param extensions the Project and funder ids
 * @param valueKey the opportunity id or project number
 */
const indexByProjectAndFunder = (
  extensions: FundingExtensionType[] | undefined,
  valueKey: 'opportunity_identifier' | 'project_identifier'
): Record<string, string[]> => {
  return (extensions ?? []).reduce((acc: Record<string, string[]>, ext: FundingExtensionType) => {
    const projectIdentifier: string | undefined = extractIdentifier(ext.project_id);
    const funderIdentifier: string | undefined = Affiliation.normalizeRORId(ext.funder_id?.identifier?.trim());
    const value: string | undefined = ext[valueKey]?.identifier?.trim();

    if (!value) return acc;

    const key = extensionKey(projectIdentifier, funderIdentifier);
    acc[key] ??= [];
    acc[key].push(value);
    return acc;
  }, {});
};

/**
 * Generate potential Project funding information
 *
 * @param request the Fastify request
 * @param project the research project
 * @param dmp the maDMP JSON
 * @param funding the funding information from the maDMP
 * @returns project funding information
 */
const generateFundingCandidate = async (
  request: FastifyRequest,
  project: Project,
  dmp: DMPToolDMPType['dmp'],
  funding: FundingType
): Promise<ProjectFunding | null> => {
  const dmpProject: ProjectType | undefined = dmp.project?.[0];

  const opportunityIndex = indexByProjectAndFunder(
    dmp.funding_opportunity as FundingExtensionType[],
    'opportunity_identifier'
  );
  const projectNumberIndex = indexByProjectAndFunder(
    dmp.funding_project as FundingExtensionType[],
    'project_identifier'
  );

  const projectIdentifier = extractIdentifier(dmpProject?.project_id);

  const funderIdentifier = Affiliation.normalizeRORId(
    funding.funder_id?.identifier?.trim()
  );
  const extKey = extensionKey(projectIdentifier, funderIdentifier);

  // Build a minimal affiliation object compatible with findOrInitialize so
  // that we reuse the standard look-up path (ROR URI first, then name fallback).
  const affiliationLookup = {
    name: funding.name?.trim(),
    affiliationId: funderIdentifier
      ? [{ identifier: funderIdentifier, type: 'ror' }]
      : [],
    affiliation_id: funderIdentifier
      ? { identifier: funderIdentifier }
      : undefined,
  } as Parameters<typeof Affiliation.findOrInitialize>[1];

  const affiliation: Affiliation = await Affiliation.findOrInitialize(
    request,
    affiliationLookup,
    true
  );

  // If the affiliation does not yet exist in the system, persist it now so
  // that the subsequent ProjectFunding mutation has a valid affiliationId.
  if (!affiliation.id) {
    const created = await affiliation.create(request);
    if (!created) {
      request.log.warn(
        { funderIdentifier, name: funding.name, errors: affiliation.errors },
        'Unable to create funder affiliation; skipping this funding entry'
      );
      return null;
    }
  }

  return new ProjectFunding({
    project,
    affiliation,
    status: toStatus(funding.funding_status),
    grantId: funding.grant_id?.identifier?.trim(),
    funderOpportunityNumber: opportunityIndex[extKey]?.shift(),
    funderProjectNumber: projectNumberIndex[extKey]?.shift(),
  });
}

/**
 * Workflow to convert maDMP funding information into ProjectFunding and PlanFunding
 * records and persist them in GraphQL.
 *
 * @param request the Fastify request
 * @param project the research project
 * @param plan the Plan
 * @param dmp the maDMP information
 * @returns the updated Plan
 */
export const saveFundingWorkflow = async (
  request: FastifyRequest,
  project: Project,
  plan: Plan,
  dmp: DMPToolDMPType['dmp']
): Promise<Plan> => {
  const dmpProject: ProjectType | undefined = dmp.project?.[0];
  if (!dmpProject) return plan;

  const dmpFundings: FundingType[] = dmpProject?.funding ?? [];
  if (dmpFundings.length === 0) return plan;

  // Resolve (or create) each funder affiliation before building ProjectFunding records.
  // null entries indicate that the funder affiliation could not be resolved and should
  // be skipped so that a single bad funder doesn't abort the entire workflow.
  const projectFundingCandidates: (ProjectFunding | null)[] = await Promise.all(
    dmpFundings.map(async (funding: FundingType): Promise<ProjectFunding | null> => {
      return generateFundingCandidate(request, project, dmp, funding);
    })
  );

  // Drop any entries where the funder affiliation could not be resolved
  const projectFundings: ProjectFunding[] = projectFundingCandidates.filter(
    (pf): pf is ProjectFunding => pf !== null
  );

  // Save all the project funding information
  if (!(await ProjectFunding.save(request, project, projectFundings))) {
    request.log.error(
      { dmpId: plan.dmpId, projectId: project.id, errors: project.errors },
      'Unable to save project funding for the plan'
    );
    plan.errors.fundings = project.errors.fundings;
    return plan;
  }

  // Generate plan funding information from the project funding information
  const planFundings: PlanFunding[] = PlanFunding.fromProjectFundings(
    plan,
    projectFundings
  );


  if (!(await PlanFunding.save(request, plan, planFundings))) {
    request.log.error(
      { dmpId: plan.dmpId, planId: plan.id, errors: plan.errors },
      'Unable to save plan funding for the plan'
    );
  }

  return plan;
};
