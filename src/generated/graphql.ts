/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AddProjectFundingInput = {
  /** The funder URI */
  affiliationId: string;
  /** The funder's unique id/url for the call for submissions to apply for a grant */
  funderOpportunityNumber?: string | null | undefined;
  /** The funder's unique id/url for the research project (normally assigned after the grant has been awarded) */
  funderProjectNumber?: string | null | undefined;
  /** The funder's unique id/url for the award/grant (normally assigned after the grant has been awarded) */
  grantId?: string | null | undefined;
  /** The project */
  projectId: number;
  /** The status of the funding resquest */
  status?: ProjectFundingStatus | null | undefined;
};

export type AddProjectMemberInput = {
  /** The Member's affiliation URI */
  affiliationId?: string | null | undefined;
  /** The Member's affiliation name */
  affiliationName?: string | null | undefined;
  /** The Member's email address */
  email?: string | null | undefined;
  /** The Member's first/given name */
  givenName?: string | null | undefined;
  /** The roles the Member has on the research project */
  memberRoleIds?: Array<number> | null | undefined;
  /** The Member's ORCID */
  orcid?: string | null | undefined;
  /** The research project */
  projectId: number;
  /** The Member's last/sur name */
  surName?: string | null | undefined;
};

/** Input for email domains linked to the affiliation for purposes of determining if SSO is applicable */
export type AffiliationEmailDomainInput = {
  /** The email domain (e.g. example.com, law.example.com, etc.) */
  domain: string;
  /** Unique identifier for the email domain */
  id: number;
};

/** Input options for adding an Affiliation */
export type AffiliationInput = {
  /** Acronyms for the affiliation */
  acronyms?: Array<string> | null | undefined;
  /** Whether or not the Affiliation is active and available in search results */
  active?: boolean | null | undefined;
  /** Alias names for the affiliation */
  aliases?: Array<string> | null | undefined;
  /** The primary contact email */
  contactEmail?: string | null | undefined;
  /** The primary contact name */
  contactName?: string | null | undefined;
  /** The display name to help disambiguate similar names (typically with domain or country appended) */
  displayName?: string | null | undefined;
  /** The email address(es) to notify when feedback has been requested (stored as JSON array) */
  feedbackEmails?: Array<string | null | undefined> | null | undefined;
  /** Whether or not the affiliation wants to use the feedback workflow */
  feedbackEnabled?: boolean | null | undefined;
  /** The message to display to users when they request feedback */
  feedbackMessage?: string | null | undefined;
  /** Whether or not this affiliation is a funder */
  funder?: boolean | null | undefined;
  /** The Crossref Funder id */
  fundrefId?: string | null | undefined;
  /** The official homepage for the affiliation */
  homepage?: string | null | undefined;
  /** The id of the affiliation */
  id?: number | null | undefined;
  /** The logo file name */
  logoName?: string | null | undefined;
  /** The URI of the logo */
  logoURI?: string | null | undefined;
  /** Whether or not the affiliation is allowed to have administrators */
  managed?: boolean | null | undefined;
  /** The official name for the affiliation (defined by the system of provenance) */
  name: string;
  /** The email domains associated with the affiliation (for SSO) */
  ssoEmailDomains?: Array<AffiliationEmailDomainInput> | null | undefined;
  /** The SSO entityId */
  ssoEntityId?: string | null | undefined;
  /** The links the affiliation's users can use to get help */
  subHeaderLinks?: Array<AffiliationLinkInput> | null | undefined;
  /** The types of the affiliation (e.g. Company, Education, Government, etc.) */
  types?: Array<AffiliationType> | null | undefined;
  /** The unique identifer for the affiliation (Not editable!) */
  uri?: string | null | undefined;
};

/** Input for a hyperlink displayed in the sub-header of the UI for the afiliation's users */
export type AffiliationLinkInput = {
  /** Unique identifier for the link */
  id: number;
  /** The text to display (e.g. Helpdesk, Grants Office, etc.) */
  text?: string | null | undefined;
  /** The URL */
  url: string;
};

/** Categories for Affiliation */
export type AffiliationType =
  | 'ARCHIVE'
  | 'COMPANY'
  | 'EDUCATION'
  | 'FACILITY'
  | 'GOVERNMENT'
  | 'HEALTHCARE'
  | 'NONPROFIT'
  | 'OTHER';

/** The status/state of the plan */
export type PlanStatus =
  /** The Plan has been archived */
  | 'ARCHIVED'
  /** The Plan is ready for submission or download */
  | 'COMPLETE'
  /** The Plan is still being written and reviewed */
  | 'DRAFT';

