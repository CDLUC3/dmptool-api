import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectFunding, ProjectFundingQueryResponse } from '../ProjectFunding.js';
import { DMPToolDMPType } from '@dmptool/types';

describe('ProjectFunding', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should throw error when affiliationId is missing', () => {
      expect(() => {
        new ProjectFunding({});
      }).toThrow('affiliationId is required');
    });

    it('should successfully create instance with affiliationId', () => {
      const funding = new ProjectFunding({
        affiliationId: 'https://ror.org/12345',
      });

      expect(funding.affiliationId).toBe('https://ror.org/12345');
    });

    it('should properly set all optional properties', () => {
      const funding = new ProjectFunding({
        id: 1,
        projectId: 42,
        affiliationId: 'https://ror.org/12345',
        status: 'GRANTED',
        funderProjectNumber: 'FP-2024-001',
        grantId: 'GRANT-001',
        funderOpportunityNumber: 'OPP-2024-001',
      });

      expect(funding.id).toBe(1);
      expect(funding.projectId).toBe(42);
      expect(funding.affiliationId).toBe('https://ror.org/12345');
      expect(funding.status).toBe('GRANTED');
      expect(funding.funderProjectNumber).toBe('FP-2024-001');
      expect(funding.grantId).toBe('GRANT-001');
      expect(funding.funderOpportunityNumber).toBe('OPP-2024-001');
    });

    it('should initialize errors object', () => {
      const funding = new ProjectFunding({
        affiliationId: 'https://ror.org/12345',
        errors: { test: 'error message' },
      });

      expect(funding.errors).toEqual({ test: 'error message' });
    });

    it('should initialize empty errors object when not provided', () => {
      const funding = new ProjectFunding({
        affiliationId: 'https://ror.org/12345',
      });

      expect(funding.errors).toEqual({});
    });
  });

  describe('fromGraphQL static method', () => {
    it('should convert GraphQL response to ProjectFunding', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        id: 1,
        affiliation: {
          uri: 'https://ror.org/12345',
        },
        status: 'granted',
        funderProjectNumber: 'FP-2024-001',
        funderOpportunityNumber: 'OPP-2024-001',
        grantId: 'GRANT-001',
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.id).toBe(1);
      expect(funding.affiliationId).toBe('https://ror.org/12345');
      expect(funding.status).toBe('GRANTED');
      expect(funding.funderProjectNumber).toBe('FP-2024-001');
      expect(funding.funderOpportunityNumber).toBe('OPP-2024-001');
      expect(funding.grantId).toBe('GRANT-001');
    });

    it('should throw error when affiliation is missing', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        id: 1,
        status: 'granted',
      };

      expect(() => {
        ProjectFunding.fromGraphQL(graphQLResponse);
      }).toThrow('affiliationId is required');
    });

    it('should handle missing status', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        id: 1,
        affiliation: {
          uri: 'https://ror.org/12345',
        },
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.status).toBeUndefined();
    });

    it('should handle missing optional fields', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        affiliation: {
          uri: 'https://ror.org/12345',
        },
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.id).toBeUndefined();
      expect(funding.funderProjectNumber).toBeUndefined();
      expect(funding.funderOpportunityNumber).toBeUndefined();
      expect(funding.grantId).toBeUndefined();
    });
  });

  describe('toGraphQLInput method', () => {
    it('should convert ProjectFunding to GraphQL input format', () => {
      const funding = new ProjectFunding({
        id: 1,
        projectId: 42,
        affiliationId: 'https://ror.org/12345',
        status: 'GRANTED',
        funderProjectNumber: 'FP-2024-001',
        grantId: 'GRANT-001',
        funderOpportunityNumber: 'OPP-2024-001',
      });

      const input = funding.toGraphQLInput();

      expect(input.projectFundingId).toBe(1);
      expect(input.funder).toBe('https://ror.org/12345');
      expect(input.status).toBe('GRANTED');
      expect(input.funderProjectNumber).toBe('FP-2024-001');
      expect(input.funderOpportunityNumber).toBe('OPP-2024-001');
      expect(input.grantId).toBe('GRANT-001');
    });

    it('should include undefined fields in output', () => {
      const funding = new ProjectFunding({
        affiliationId: 'https://ror.org/12345',
      });

      const input = funding.toGraphQLInput();

      expect(input.projectFundingId).toBeUndefined();
      expect(input.funder).toBe('https://ror.org/12345');
      expect(input.status).toBeUndefined();
      expect(input.funderProjectNumber).toBeUndefined();
      expect(input.funderOpportunityNumber).toBeUndefined();
      expect(input.grantId).toBeUndefined();
    });
  });

  describe('maDMPFundingStatusToProjectFundingStatus conversion', () => {
    it('should convert "granted" to "GRANTED"', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        affiliation: { uri: 'https://ror.org/12345' },
        status: 'granted',
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.status).toBe('GRANTED');
    });

    it('should convert "rejected" to "DENIED"', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        affiliation: { uri: 'https://ror.org/12345' },
        status: 'rejected',
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.status).toBe('DENIED');
    });

    it('should convert unknown values to "PLANNED"', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        affiliation: { uri: 'https://ror.org/12345' },
        status: 'pending',
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.status).toBe('PLANNED');
    });

    it('should return undefined status for empty string', () => {
      const graphQLResponse: ProjectFundingQueryResponse = {
        affiliation: { uri: 'https://ror.org/12345' },
        status: '',
      };

      const funding = ProjectFunding.fromGraphQL(graphQLResponse);

      expect(funding.status).toBeUndefined();
    });
  });

  describe('reconcileFromMaDMP static method', () => {
    it('should return empty array when maDMP.project is missing', () => {
      const maDMP = {
        project: undefined,
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toEqual([]);
    });

    it('should return empty array when maDMP.project[0] is missing', () => {
      const maDMP = {
        project: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toEqual([]);
    });

    it('should return empty array when maDMP.project[0].funding is missing', () => {
      const maDMP = {
        project: [
          {
            funding: undefined,
          },
        ],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toEqual([]);
    });

    it('should properly reconcile funding entries from maDMP', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
                funding_status: 'granted',
                grant_id: {
                  identifier: 'GRANT-001',
                },
              },
            ],
          },
        ],
        funder_project: [],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].affiliationId).toBe('https://ror.org/12345');
      expect(result[0].status).toBe('GRANTED');
      expect(result[0].grantId).toBe('GRANT-001');
    });

    it('should handle funder_project and funder_opportunity maps', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
              },
            ],
          },
        ],
        funding_project: [
          {
            funder_id: {
              identifier: 'https://ror.org/12345',
            },
            project_identifier: {
              identifier: 'FP-2024-001',
            },
          },
        ],
        funding_opportunity: [
          {
            funder_id: {
              identifier: 'https://ror.org/12345',
            },
            opportunity_identifier: {
              identifier: 'OPP-2024-001',
            },
          },
        ],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].funderProjectNumber).toBe('FP-2024-001');
      expect(result[0].funderOpportunityNumber).toBe('OPP-2024-001');
    });

    it('should preserve existing funding IDs when found in currentFunding', () => {
      const existing = new ProjectFunding({
        id: 99,
        affiliationId: 'https://ror.org/12345',
      });

      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
              },
            ],
          },
        ],
        funder_project: [],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP, [existing]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(99);
      expect(result[0].affiliationId).toBe('https://ror.org/12345');
    });

    it('should throw error when funder_id.identifier is missing', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: undefined,
                },
                funding_status: 'granted',
              },
            ],
          },
        ],
        funder_project: [],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      expect(() => {
        ProjectFunding.reconcileFromMaDMP(maDMP);
      }).toThrow('affiliationId is required');
    });

    it('should create new ProjectFunding objects for new entries', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
                funding_status: 'granted',
                grant_id: {
                  identifier: 'GRANT-001',
                },
              },
              {
                funder_id: {
                  identifier: 'https://ror.org/67890',
                },
                funding_status: 'rejected',
                grant_id: {
                  identifier: 'GRANT-002',
                },
              },
            ],
          },
        ],
        funder_project: [],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(2);
      expect(result[0].affiliationId).toBe('https://ror.org/12345');
      expect(result[0].status).toBe('GRANTED');
      expect(result[1].affiliationId).toBe('https://ror.org/67890');
      expect(result[1].status).toBe('DENIED');
    });

    it('should handle whitespace trimming in identifiers', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: '  https://ror.org/12345  ',
                },
                funding_status: 'granted',
                grant_id: {
                  identifier: '  GRANT-001  ',
                },
              },
            ],
          },
        ],
        funder_project: [],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].affiliationId).toBe('https://ror.org/12345');
      expect(result[0].grantId).toBe('GRANT-001');
    });

    it('should match funder_id in project and opportunity maps with exact case', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
              },
            ],
          },
        ],
        funding_project: [
          {
            funder_id: {
              identifier: 'https://ror.org/12345',
            },
            project_identifier: {
              identifier: 'FP-2024-001',
            },
          },
        ],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].funderProjectNumber).toBe('FP-2024-001');
    });

    it('should handle undefined funder_project array', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
              },
            ],
          },
        ],
        funder_project: undefined,
        funder_opportunity: undefined,
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].funderProjectNumber).toBeUndefined();
      expect(result[0].funderOpportunityNumber).toBeUndefined();
    });

    it('should filter out undefined entries in final result', () => {
      const maDMP = {
        project: [
          {
            funding: [
              {
                funder_id: {
                  identifier: 'https://ror.org/12345',
                },
              },
            ],
          },
        ],
        funder_project: [],
        funder_opportunity: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectFunding.reconcileFromMaDMP(maDMP);

      result.forEach((funding) => {
        expect(funding).toBeDefined();
        expect(funding).toBeInstanceOf(ProjectFunding);
      });
    });
  });

  describe('Integration tests', () => {
    it('should round-trip through GraphQL and back', () => {
      const original = new ProjectFunding({
        id: 1,
        affiliationId: 'https://ror.org/12345',
        status: 'GRANTED',
        funderProjectNumber: 'FP-2024-001',
      });

      const input = original.toGraphQLInput();

      expect(input.projectFundingId).toBe(original.id);
      expect(input.funder).toBe(original.affiliationId);
      expect(input.status).toBe(original.status);
    });

    it('should handle conversion with minimal data', () => {
      const funding = new ProjectFunding({
        affiliationId: 'https://ror.org/12345',
      });

      const input = funding.toGraphQLInput();

      expect(input.funder).toBe('https://ror.org/12345');
      expect(input.projectFundingId).toBeUndefined();
      expect(input.status).toBeUndefined();
    });
  });
});
