import { FastifyRequest } from "fastify";
import {
  AnyResearchOutputTableColumnAnswerSchema,
  AnyResearchOutputTableColumnAnswerType,
  DefaultResearchOutputTableAnswer,
  DefaultResearchOutputTableColumnAnswerMap,
  DefaultResearchOutputTableRowAnswer,
  DMPToolDMPType,
  QuestionFormatsEnum,
  ResearchOutputTableAnswerType,
  ResearchOutputTableQuestionType,
  ResearchOutputTableRowAnswerSchema,
  ResearchOutputTableRowAnswerType,
  TextAnswerType,
} from "@dmptool/types";
import { Plan } from "../../../models/Plan.js";
import {
  DatasetsType,
  DatasetType,
  DistributionType,
  LicenseType,
  MetadataType,
  NarrativeQuestionType,
  NarrativeSectionType,
  NarrativeTemplateType
} from "../../../types.js";
import { VersionedQuestion } from "../../../models/VersionedTemplate.js";
import { Answer } from "../../../models/Answer.js";
import { convertMySQLDateTimeToRFC3339 } from "@dmptool/utils";
import {DMP_TOOL_CONTENT_TYPE} from "../routeSchema.js";

interface ProcessNarrativeResponse {
  question?: VersionedQuestion;
  answer?: Answer;
}

/**
 * Convert an entry from the maDMP narrative section into an answer
 *
 * @param request the Fastify request
 * @param plan the Plan
 * @param question the maDMP narrative question
 * @returns the Answer to the Versioned Question
 */
const fromMaDMPNarrative = (
  request: FastifyRequest,
  plan: Plan,
  question: NarrativeQuestionType
): Answer | undefined => {
  const logBase = { planId: plan.id, title: plan.title };

  // The Plan must have a versioned template
  if (!plan.versionedTemplate) {
    request.log.error(logBase, 'Plan does not have a versioned template!');
    return undefined;
  }

  // Find the question within the Plan's versioned template
  const versionedQuestion: VersionedQuestion | undefined = plan.versionedTemplate.findNarrativeQuestion(question);
  if (!versionedQuestion) {
    request.log.error({ ...logBase, question }, 'Specified question does not exist on versioned template');
    return undefined;
  }

  return new Answer({
    plan,
    versionedSectionId: versionedQuestion.versionedSectionId,
    versionedQuestionId: versionedQuestion.id,
    json: question.answer?.json,
  });
}

/**
 * Convert maDMP dataset entries into a Research Output Table Answer
 *
 * @param request the Fastify request
 * @param plan the Plan
 * @param question the Versioned Question
 * @param existingAnswer the current ResearchOutputTableAnswer derived from the maDMP narrative
 * @param datasets the maDMP dataset array
 * @returns the updated research output table answer
 */
const fromMaDMPDatasets = (
  request: FastifyRequest,
  plan: Plan,
  question: VersionedQuestion,
  existingAnswer: ResearchOutputTableAnswerType,
  datasets: DatasetsType,
): ResearchOutputTableAnswerType | undefined => {
  const logBase = { planId: plan.id, title: plan.title };
  const newAnswer: ResearchOutputTableAnswerType = structuredClone(existingAnswer);
  const roQuestion = JSON.parse(question.json) as ResearchOutputTableQuestionType;

  // The Plan must have a versioned template
  if (!plan.versionedTemplate) {
    request.log.error(logBase, 'Plan does not have a versioned template!');
    return undefined;
  }

  // Find the question within the Plan's versioned template
  const versionedQuestion: VersionedQuestion | undefined = plan.versionedTemplate.findQuestionById(question.id);
  if (!versionedQuestion) {
    request.log.error({ ...logBase, question }, 'Specified question does not exist on versioned template');
    return undefined;
  }

  // Convert the existing rows into a Map of title => row
  const existingTitles = new Map<string, ResearchOutputTableRowAnswerType>();
  for (const row of newAnswer.answer) {
    for (const column of row.columns) {
      if (column.commonStandardId === 'title') {
        existingTitles.set((column as TextAnswerType).answer.toLowerCase().trim(), row);
        break;
      }
    }
  }

  // Loop through the datasets
  for (const dataset of datasets) {
    // Try to find a match by the dataset title (since it is the only required column)
    // in the existing research output table answer
    const existingRow: ResearchOutputTableRowAnswerType | undefined = existingTitles.get(dataset.title.toLowerCase().trim());
    const workingRow = existingRow
      || initializeResearchOutputTableRow(roQuestion as ResearchOutputTableQuestionType);

    if (!existingRow) {
      newAnswer.answer.push(workingRow);
    }

    // Update the row
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'title', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'description', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'type', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'data_flags', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'data_access', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'byte_size', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'issued', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'host', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'metadata', dataset);
    researchOutputTableColumnFromMaDMPDataset(workingRow, 'license_ref', dataset);

    request.log.debug(
      { ...logBase, researchOutputTableRow: workingRow },
      'fromMaDMPDatasets - done processing dataset info'
    );
  }

  return newAnswer;
}