/** The visibility/privacy setting for the plan */
export type PlanVisibility =
  /** Visible only to people at the user's (or editor's) affiliation */
  | 'ORGANIZATIONAL'
  /** Visible only to people who have been invited to collaborate (or provide feedback) */
  | 'PRIVATE'
  /** Visible to anyone */
  | 'PUBLIC';

export type ProjectCollaboratorAccessLevel =
  /** The user is ONLY able to comment on the Plan's answers */
  | 'COMMENT'
  /** The user is able to perform most actions on a Project/Plan except (publish, mark as complete and change access) */
  | 'EDIT'
  /** Has admin rights to project (can invite other users, edit the plans and publish them) */
  | 'OWN'
  /** The user is able to perform all actions on a Plan (typically restricted to the owner/creator) */
  | 'PRIMARY';

/** The status of the funding */
export type ProjectFundingStatus =
  /** The funder did not award the project */
  | 'DENIED'
  /** The funding has been awarded to the project */
  | 'GRANTED'
  /** The project will be submitting a grant, or has not yet heard back from the funder */
  | 'PLANNED';

export type UpdateProjectFundingInput = {
  /** The funder's unique id/url for the call for submissions to apply for a grant */
  funderOpportunityNumber?: string | null | undefined;
  /** The funder's unique id/url for the research project (normally assigned after the grant has been awarded) */
  funderProjectNumber?: string | null | undefined;
  /** The funder's unique id/url for the award/grant (normally assigned after the grant has been awarded) */
  grantId?: string | null | undefined;
  /** The project funder */
  projectFundingId: number;
  /** The status of the funding resquest */
  status?: ProjectFundingStatus | null | undefined;
};

export type UpdateProjectInput = {
  /** The research project description/abstract */
  abstractText?: string | null | undefined;
  /** The actual or anticipated end date of the project */
  endDate?: string | null | undefined;
  /** The project's id */
  id: number;
  /** Whether or not the project is a mock/test */
  isTestProject?: boolean | null | undefined;
  /** The id of the research domain */
  researchDomainId?: number | null | undefined;
  /** The actual or anticipated start date for the project */
  startDate?: string | null | undefined;
  /** The title of the research project */
  title: string;
};

export type UpdateProjectMemberInput = {
  /** The Member's affiliation URI */
  affiliationId?: string | null | undefined;
  /** The Member's email address */
  email?: string | null | undefined;
  /** The Member's first/given name */
  givenName?: string | null | undefined;
  /** The roles the Member has on the research project */
  memberRoleIds?: Array<number> | null | undefined;
  /** The Member's ORCID */
  orcid?: string | null | undefined;
  /** The project Member */
  projectMemberId: number;
  /** The Member's last/sur name */
  surName?: string | null | undefined;
};

export type AddAffiliationMutationVariables = Exact<{
  input: AffiliationInput;
}>;


export type AddAffiliationMutation = { addAffiliation: { id: number | null, name: string, uri: string, errors: { general: string | null, uri: string | null, name: string | null, displayName: string | null, searchName: string | null, provenance: string | null } | null } | null };

export type AddProjectCollaboratorMutationVariables = Exact<{
  projectId: number;
  email: string;
}>;


export type AddProjectCollaboratorMutation = { addProjectCollaborator: { id: number | null, email: string, accessLevel: ProjectCollaboratorAccessLevel | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, user: { id: number | null, email: string | null } | null, invitedBy: { id: number | null, email: string | null } | null, errors: { general: string | null, email: string | null, accessLevel: string | null } | null } | null };

export type UpdateProjectCollaboratorMutationVariables = Exact<{
  projectCollaboratorId: number;
  accessLevel: ProjectCollaboratorAccessLevel;
}>;


export type UpdateProjectCollaboratorMutation = { updateProjectCollaborator: { id: number | null, modified: string | null, modifiedById: number | null, accessLevel: ProjectCollaboratorAccessLevel | null, errors: { general: string | null, accessLevel: string | null } | null } | null };

export type RemoveProjectCollaboratorMutationVariables = Exact<{
  projectCollaboratorId: number;
}>;


export type RemoveProjectCollaboratorMutation = { removeProjectCollaborator: { id: number | null, modified: string | null, modifiedById: number | null, errors: { general: string | null } | null } | null };

export type AddProjectFundingMutationVariables = Exact<{
  input: AddProjectFundingInput;
}>;


