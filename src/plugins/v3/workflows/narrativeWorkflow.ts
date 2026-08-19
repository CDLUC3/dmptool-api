import {
  AnyResearchOutputTableColumnAnswerType,
  CURRENT_SCHEMA_VERSION,
  DefaultResearchOutputTableColumnAnswerMap,
  DefaultResearchOutputTableQuestion,
  DMPToolDMPType,
  MetadataStandardSearchAnswerType,
  QuestionFormatsEnum,
  RepositorySearchAnswerType,
  ResearchOutputTableAnswerType,
  ResearchOutputTableQuestionType,
  ResearchOutputTableRowAnswerType,
  TextAnswerType,
} from "@dmptool/types";
import { Plan } from "../../../models/Plan.js";
import {
  DatasetsType,
  DatasetType,
  DistributionType, HostType, IdentifierType,
  LicenseType,
  NarrativeQuestionType,
  NarrativeSectionType,
  NarrativeTemplateType
} from "../../../types.js";
import {
  VersionedQuestion,
  VersionedTemplate
} from "../../../models/VersionedTemplate.js";
import { Answer } from "../../../models/Answer.js";

interface ProcessNarrativeResponse {
  question?: VersionedQuestion;
  answer?: Answer;
}

/**
 * Convert an entry from the maDMP narrative section into an answer
 *
 * @param plan the Plan
 * @param question the maDMP narrative question
 * @returns the Answer to the Versioned Question
 */