/**
 * Generate a new empty row for a research output table answer
 *
 * @param question the maDMP Research Output question
 * @returns a new Resource Output table answer row
 */
const initializeResearchOutputTableRow = (
  question: ResearchOutputTableQuestionType,
): ResearchOutputTableRowAnswerType => {
  const row: ResearchOutputTableRowAnswerType = ResearchOutputTableRowAnswerSchema.parse(
    DefaultResearchOutputTableRowAnswer
  );

  // Loop through each of the columns and generate a default answer column
  for (const column of question.columns) {
    const commonStandardId = column.commonStandardId ?? 'custom';
    const answer = AnyResearchOutputTableColumnAnswerSchema.parse(
      DefaultResearchOutputTableColumnAnswerMap[commonStandardId as keyof typeof DefaultResearchOutputTableColumnAnswerMap]
    );
    row.columns.push(answer);
  }

  return row;
}

/**
 * Convert the specified column (referenced by commonStandardId) in the maDMP
 * dataset entry into a RersearchOutputTableColumnAnswerType
 *
 * @param row the Research Output table row
 * @param commonStandardId the identifier of the field in the maDMP
 * @param dataset the maDMP dataset record
 * @returns the dataset information as a research output column
 */
const researchOutputTableColumnFromMaDMPDataset = (
  row: ResearchOutputTableRowAnswerType,
  commonStandardId: string,
  dataset: DatasetType
): AnyResearchOutputTableColumnAnswerType => {
  // Find the column with the matching commonStandardId
  const column = row.columns.find((col: AnyResearchOutputTableColumnAnswerType): boolean => {
    return col.commonStandardId === commonStandardId;
  });

  if (column) {
    // Process Sensitive and Personal info data flags
    if (commonStandardId === 'data_flags') {
      const dataFlags: string[] = [];
      if (dataset.sensitive_data === 'yes') dataFlags.push('sensitive')
      if (dataset.personal_data === 'yes') dataFlags.push('personal')

      column.answer = dataFlags;
      return column as AnyResearchOutputTableColumnAnswerType;
    }

    if (commonStandardId === 'host') {
      column.answer = dataset.distribution
        ?.filter((dist: DistributionType) => !!dist.host && !!dist.host.url)
        ?.map((dist: DistributionType) => ({
          repositoryId: dist.host.host_id?.identifier || dist.host.url,
          repositoryName: dist.host.title || '',
        }));
      return column as AnyResearchOutputTableColumnAnswerType;
    }

    if (commonStandardId === 'metadata') {
      column.answer = dataset.metadata
        ?.filter((meta: MetadataType) => !!meta.metadata_standard_id?.identifier)
        ?.map((meta: MetadataType) => ({
          metadataStandardId: meta.metadata_standard_id.identifier,
          repositoryName: meta.description?.slice(0, 50) || '',
        }));
      return column as AnyResearchOutputTableColumnAnswerType;
    }

    if (commonStandardId === 'license_ref') {
      const licenses = dataset.distribution?.flatMap((dist: DistributionType) => dist.license_ref || []);
      const now = new Date();
      const mostRecent = licenses
        ?.filter((lic: LicenseType) => !!lic.license_ref)
        ?.sort((licA: LicenseType, licB: LicenseType) => licB.start_date - licA.start_date) // sort descending
        ?.find((lic: LicenseType) => lic.start_date <= now);

      // The DMP Tool only allows one License, so use the one that is effective today
      column.answer = [{
        licenseId: mostRecent?.license_ref || '',
        licenseName: ''
      }];
      return column as AnyResearchOutputTableColumnAnswerType;
    }

    const distribution: DistributionType = dataset.distribution?.[0];
    switch (commonStandardId) {
      case 'title':
        column.answer = dataset.title?.trim() || dataset.description?.trim()?.slice(0, 15) || 'Default Dataset';
        break;
      case 'description':
        column.answer = dataset.description?.trim() || '';
        break;
      case 'type':
        column.answer = dataset.type?.trim()?.toLowerCase() || 'dataset';
        break;
      case 'data_access':
        switch (distribution?.data_access?.trim()?.toLowerCase()) {
          case 'open':
            column.answer = 'open';
            break;
          case 'shared':
            column.answer = 'restricted';
            break;
          default:
            column.answer = 'closed';
            break;
        }
        break;
      case 'issued':
        column.answer = convertMySQLDateTimeToRFC3339(distribution?.issued) || '';
        break;
      case 'byte_size':
        column.answer = {
          value: distribution?.byte_size?.toString() || '',
          context: 'bytes'
        }
        break;
      default:
        column.answer = dataset[commonStandardId]?.trim() || '';
        break;
    }
  }

  return column as AnyResearchOutputTableColumnAnswerType;
};