export type AddProjectFundingMutation = { addProjectFunding: { id: number | null, status: ProjectFundingStatus | null, funderOpportunityNumber: string | null, funderProjectNumber: string | null, grantId: string | null, affiliation: { uri: string, name: string } | null, errors: { general: string | null, projectId: string | null, affiliationId: string | null, status: string | null, funderProjectNumber: string | null, grantId: string | null, funderOpportunityNumber: string | null } | null } | null };

export type UpdateProjectFundingMutationVariables = Exact<{
  input: UpdateProjectFundingInput;
}>;


export type UpdateProjectFundingMutation = { updateProjectFunding: { id: number | null, status: ProjectFundingStatus | null, funderOpportunityNumber: string | null, funderProjectNumber: string | null, grantId: string | null, affiliation: { uri: string, name: string } | null, errors: { general: string | null, projectId: string | null, affiliationId: string | null, status: string | null, funderProjectNumber: string | null, grantId: string | null, funderOpportunityNumber: string | null } | null } | null };

export type RemoveProjectFundingMutationVariables = Exact<{
  projectFundingId: number;
}>;


export type RemoveProjectFundingMutation = { removeProjectFunding: { id: number | null, errors: { general: string | null, projectId: string | null, affiliationId: string | null, status: string | null, funderProjectNumber: string | null, grantId: string | null, funderOpportunityNumber: string | null } | null } | null };

export type AddPlanFundingMutationVariables = Exact<{
  planId: number;
  projectFundingIds: Array<number> | number;
}>;


export type AddPlanFundingMutation = { addPlanFunding: { id: number | null, fundings: Array<{ id: number | null, projectFunding: { id: number | null } | null }> | null, errors: { general: string | null } | null } | null };

export type UpdatePlanFundingMutationVariables = Exact<{
  planId: number;
  projectFundingIds: Array<number> | number;
}>;


export type UpdatePlanFundingMutation = { updatePlanFunding: Array<{ id: number | null, projectFunding: { id: number | null } | null, errors: { general: string | null, planId: string | null, ProjectFundingId: string | null } | null } | null> | null };

export type RemovePlanFundingMutationVariables = Exact<{
  planFundingId: number;
}>;


export type RemovePlanFundingMutation = { removePlanFunding: { id: number | null, projectFunding: { id: number | null } | null, errors: { general: string | null, planId: string | null, ProjectFundingId: string | null } | null } | null };

export type AddProjectMemberMutationVariables = Exact<{
  input: AddProjectMemberInput;
}>;


export type AddProjectMemberMutation = { addProjectMember: { id: number | null, givenName: string | null, surName: string | null, orcid: string | null, email: string | null, isPrimaryContact: boolean | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, project: { id: number | null } | null, affiliation: { uri: string, name: string } | null, memberRoles: Array<{ id: number | null, uri: string }> | null, errors: { general: string | null, projectId: string | null, affiliationId: string | null, givenName: string | null, surName: string | null, orcid: string | null, email: string | null, memberRoleIds: string | null } | null } | null };

export type UpdateProjectMemberMutationVariables = Exact<{
  input: UpdateProjectMemberInput;
}>;


export type UpdateProjectMemberMutation = { updateProjectMember: { id: number | null, givenName: string | null, surName: string | null, orcid: string | null, email: string | null, isPrimaryContact: boolean | null, modified: string | null, modifiedById: number | null, project: { id: number | null } | null, affiliation: { uri: string, name: string } | null, memberRoles: Array<{ id: number | null, uri: string }> | null, errors: { general: string | null, projectId: string | null, affiliationId: string | null, givenName: string | null, surName: string | null, orcid: string | null, email: string | null, memberRoleIds: string | null } | null } | null };

export type RemoveProjectMemberMutationVariables = Exact<{
  projectMemberId: number;
}>;


export type RemoveProjectMemberMutation = { removeProjectMember: { id: number | null, modified: string | null, modifiedById: number | null, errors: { general: string | null } | null } | null };

export type AddPlanMemberMutationVariables = Exact<{
  planId: number;
  projectMemberId: number;
  roleIds: Array<number> | number;
}>;


export type AddPlanMemberMutation = { addPlanMember: { id: number | null, isPrimaryContact: boolean | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, projectMember: { id: number | null } | null, memberRoles: Array<{ id: number | null, uri: string }> | null, errors: { general: string | null, projectMemberId: string | null, memberRoleIds: string | null } | null } | null };

export type UpdatePlanMemberMutationVariables = Exact<{
  planId: number;
  planMemberId: number;
  memberRoleIds?: Array<number> | number | null | undefined;
  isPrimaryContact?: boolean | null | undefined;
}>;


