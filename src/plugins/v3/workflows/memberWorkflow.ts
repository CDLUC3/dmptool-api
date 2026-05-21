import { FastifyRequest } from "fastify";
import { Project } from "../../../models/Project.js";
import { Plan } from "../../../models/Plan.js";
import { DMPToolDMPType } from "@dmptool/types";
import { MemberRole, MemberRoles } from "../../../models/MemberRole.js";
import { ProjectMember } from "../../../models/ProjectMember.js";
import { PlanMember } from "../../../models/PlanMember.js";

/**
 * Workflow to process a mADMP contact and contributor array and convert them into
 * Project and Plan Members, including saving them to the database. Any errors
 * encountered during the workflow are added to the Plan errors object.
 *
 * @param request the Fastify request
 * @param project the Project
 * @param plan the Plan
 * @param dmp the maDMP record
 */
export const saveMembersWorkflow = async (
  request: FastifyRequest,
  project: Project,
  plan: Plan,
  dmp: DMPToolDMPType['dmp']
): Promise<Plan> => {
  // Process the contributor and contact info to generate ProjectMembers
  const availableRoles = new MemberRoles({ roles: await MemberRole.all(request) });
  const projectMembers: ProjectMember[] = await ProjectMember.processMembers(
    request,
    project,
    plan,
    availableRoles,
    dmp
  );
  // If any errors were encountered while processing the contributor array and contact
  if (Plan.hasErrors(plan.errors)) {
    request.log.error(
      { planId: plan.id, contact: dmp.contact, contributors: dmp.contributor },
      'Unable to process contact and contributor information.'
    );
    return plan;
  }

  // If any errors were encountered while saving the Project Members
  if (!(await ProjectMember.save(request, project, projectMembers))) {
    // Log any errors, the Project.members error will have been set
    request.log.error(
      { dmpId: plan.dmpId, projectId: project.id, errors: project.errors },
      'Unable to save project members for the new plan'
    );
    return plan;
  }

  // Generate the PlanMember objects from the Project Members and then save them
  const planMembers: PlanMember[] = await PlanMember.fromProjectMembers(plan, projectMembers);
  if (!(await PlanMember.save(request, plan, planMembers))) {
    // Log any errors, the Project.members error will have been set
    request.log.error(
      { dmpId: plan.dmpId, planId: plan.id, errors: plan.errors },
      'Unable to save plan members for the new plan'
    );
  }
  return plan;
}
