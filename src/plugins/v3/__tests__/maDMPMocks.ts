import { jest } from '@jest/globals';
import { DMPToolDMPType } from "@dmptool/types";
import { AccessiblePlan } from "../../../types.js";

export const mockUserPermissionResponse = true;
export const mockCallerPermissionResponse = true;

export const mockPlan: AccessiblePlan = {
  id: 123,
  dmpId: 'test-dmp-id',
  accessLevel: 'public',
};
export const mockPlans: AccessiblePlan[] = [mockPlan];

export const mockMaDMP: DMPToolDMPType = {
  dmp: {
    // These are RDA Common Standard fields and should always be returned
    title: 'Test DMP',
    dmp_id: {
      identifier: 'test-dmp-id',
      type: 'other'
    },
    created: '2021-01-01 03:11:23Z',
    modified: '2021-01-01 02:23:11Z',
    ethical_issues_exist: 'unknown',
    language: 'eng',
    contact: {
      name: 'Test Contact',
      mbox: 'tester@example.com',
      contact_id: [{
        identifier: '123456789',
        type: 'other'
      }]
    },
    narrative: {
      template: {
        id: 1,
      },
    },
    dataset: [{
      title: 'Test Dataset',
      dataset_id: {
        identifier: '123',
        type: 'other'
      },
      personal_data: 'unknown',
      sensitive_data: 'no',
    }],

    // If the Accept header is `application/vnd.org.rd-alliance.dmp-common.v1.2+json` then
    // these fields should not be returned, if it is `application/vnd.org.dmptool.v1.2+json`
    // then these fields should be returned
    rda_schema_version: "1.2",
    provenance: 'dmptool',
    status: 'draft',
    privacy: 'public',
    featured: 'no',
  }
};

export function mockMaDMPModule() {
  jest.unstable_mockModule('../../../models/maDMP.js', () => ({
    userHasPermission: jest.fn().mockImplementation((): Promise<boolean> => {
      return Promise.resolve(mockUserPermissionResponse);
    }),
    callerHasPermission: jest.fn().mockImplementation((): Promise<boolean> => {
      return Promise.resolve(mockCallerPermissionResponse);
    }),
    loadPlansForUser: jest.fn().mockImplementation((): Promise<AccessiblePlan[]> => {
      return Promise.resolve(mockPlans);
    }),
    loadPlansForCaller: jest.fn().mockImplementation((): Promise<AccessiblePlan[]> => {
      return Promise.resolve(mockPlans);
    }),
    loadPlan: jest.fn().mockImplementation((): Promise<AccessiblePlan> => {
      return Promise.resolve(mockPlan);
    }),
    loadMaDMPFromDynamo: jest.fn().mockImplementation((): Promise<DMPToolDMPType> => {
      return Promise.resolve(mockMaDMP);
    }),
    persistMaDMPRecord: jest.fn().mockImplementation((): Promise<DMPToolDMPType> => {
      return Promise.resolve(mockMaDMP);
    }),
    handleMissingMaDMP: jest.fn().mockImplementation((): Promise<DMPToolDMPType> => {
      return Promise.resolve(mockMaDMP);
    }),
  }));
}