export type UpdatePlanMemberMutation = { updatePlanMember: { id: number | null, isPrimaryContact: boolean | null, modified: string | null, modifiedById: number | null, projectMember: { id: number | null } | null, memberRoles: Array<{ id: number | null, uri: string }> | null, errors: { general: string | null, projectMemberId: string | null, memberRoleIds: string | null } | null } | null };

export type RemovePlanMemberMutationVariables = Exact<{
  planMemberId: number;
}>;


export type RemovePlanMemberMutation = { removePlanMember: { id: number | null, modified: string | null, modifiedById: number | null, errors: { general: string | null } | null } | null };

export type AddPlanMutationVariables = Exact<{
  projectId: number;
  versionedTemplateId: number;
}>;


export type AddPlanMutation = { addPlan: { id: number | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, dmpId: string | null, errors: { general: string | null, versionedTemplateId: string | null, projectId: string | null } | null } | null };

export type UpdatePlanStatusMutationVariables = Exact<{
  planId: number;
  status: PlanStatus;
}>;


export type UpdatePlanStatusMutation = { updatePlanStatus: { id: number | null, modified: string | null, modifiedById: number | null, status: PlanStatus | null, visibility: PlanVisibility | null, errors: { general: string | null, status: string | null } | null } | null };

export type UpdatePlanTitleMutationVariables = Exact<{
  planId: number;
  title: string;
}>;


export type UpdatePlanTitleMutation = { updatePlanTitle: { id: number | null, modified: string | null, modifiedById: number | null, title: string | null, errors: { general: string | null, title: string | null } | null } | null };

export type ArchivePlanMutationVariables = Exact<{
  planId: number;
}>;


export type ArchivePlanMutation = { archivePlan: { id: number | null, modified: string | null, modifiedById: number | null, errors: { general: string | null } | null } | null };

export type AddAlternateIdentifierMutationVariables = Exact<{
  planId: number;
  alternateIdentifier: string;
}>;


export type AddAlternateIdentifierMutation = { addAlternateIdentifierToPlan: { id: number | null, alternateIdentifier: string | null, errors: { general: string | null, alternateIdentifier: string | null, planId: string | null } | null, plan: { id: number | null } | null } | null };

export type RemoveAlternateIdentifierMutationVariables = Exact<{
  planId: number;
  alternateIdentifier: string;
}>;


export type RemoveAlternateIdentifierMutation = { removeAlternateIdentifierFromPlan: { id: number | null, alternateIdentifier: string | null, errors: { general: string | null, alternateIdentifier: string | null, planId: string | null } | null, plan: { id: number | null } | null } | null };

export type AddProjectMutationVariables = Exact<{
  title: string;
  isTestProject?: boolean | null | undefined;
}>;


export type AddProjectMutation = { addProject: { id: number | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, errors: { title: string | null, general: string | null } | null } | null };

export type UpdateProjectMutationVariables = Exact<{
  input: UpdateProjectInput;
}>;


export type UpdateProjectMutation = { updateProject: { id: number | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, errors: { general: string | null, title: string | null, abstractText: string | null, endDate: string | null, startDate: string | null, researchDomainId: string | null } | null } | null };

export type ArchiveProjectMutationVariables = Exact<{
  projectId: number;
}>;


export type ArchiveProjectMutation = { archiveProject: { id: number | null, modified: string | null, modifiedById: number | null, errors: { general: string | null } | null } | null };

export type AffiliationByUriQueryVariables = Exact<{
  uri: string;
}>;


export type AffiliationByUriQuery = { affiliationByURI: { id: number | null, uri: string, name: string, funder: boolean, provenance: string } | null };

export type AffiliationsQueryVariables = Exact<{
  name: string;
  funderOnly: boolean;
}>;


export type AffiliationsQuery = { affiliations: { items: Array<{ id: number, uri: string, name: string, aliases: Array<string> | null, acronyms: Array<string> | null, funder: boolean } | null> | null } | null };

export type ProjectCollaboratorsQueryVariables = Exact<{
  projectId: number;
}>;


export type ProjectCollaboratorsQuery = { projectCollaborators: Array<{ id: number | null, email: string, accessLevel: ProjectCollaboratorAccessLevel | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, project: { id: number | null } | null, user: { id: number | null, email: string | null } | null, invitedBy: { id: number | null, email: string | null } | null } | null> | null };

export type ProjectFundingsQueryVariables = Exact<{
  projectId: number;
}>;