const fromMaDMPNarrative = (
  plan: Plan,
  question: NarrativeQuestionType
): Answer | undefined => {
  // The Plan must have a versioned template
  if (!plan.versionedTemplate) {
    return undefined;
  }

  // Find the question within the Plan's versioned template
  const versionedQuestion: VersionedQuestion | undefined = plan.versionedTemplate.findNarrativeQuestion(question);
  if (!versionedQuestion) {
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
 * @param plan the Plan
 * @param question the Versioned Question
 * @param existingAnswer the current ResearchOutputTableAnswer derived from the maDMP narrative
 * @param datasets the maDMP dataset array
 * @returns the updated research output table answer
 */
const fromMaDMPDatasets = (
  plan: Plan,
  question: VersionedQuestion,
  existingAnswer: ResearchOutputTableAnswerType,
  datasets: DatasetsType,
): ResearchOutputTableAnswerType | undefined => {
  const newAnswer: ResearchOutputTableAnswerType = structuredClone(existingAnswer);
  const roQuestion = JSON.parse(question.json) as ResearchOutputTableQuestionType;

  // The Plan must have a versioned template
  if (!plan.versionedTemplate) {
    return undefined;
  }

  // Find the question within the Plan's versioned template
  const versionedQuestion: VersionedQuestion | undefined = plan.versionedTemplate.findQuestionById(question.id);
  if (!versionedQuestion) {
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
    const workingRow: ResearchOutputTableRowAnswerType = existingRow
      || initializeResearchOutputTableAnswerRow(roQuestion as ResearchOutputTableQuestionType);

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
  }

  return newAnswer;
}

/**
 * Constructs an empty row for a Research Output Table that conforms to the
 * structure of the Research Output Question
 *
 * @param question the Research Output Table Question
 * @returns a new Answer row for the Research Output Table
 */
const constructNewResearchOutputTableAnswer = (
  question: ResearchOutputTableQuestionType
): ResearchOutputTableAnswerType => {
  const columnHeadings: string[] = question.columns.map((col) => {
    return col.heading;
  });

  return {
    type: "researchOutputTable",
    columnHeadings: columnHeadings.filter((col): col is 'string' => !!col),
    answer: [],
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
  };
}

/**
 * Generate a new empty row for a research output table answer
 *
 * @param question the maDMP Research Output question
 * @returns a new Resource Output table answer row
 */
const initializeResearchOutputTableAnswerRow = (
  question: ResearchOutputTableQuestionType,
): ResearchOutputTableRowAnswerType => {
  const cols: AnyResearchOutputTableColumnAnswerType[] = [];

  for (const col of question.columns) {
    cols.push(DefaultResearchOutputTableColumnAnswerMap[col.commonStandardId]);
  }

  return { columns: cols };
}

/**
 * Convert the specified column (referenced by commonStandardId) in the maDMP
 * dataset entry into a ResearchOutputTableColumnAnswerType
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
      const repositories: RepositorySearchAnswerType['answer'] = [];
      if (Array.isArray(dataset.distribution)) {
        const hosts: HostType[] = dataset.distribution?.flatMap((dist: DistributionType) => dist.host || []);

        for (const host of hosts) {
          const ids: IdentifierType[] = Array.isArray(host.host_id)
            ? host.host_id?.filter((id: IdentifierType): boolean => !!id.identifier)
            : [];

          if (ids.length > 0) {
            for (const id of ids) {
              repositories.push({
                repositoryName: host.title || '',
                repositoryId: id.identifier
              });
            }
          }
        }
      }
      column.answer = repositories;

      return column as AnyResearchOutputTableColumnAnswerType;
    }

    if (commonStandardId === 'metadata') {
      const metadataStandards: MetadataStandardSearchAnswerType['answer'] = [];
      if (Array.isArray(dataset.metadata)) {
        for (const standard of dataset.metadata) {
          const ids: IdentifierType[] = Array.isArray(standard.metadata_standard_id)
            ? standard.metadata_standard_id?.filter((id: IdentifierType): boolean => !!id.identifier)
            : [];
          if (ids.length > 0) {
            for (const id of ids) {
              metadataStandards.push({
                metadataStandardName: standard.description?.slice(0, 50) || '',
                metadataStandardId: id.identifier
              });
            }
          }
        }
      }
      column.answer = metadataStandards;
      return column as AnyResearchOutputTableColumnAnswerType;
    }

    if (commonStandardId === 'license_ref') {
      if (Array.isArray(dataset.distribution)) {
        const licenses: LicenseType[] = dataset.distribution?.flatMap((dist: DistributionType) => dist.license || []);
        const today = new Date();
        // Filter out any empty ones sorted ascending
        const allLicenses = licenses?.filter((lic: LicenseType): boolean => !!lic.license_ref)
          ?.sort((licA: LicenseType, licB: LicenseType) => licB.start_date - licA.start_date) || [];

        // Determine which licenses started in the past (or today) and sort them descending
        const nonFutureLicenses: LicenseType[] = allLicenses.filter((lic: LicenseType): boolean => {
          return !!lic.license_ref && new Date(lic.start_date).getTime() <= today.getTime();
        })?.sort((licA: LicenseType, licB: LicenseType) => licB.start_date - licA.start_date) || [];

        // The DMP Tool only allows one License, so use the one whose start date is closest to today
        column.answer = nonFutureLicenses[0]
          ? [{licenseId: nonFutureLicenses[0].license_ref, licenseName: ''}]
          : allLicenses[0] ? [{
            licenseId: allLicenses[0].license_ref,
            licenseName: ''
          }] : [];
      }
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
        column.answer = distribution?.issued;
        break;
      case 'byte_size':
        column.answer = {
          value: Number.isInteger(distribution?.byte_size) ? distribution?.byte_size : undefined,
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
  plan: Plan,
  narrative: NarrativeTemplateType,
): ProcessNarrativeResponse[] => {
  if (!plan || !plan.versionedTemplate) return [];

  // Gather all questions from both the narrative and the Versioned Template
  const questions: ProcessNarrativeResponse[] = [];
  const narrativeQuestions: NarrativeQuestionType[] = narrative.section
    ? narrative.section.flatMap((s: NarrativeSectionType) => s.question)
    : [];

  // Loop through all the questions sent in, validate and parse them and find their
  // matching question within the actual template
  const warnings: string[] = [];
  for (const questionIn of narrativeQuestions) {
    const matched: VersionedQuestion | undefined = plan.versionedTemplate.findNarrativeQuestion(questionIn);

    if (matched) {
      questions.push({
        question: matched,
        answer: fromMaDMPNarrative(plan, questionIn)
      });
    } else {
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
 * @param plan the Plan to update with the narrative content
 * @param dmp the maDMP
 * @returns the updated Plan with answers
 */
export const createNarrativeWorkflow = (
  plan: Plan,
  dmp: DMPToolDMPType['dmp']
): Answer[] => {
  // This should never occur because we have a default, but if the VersionedTemplate
  // is not defined we should bail out immediately
  if (!plan.versionedTemplate) return [];

  const versionedTemplate = new VersionedTemplate(plan.versionedTemplate);
  const narrative: NarrativeTemplateType | undefined = dmp.narrative;
  const datasets: DatasetType[] = dmp.dataset || [];
  const processedNarrative: ProcessNarrativeResponse[] = narrative?.template
    ? processNarrative(plan, narrative.template)
    : [];

  // Locate the research output table question
  const researchOutputQuestion: VersionedQuestion | undefined = versionedTemplate.researchOutputTableQuestion();

  // If the research output table question exists and there are datasets defined in the maDMP record
  if (!!researchOutputQuestion && datasets.length > 0) {
    // Find the research output table answer derived from the narrative
    const roEntry: ProcessNarrativeResponse | undefined = processedNarrative.find((entry: ProcessNarrativeResponse): boolean => {
      return entry.question?.id === researchOutputQuestion?.id;
    });

    // Convert the dataset into a row in the research output table format
    const newAnswer: ResearchOutputTableAnswerType = researchOutputQuestion
      ? constructNewResearchOutputTableAnswer(researchOutputQuestion.validatedJSON as ResearchOutputTableQuestionType)
      : constructNewResearchOutputTableAnswer(DefaultResearchOutputTableQuestion);
    const roAnswer: ResearchOutputTableAnswerType = roEntry?.answer?.validatedJSON as ResearchOutputTableAnswerType || newAnswer;

    const researchOutputAnswer: ResearchOutputTableAnswerType | undefined = fromMaDMPDatasets(
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

  // Persist the plan answers to the DB
  return processedNarrative
    ? processedNarrative.map((entry: ProcessNarrativeResponse): Answer | undefined => entry.answer)
      .filter((answer: Answer | undefined): answer is Answer => !!answer)
    : [];
}
