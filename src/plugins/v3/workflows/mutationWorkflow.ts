import { FastifyRequest } from 'fastify';
import { DMPToolDMPType } from '@dmptool/types';
import { convertMySQLDateTimeToRFC3339 } from '@dmptool/utils';
import { isDmpId } from '../../../utils.js';

export interface WorkflowFailure {
  ok: false;
  statusCode: 400 | 409 | 500;
  errorCode: string;
  message: string;
  logLevel?: 'warn' | 'error' | 'fatal' | 'debug';
}

export type UpdateDmpResult =
  | {
      ok: true;
      statusCode: 200;
      body: DMPToolDMPType;
      lastModified: string;
    }
  | WorkflowFailure;

export type DeleteDmpResult =
  | {
      ok: true;
      statusCode: 204;
    }
  | WorkflowFailure;

/**
 * Shared guard for validating DMP ids on mutating workflows.
 */
const validateEncodedDmpId = (
  request: FastifyRequest,
  encodedDmpId: string
): WorkflowFailure | undefined => {
  if (!encodedDmpId || !isDmpId(request.dmptoolConfig, encodedDmpId)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'dmp_invalid',
      message: 'Invalid DMP ID',
      logLevel: 'warn'
    };
  }

  return undefined;
};

/**
 * Shared precondition check for optimistic locking via If-Unmodified-Since.
 */
const validateModifiedDateMatch = (
  ifUnmodifiedSince: string,
  currentModifiedDate: string
): WorkflowFailure | undefined => {
  const requestDate = convertMySQLDateTimeToRFC3339(ifUnmodifiedSince) as string;
  const currentDate = convertMySQLDateTimeToRFC3339(currentModifiedDate) as string;

  if (requestDate !== currentDate) {
    return {
      ok: false,
      statusCode: 409,
      errorCode: 'conflict',
      message: 'The DMP has been modified since the time specified in the If-Unmodified-Since header',
      logLevel: 'warn'
    };
  }

  return undefined;
};

/**
 * Workflow for update route preconditions and response shaping.
 * Note: the actual update persistence is still TODO in the route layer.
 */
export const updateDmpWorkflow = async (
  request: FastifyRequest,
  encodedDmpId: string,
  ifUnmodifiedSince: string,
  currentDmp: DMPToolDMPType
): Promise<UpdateDmpResult> => {
  const idError = validateEncodedDmpId(request, encodedDmpId);
  if (idError) return idError;

  const modifiedError = validateModifiedDateMatch(ifUnmodifiedSince, currentDmp.dmp.modified);
  if (modifiedError) return modifiedError;

  return {
    ok: true,
    statusCode: 200,
    body: currentDmp,
    lastModified: currentDmp.dmp.modified,
  };
};

/**
 * Workflow for delete route preconditions.
 * Note: the actual deletion persistence is still TODO in the route layer.
 */
export const deleteDmpWorkflow = async (
  request: FastifyRequest,
  encodedDmpId: string,
  ifUnmodifiedSince: string,
  currentDmpModifiedDate: string
): Promise<DeleteDmpResult> => {
  const idError = validateEncodedDmpId(request, encodedDmpId);
  if (idError) return idError;

  const modifiedError = validateModifiedDateMatch(ifUnmodifiedSince, currentDmpModifiedDate);
  if (modifiedError) return modifiedError;

  return {
    ok: true,
    statusCode: 204,
  };
};