export type ProjectFundingsQuery = { projectFundings: Array<{ id: number | null, status: ProjectFundingStatus | null, funderOpportunityNumber: string | null, funderProjectNumber: string | null, grantId: string | null, affiliation: { uri: string, name: string } | null, errors: { general: string | null, projectId: string | null, affiliationId: string | null, status: string | null, funderProjectNumber: string | null, grantId: string | null, funderOpportunityNumber: string | null } | null } | null> | null };

export type PlanFundingsQueryVariables = Exact<{
  planId: number;
}>;


export type PlanFundingsQuery = { planFundings: Array<{ id: number | null, projectFunding: { id: number | null } | null, errors: { general: string | null, planId: string | null, ProjectFundingId: string | null } | null } | null> | null };

export type ProjectMembersQueryVariables = Exact<{
  projectId: number;
}>;


export type ProjectMembersQuery = { projectMembers: Array<{ id: number | null, givenName: string | null, surName: string | null, orcid: string | null, email: string | null, isPrimaryContact: boolean | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, project: { id: number | null } | null, affiliation: { uri: string, name: string } | null, memberRoles: Array<{ id: number | null, uri: string }> | null } | null> | null };

export type PlanMembersQueryVariables = Exact<{
  planId: number;
}>;


export type PlanMembersQuery = { planMembers: Array<{ id: number | null, isPrimaryContact: boolean | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, plan: { id: number | null } | null, projectMember: { id: number | null } | null, memberRoles: Array<{ id: number | null, uri: string }> | null } | null> | null };

export type MemberRolesQueryVariables = Exact<{ [key: string]: never; }>;


export type MemberRolesQuery = { memberRoles: Array<{ id: number | null, uri: string, label: string, description: string | null, isDefault: boolean | null } | null> | null };

export type PlanQueryVariables = Exact<{
  planId: number;
}>;


export type PlanQuery = { plan: { id: number | null, dmpId: string | null, title: string | null, visibility: PlanVisibility | null, status: PlanStatus | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, registered: string | null, project: { id: number | null } | null, members: Array<{ isPrimaryContact: boolean | null, projectMember: { id: number | null } | null, memberRoles: Array<{ id: number | null, uri: string }> | null }> | null, fundings: Array<{ id: number | null, projectFunding: { id: number | null } | null }> | null, versionedTemplate: { name: string, description: string | null, version: string, template: { id: number | null } | null } | null, alternateIdentifiers: Array<{ id: number | null, alternateIdentifier: string | null }> | null } | null };

export type PlansQueryVariables = Exact<{
  projectId: number;
}>;


export type PlansQuery = { plans: Array<{ id: number | null, title: string | null }> | null };

export type PlanByDmpIdQueryVariables = Exact<{
  dmpId: string;
}>;


export type PlanByDmpIdQuery = { planByDMPId: { id: number | null, dmpId: string | null, title: string | null, visibility: PlanVisibility | null, status: PlanStatus | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, registered: string | null, project: { title: string, abstractText: string | null, startDate: string | null, endDate: string | null, isTestProject: boolean | null, researchDomain: { id: number | null, parentResearchDomainId: number | null } | null } | null, fundings: Array<{ id: number | null, projectFunding: { id: number | null } | null }> | null, versionedTemplate: { name: string, description: string | null, version: string, template: { id: number | null } | null } | null } | null };

export type PlanByAlternateIdentifierQueryVariables = Exact<{
  alternateIdentifier: string;
}>;


export type PlanByAlternateIdentifierQuery = { planByAlternateIdentifier: { id: number | null, dmpId: string | null, title: string | null, visibility: PlanVisibility | null, status: PlanStatus | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, registered: string | null, project: { title: string, abstractText: string | null, startDate: string | null, endDate: string | null, isTestProject: boolean | null, researchDomain: { id: number | null, parentResearchDomainId: number | null } | null } | null, versionedTemplate: { name: string, description: string | null, version: string, template: { id: number | null } | null } | null } | null };

export type ProjectQueryVariables = Exact<{
  projectId: number;
}>;


export type ProjectQuery = { project: { id: number | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null, title: string, abstractText: string | null, startDate: string | null, endDate: string | null, isTestProject: boolean | null, researchDomain: { id: number | null, uri: string, name: string } | null, plans: Array<{ id: number | null, title: string | null }> | null, members: Array<{ id: number | null, givenName: string | null, surName: string | null, email: string | null, orcid: string | null, isPrimaryContact: boolean | null, affiliation: { uri: string, name: string } | null, memberRoles: Array<{ id: number | null, uri: string }> | null }> | null, fundings: Array<{ id: number | null, status: ProjectFundingStatus | null, funderOpportunityNumber: string | null, funderProjectNumber: string | null, grantId: string | null, affiliation: { uri: string, name: string } | null }> | null } | null };

