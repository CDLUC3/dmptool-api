import { FastifyRequest } from "fastify";
import {
  DefaultResearchOutputTableAnswer,
  DMPToolDMPType,
  QuestionFormatsEnum,
  ResearchOutputTableAnswerType,
} from "@dmptool/types";
import { Plan } from "../../../models/Plan.js";
import {
  DatasetType,
  NarrativeQuestionType,
  NarrativeSectionType,
  NarrativeTemplateType
} from "../../../types.js";
import { VersionedQuestion } from "../../../models/VersionedTemplate.js";
import { Answer } from "../../../models/Answer.js";

interface ProcessNarrativeResponse {
  question?: VersionedQuestion;
  answer?: Answer;
}

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
        answer: Answer.fromMaDMPNarrative(request, plan, questionIn)
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

  // First process the narrative portion of the maDMP
  const processedNarrative: ProcessNarrativeResponse[] = processNarrative(request, plan, narrative.template);
  request.log.debug(
    { planId: plan.id, narrative: processedNarrative },
    'createNarrativeWorkflow - Narrative extracted from the narrative portion of the maDMP record.'
  )

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
    const researchOutputAnswer: ResearchOutputTableAnswerType | undefined = Answer.fromMaDMPDatasets(
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
          0,
          newEntry
        );
      } else {
        // Otherwise just
        processedNarrative.push(newEntry);
      }
    }
  }

  request.log.debug(
    { planId: plan.id, narrative: processedNarrative },
    'createNarrativeWorkflow - Saving narrative information to the plan answers.'
  );

  // Persist the plan answers to the DB
  for (const entry of processedNarrative) {
    if (!entry) continue;

    const saved: boolean | undefined = await entry.answer?.save(request);
    if (!saved) {
      plan.errors['narrative'] = `Unable to save answer for question ${entry.question?.id}`;
    }
  }
  return plan;
}