// Convert all the incoming answers and find their matching Question in the Versioned Template
const processNarrative = (
  request: FastifyRequest,
  plan: Plan,
  narrative: NarrativeTemplateType,
): ProcessNarrativeResponse[] => {
  if (!plan || !plan.versionedTemplate) return [];

  // Gather all questions from both the narrative and the Versioned Template
  const questions: ProcessNarrativeResponse[] = [];
  const narrativeQuestions: NarrativeQuestionType[] = narrative.section.flatMap(
    (s: NarrativeSectionType) => s.question
  );

  const logBase = { planId: plan.id, versionedTemplateId: plan.versionedTemplate.id };
  // Loop through all the questions sent in, validate and parse them and find their
  // matching question within the actual template
  const warnings: string[] = [];
  for (const questionIn of narrativeQuestions) {
    const matched: VersionedQuestion | undefined = plan.versionedTemplate.findNarrativeQuestion(questionIn);

    if (matched) {
      questions.push({
        question: matched,
        answer: fromMaDMPNarrative(request, plan, questionIn)
      });
      request.log.debug(
        { ...logBase, versionedQuestionId: matched.id },
        'processNarrative - Found matching question'
      );
    } else {
      request.log.debug(
        { planId: plan.id, versionedTemplateId: plan.versionedTemplate.id, question: questionIn },
        'processNarrative - No matching question found'
      );
      warnings.push(`Unable to find question for narrative question "${questionIn.text}"`);
    }
  }

  if (warnings.length > 0) {
    plan.warnings['answers'] = warnings.join('; ');
  }

  return questions;
}

/**
 * Workflow to transform the `narrative` portion of the maDMP into Answers on a Plan
 *
 * @param request the Fastify request
 * @param plan the Plan to update with the narrative content
 * @param dmp the maDMP
 * @returns the updated Plan with answers
 * @throws Fastify errors if something went wrong
 */
export const createNarrativeWorkflow = async (
  request: FastifyRequest,
  plan: Plan,
  dmp: DMPToolDMPType['dmp']
): Promise<Plan> => {
  // This should never occur because we have a default, but if the VersionedTemplate
  // is not defined we should bail out immediately
  if (!plan.versionedTemplate) return plan;

  const narrative: NarrativeTemplateType | undefined = dmp.narrative;
  const datasets: DatasetType[] = dmp.dataset || [];
  let processedNarrative: ProcessNarrativeResponse[] = [];

  // First process the narrative portion of the maDMP
  if (request.headers['accept'] === DMP_TOOL_CONTENT_TYPE && narrative && narrative.template) {
    processedNarrative = processNarrative(request, plan, narrative.template);
    request.log.debug(
      {planId: plan.id, narrative: processedNarrative},
      'createNarrativeWorkflow - Narrative extracted from the narrative portion of the maDMP record.'
    )
  }

  // Locate the research output table question
  const researchOutputQuestion: VersionedQuestion | undefined = plan.versionedTemplate.researchOutputTableQuestion();

  // If the research output table question exists and there are datasets defined in the maDMP record
  if (!!researchOutputQuestion && datasets.length > 0) {
    // Find the research output table answer derived from the narrative
    const roEntry: ProcessNarrativeResponse | undefined = processedNarrative.find((entry: ProcessNarrativeResponse): boolean => {
      return entry.question?.id === researchOutputQuestion?.id;
    });

    // Convert the dataset into a row in the research output table format
    const roAnswer: ResearchOutputTableAnswerType = roEntry?.answer?.validatedJSON as ResearchOutputTableAnswerType || DefaultResearchOutputTableAnswer;
    const researchOutputAnswer: ResearchOutputTableAnswerType | undefined = fromMaDMPDatasets(
      request,
      plan,
      researchOutputQuestion,
      roAnswer,
      datasets
    );

    if (researchOutputAnswer && researchOutputAnswer.answer) {
      const newRoAnswer = new Answer({
        plan,
        format: QuestionFormatsEnum.enum.researchOutputTable,
        versionedSectionId: researchOutputQuestion.versionedSectionId,
        versionedQuestionId: researchOutputQuestion.id,
        json: researchOutputAnswer
      });
      const newEntry: ProcessNarrativeResponse = { question: researchOutputQuestion, answer: newRoAnswer };
      if (roEntry) {
        // Replace the original research output answer with the new one
        processedNarrative.splice(
          processedNarrative.indexOf(roEntry),
          1,
          newEntry
        );
      } else {
        // Otherwise just add the research output to the end
        processedNarrative.push(newEntry);
      }
    }
  }

  request.log.debug(
    { planId: plan.id, narrative: processedNarrative },
    'createNarrativeWorkflow - Saving narrative information to the plan answers.'
  );

  // Persist the plan answers to the DB
  const saveErrs: string[] = [];
  for (const entry of processedNarrative) {
    if (!entry) continue;

    const saved: boolean | undefined = await entry.answer?.save(request);
    if (!saved) {
      saveErrs.push(`Unable to save answer for question ${entry.question?.id}`);
    }
  }

  // If any errors occurred add them to the plan
  if (saveErrs.length > 0) {
    plan.errors['narrative'] = saveErrs.join('; ');
  }
  return plan;
}
