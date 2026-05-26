import { FastifyRequest } from "fastify";
import { DMPToolDMPType } from "@dmptool/types";
import { Affiliation } from "../../../models/Affiliation.js";
import { Plan } from "../../../models/Plan.js";
import { PlanFunding } from "../../../models/PlanFunding.js";
import { Project } from "../../../models/Project.js";
import { ProjectFunding } from "../../../models/ProjectFunding.js";
import { ProjectFundingStatus } from "../../../generated/graphql.js";

interface FundingExtensionType {
  project_id?: { identifier?: string } | { identifier?: string }[];
  funder_id?: { identifier?: string };
  opportunity_identifier?: { identifier?: string };
  project_identifier?: { identifier?: string };
}

type DmpProjectType = NonNullable<DMPToolDMPType['dmp']['project']>[0];
type DmpFundingType = NonNullable<DmpProjectType['funding']>[0];

const toStatus = (
  status?: string
): ProjectFundingStatus | undefined => {
  const val = status?.trim().toUpperCase();

  if (val === 'PLANNED' || val === 'DENIED' || val === 'GRANTED') {
    return val;
  }

  return undefined;
};

const extractIdentifier = (
  idObj?: { identifier?: string } | { identifier?: string }[]
): string | undefined => {
  if (Array.isArray(idObj)) return idObj[0]?.identifier?.trim();
  return idObj?.identifier?.trim();
};

const normalizeFunderId = (identifier?: string): string | undefined => {
  if (!identifier) return undefined;

  if (identifier.includes('ror.org')) return identifier;
  return identifier.startsWith('http') ? identifier : `https://ror.org/${identifier}`;
};

const extensionKey = (projectIdentifier?: string, funderIdentifier?: string): string => {
  return `${projectIdentifier ?? ''}|${funderIdentifier ?? ''}`;
};

const indexByProjectAndFunder = (
  extensions: FundingExtensionType[] | undefined,
  valueKey: 'opportunity_identifier' | 'project_identifier'
): Record<string, string[]> => {
  return (extensions ?? []).reduce((acc: Record<string, string[]>, ext: FundingExtensionType) => {
    const projectIdentifier = extractIdentifier(ext.project_id);
    const funderIdentifier = normalizeFunderId(ext.funder_id?.identifier?.trim());
    const value = ext[valueKey]?.identifier?.trim();

    if (!value) return acc;

    const key = extensionKey(projectIdentifier, funderIdentifier);
    acc[key] ??= [];
    acc[key].push(value);
    return acc;
  }, {});
};

/**
 * Workflow to convert maDMP funding information into ProjectFunding and PlanFunding
 * records and persist them in GraphQL.
 */
export const saveFundingWorkflow = async (
  request: FastifyRequest,
  project: Project,
  plan: Plan,
  dmp: DMPToolDMPType['dmp']
): Promise<Plan> => {
  const dmpProject: DmpProjectType | undefined = dmp.project?.[0];
  const dmpFundings: DmpFundingType[] = dmpProject?.funding ?? [];

  const opportunityIndex = indexByProjectAndFunder(
    dmp.funding_opportunity as FundingExtensionType[],
    'opportunity_identifier'
  );
  const projectNumberIndex = indexByProjectAndFunder(
    dmp.funding_project as FundingExtensionType[],
    'project_identifier'
  );

  const projectIdentifier = extractIdentifier(dmpProject?.project_id);

  const projectFundings: ProjectFunding[] = await Promise.all(
    dmpFundings.map(async (funding: DmpFundingType): Promise<ProjectFunding> => {
      const funderIdentifier = normalizeFunderId(
                funding.funder_id?.identifier?.trim()
      );
      const extKey = extensionKey(projectIdentifier, funderIdentifier);

      const affiliation = new Affiliation({
        uri: funderIdentifier,
        name: funding.name?.trim(),
        funder: true,
      });

      return new ProjectFunding({
        project,
        affiliation,
        status: toStatus(funding.funding_status),
        grantId: funding.grant_id?.identifier?.trim(),
        funderOpportunityNumber: opportunityIndex[extKey]?.shift(),
        funderProjectNumber: projectNumberIndex[extKey]?.shift(),
      });
    })
  );

  if (!(await ProjectFunding.save(request, project, projectFundings))) {
    request.log.error(
      { dmpId: plan.dmpId, projectId: project.id, errors: project.errors },
      'Unable to save project funding for the plan'
    );
    plan.errors.fundings = project.errors.fundings;
    return plan;
  }

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