export type MyProjectsQueryVariables = Exact<{
  term?: string | null | undefined;
}>;


export type MyProjectsQuery = { myProjects: { items: Array<{ id: number | null, title: string | null, abstractText: string | null, endDate: string | null, startDate: string | null, researchDomain: string | null, created: string | null, createdById: number | null, modified: string | null, modifiedById: number | null } | null> | null } | null };

export type ResearchDomainByUriQueryVariables = Exact<{
  uri: string;
}>;


export type ResearchDomainByUriQuery = { researchDomainByURI: { id: number | null, uri: string, name: string } | null };

export type VersionedTemplatesQueryVariables = Exact<{
  templateId: number;
}>;


export type VersionedTemplatesQuery = { templateVersions: Array<{ id: number | null, name: string, version: string, active: boolean, template: { id: number | null } | null } | null> | null };

export type DefaultTemplateQueryVariables = Exact<{ [key: string]: never; }>;


export type DefaultTemplateQuery = { defaultTemplate: { id: number | null, name: string, version: string, active: boolean, template: { id: number | null } | null } | null };


export const AddAffiliationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAffiliation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AffiliationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAffiliation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"searchName"}},{"kind":"Field","name":{"kind":"Name","value":"provenance"}}]}}]}}]}}]} as unknown as DocumentNode<AddAffiliationMutation, AddAffiliationMutationVariables>;
export const AddProjectCollaboratorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddProjectCollaborator"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addProjectCollaborator"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"accessLevel"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"invitedBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"accessLevel"}}]}}]}}]}}]} as unknown as DocumentNode<AddProjectCollaboratorMutation, AddProjectCollaboratorMutationVariables>;
export const UpdateProjectCollaboratorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProjectCollaborator"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectCollaboratorId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accessLevel"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ProjectCollaboratorAccessLevel"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProjectCollaborator"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectCollaboratorId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectCollaboratorId"}}},{"kind":"Argument","name":{"kind":"Name","value":"accessLevel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accessLevel"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"accessLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"accessLevel"}}]}}]}}]} as unknown as DocumentNode<UpdateProjectCollaboratorMutation, UpdateProjectCollaboratorMutationVariables>;
export const RemoveProjectCollaboratorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveProjectCollaborator"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectCollaboratorId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeProjectCollaborator"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectCollaboratorId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectCollaboratorId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveProjectCollaboratorMutation, RemoveProjectCollaboratorMutationVariables>;
export const AddProjectFundingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddProjectFunding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddProjectFundingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addProjectFunding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliationId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}}]}}]}}]}}]} as unknown as DocumentNode<AddProjectFundingMutation, AddProjectFundingMutationVariables>;
export const UpdateProjectFundingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProjectFunding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProjectFundingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProjectFunding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliationId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateProjectFundingMutation, UpdateProjectFundingMutationVariables>;
export const RemoveProjectFundingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveProjectFunding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectFundingId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeProjectFunding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectFundingId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectFundingId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliationId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveProjectFundingMutation, RemoveProjectFundingMutationVariables>;
export const AddPlanFundingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddPlanFunding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectFundingIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addPlanFunding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"projectFundingIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectFundingIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fundings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectFunding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<AddPlanFundingMutation, AddPlanFundingMutationVariables>;
export const UpdatePlanFundingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePlanFunding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectFundingIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePlanFunding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"projectFundingIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectFundingIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectFunding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"planId"}},{"kind":"Field","name":{"kind":"Name","value":"ProjectFundingId"}}]}}]}}]}}]} as unknown as DocumentNode<UpdatePlanFundingMutation, UpdatePlanFundingMutationVariables>;
export const RemovePlanFundingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemovePlanFunding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planFundingId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removePlanFunding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planFundingId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planFundingId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectFunding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"planId"}},{"kind":"Field","name":{"kind":"Name","value":"ProjectFundingId"}}]}}]}}]}}]} as unknown as DocumentNode<RemovePlanFundingMutation, RemovePlanFundingMutationVariables>;
export const AddProjectMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddProjectMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddProjectMemberInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addProjectMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"surName"}},{"kind":"Field","name":{"kind":"Name","value":"orcid"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliationId"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"surName"}},{"kind":"Field","name":{"kind":"Name","value":"orcid"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoleIds"}}]}}]}}]}}]} as unknown as DocumentNode<AddProjectMemberMutation, AddProjectMemberMutationVariables>;
export const UpdateProjectMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProjectMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProjectMemberInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProjectMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"surName"}},{"kind":"Field","name":{"kind":"Name","value":"orcid"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliationId"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"surName"}},{"kind":"Field","name":{"kind":"Name","value":"orcid"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoleIds"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateProjectMemberMutation, UpdateProjectMemberMutationVariables>;
export const RemoveProjectMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveProjectMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectMemberId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeProjectMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectMemberId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectMemberId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveProjectMemberMutation, RemoveProjectMemberMutationVariables>;
export const AddPlanMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddPlanMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectMemberId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"roleIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addPlanMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"projectMemberId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectMemberId"}}},{"kind":"Argument","name":{"kind":"Name","value":"roleIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"roleIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectMember"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectMemberId"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoleIds"}}]}}]}}]}}]} as unknown as DocumentNode<AddPlanMemberMutation, AddPlanMemberMutationVariables>;
export const UpdatePlanMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePlanMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planMemberId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"memberRoleIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPrimaryContact"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePlanMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"planMemberId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planMemberId"}}},{"kind":"Argument","name":{"kind":"Name","value":"memberRoleIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"memberRoleIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPrimaryContact"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPrimaryContact"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectMember"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectMemberId"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoleIds"}}]}}]}}]}}]} as unknown as DocumentNode<UpdatePlanMemberMutation, UpdatePlanMemberMutationVariables>;
export const RemovePlanMemberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemovePlanMember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planMemberId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removePlanMember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planMemberId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planMemberId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<RemovePlanMemberMutation, RemovePlanMemberMutationVariables>;
export const AddPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionedTemplateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionedTemplateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionedTemplateId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"dmpId"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"versionedTemplateId"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}}]}}]}}]}}]} as unknown as DocumentNode<AddPlanMutation, AddPlanMutationVariables>;
export const UpdatePlanStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePlanStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlanStatus"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePlanStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}}]}}]}}]} as unknown as DocumentNode<UpdatePlanStatusMutation, UpdatePlanStatusMutationVariables>;
export const UpdatePlanTitleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePlanTitle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePlanTitle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<UpdatePlanTitleMutation, UpdatePlanTitleMutationVariables>;
export const ArchivePlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchivePlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archivePlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<ArchivePlanMutation, ArchivePlanMutationVariables>;
export const AddAlternateIdentifierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAlternateIdentifier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"alternateIdentifier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAlternateIdentifierToPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"alternateIdentifier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"alternateIdentifier"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"alternateIdentifier"}},{"kind":"Field","name":{"kind":"Name","value":"planId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"alternateIdentifier"}},{"kind":"Field","name":{"kind":"Name","value":"plan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<AddAlternateIdentifierMutation, AddAlternateIdentifierMutationVariables>;
export const RemoveAlternateIdentifierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAlternateIdentifier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"alternateIdentifier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeAlternateIdentifierFromPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}},{"kind":"Argument","name":{"kind":"Name","value":"alternateIdentifier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"alternateIdentifier"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"alternateIdentifier"}},{"kind":"Field","name":{"kind":"Name","value":"planId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"alternateIdentifier"}},{"kind":"Field","name":{"kind":"Name","value":"plan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveAlternateIdentifierMutation, RemoveAlternateIdentifierMutationVariables>;
export const AddProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isTestProject"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}},{"kind":"Argument","name":{"kind":"Name","value":"isTestProject"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isTestProject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<AddProjectMutation, AddProjectMutationVariables>;
export const UpdateProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"abstractText"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"researchDomainId"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateProjectMutation, UpdateProjectMutationVariables>;
export const ArchiveProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiveProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}}]}}]}}]}}]} as unknown as DocumentNode<ArchiveProjectMutation, ArchiveProjectMutationVariables>;
export const AffiliationByUriDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"affiliationByURI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"uri"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affiliationByURI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"uri"},"value":{"kind":"Variable","name":{"kind":"Name","value":"uri"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"funder"}},{"kind":"Field","name":{"kind":"Name","value":"provenance"}}]}}]}}]} as unknown as DocumentNode<AffiliationByUriQuery, AffiliationByUriQueryVariables>;
export const AffiliationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Affiliations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"funderOnly"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affiliations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"funderOnly"},"value":{"kind":"Variable","name":{"kind":"Name","value":"funderOnly"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"aliases"}},{"kind":"Field","name":{"kind":"Name","value":"acronyms"}},{"kind":"Field","name":{"kind":"Name","value":"funder"}}]}}]}}]}}]} as unknown as DocumentNode<AffiliationsQuery, AffiliationsQueryVariables>;
export const ProjectCollaboratorsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"projectCollaborators"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectCollaborators"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"invitedBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"accessLevel"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}}]}}]}}]} as unknown as DocumentNode<ProjectCollaboratorsQuery, ProjectCollaboratorsQueryVariables>;
export const ProjectFundingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProjectFundings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectFundings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"affiliationId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}}]}}]}}]}}]} as unknown as DocumentNode<ProjectFundingsQuery, ProjectFundingsQueryVariables>;
export const PlanFundingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlanFundings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"planFundings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectFunding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"general"}},{"kind":"Field","name":{"kind":"Name","value":"planId"}},{"kind":"Field","name":{"kind":"Name","value":"ProjectFundingId"}}]}}]}}]}}]} as unknown as DocumentNode<PlanFundingsQuery, PlanFundingsQueryVariables>;
export const ProjectMembersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"projectMembers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectMembers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"surName"}},{"kind":"Field","name":{"kind":"Name","value":"orcid"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}}]}}]}}]} as unknown as DocumentNode<ProjectMembersQuery, ProjectMembersQueryVariables>;
export const PlanMembersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"planMembers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"planMembers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"plan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"projectMember"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}}]}}]}}]} as unknown as DocumentNode<PlanMembersQuery, PlanMembersQueryVariables>;
export const MemberRolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MemberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}}]}}]} as unknown as DocumentNode<MemberRolesQuery, MemberRolesQueryVariables>;
export const PlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Plan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"planId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"plan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"planId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"planId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dmpId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"registered"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectMember"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"fundings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectFunding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"versionedTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"template"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"alternateIdentifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"alternateIdentifier"}}]}}]}}]}}]} as unknown as DocumentNode<PlanQuery, PlanQueryVariables>;
export const PlansDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Plans"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"plans"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<PlansQuery, PlansQueryVariables>;
export const PlanByDmpIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlanByDmpId"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dmpId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"planByDMPId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"dmpId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dmpId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dmpId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"registered"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"abstractText"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"isTestProject"}},{"kind":"Field","name":{"kind":"Name","value":"researchDomain"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parentResearchDomainId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"fundings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectFunding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"versionedTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"template"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PlanByDmpIdQuery, PlanByDmpIdQueryVariables>;
export const PlanByAlternateIdentifierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlanByAlternateIdentifier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"alternateIdentifier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"planByAlternateIdentifier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"alternateIdentifier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"alternateIdentifier"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dmpId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"registered"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"abstractText"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"isTestProject"}},{"kind":"Field","name":{"kind":"Name","value":"researchDomain"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parentResearchDomainId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"versionedTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"template"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PlanByAlternateIdentifierQuery, PlanByAlternateIdentifierQueryVariables>;
export const ProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Project"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"project"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"abstractText"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"isTestProject"}},{"kind":"Field","name":{"kind":"Name","value":"researchDomain"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plans"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"surName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"orcid"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimaryContact"}},{"kind":"Field","name":{"kind":"Name","value":"memberRoles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"fundings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affiliation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"funderOpportunityNumber"}},{"kind":"Field","name":{"kind":"Name","value":"funderProjectNumber"}},{"kind":"Field","name":{"kind":"Name","value":"grantId"}}]}}]}}]}}]} as unknown as DocumentNode<ProjectQuery, ProjectQueryVariables>;
export const MyProjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyProjects"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"term"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myProjects"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"term"},"value":{"kind":"Variable","name":{"kind":"Name","value":"term"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"abstractText"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"researchDomain"}},{"kind":"Field","name":{"kind":"Name","value":"created"}},{"kind":"Field","name":{"kind":"Name","value":"createdById"}},{"kind":"Field","name":{"kind":"Name","value":"modified"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedById"}}]}}]}}]}}]} as unknown as DocumentNode<MyProjectsQuery, MyProjectsQueryVariables>;
export const ResearchDomainByUriDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ResearchDomainByURI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"uri"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"researchDomainByURI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"uri"},"value":{"kind":"Variable","name":{"kind":"Name","value":"uri"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uri"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ResearchDomainByUriQuery, ResearchDomainByUriQueryVariables>;
export const VersionedTemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"VersionedTemplates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templateVersions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"templateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"template"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<VersionedTemplatesQuery, VersionedTemplatesQueryVariables>;
export const DefaultTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DefaultTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"defaultTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"template"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<DefaultTemplateQuery, DefaultTemplateQueryVariables>;