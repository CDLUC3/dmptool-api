import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ProjectMember, ProjectMemberQueryResponse } from '../ProjectMember.js';
import { DMPToolDMPType } from '@dmptool/types';
import {ContributorType} from "../../types.js";

describe('ProjectMember', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default values', () => {
      const member = new ProjectMember({
        givenName: 'John',
        surName: 'Doe',
        email: 'john@example.com',
      });

      expect(member.givenName).toBe('John');
      expect(member.surName).toBe('Doe');
      expect(member.email).toBe('john@example.com');
    });

    it('should set isPrimaryContact to false by default', () => {
      const member = new ProjectMember({
        email: 'john@example.com',
      });

      expect(member.isPrimaryContact).toBe(false);
    });

    it('should set memberRoleURIs to empty array by default', () => {
      const member = new ProjectMember({
        email: 'john@example.com',
      });

      expect(member.memberRoleURIs).toEqual([]);
    });

    it('should properly set all properties from options', () => {
      const member = new ProjectMember({
        id: 1,
        projectId: 42,
        affiliationId: 'https://ror.org/12345',
        givenName: 'John',
        surName: 'Doe',
        orcid: '0000-0000-0000-0001',
        email: 'john@example.com',
        isPrimaryContact: true,
        memberRoleURIs: ['http://example.com/role1', 'http://example.com/role2'],
      });

      expect(member.id).toBe(1);
      expect(member.projectId).toBe(42);
      expect(member.affiliationId).toBe('https://ror.org/12345');
      expect(member.givenName).toBe('John');
      expect(member.surName).toBe('Doe');
      expect(member.orcid).toBe('0000-0000-0000-0001');
      expect(member.email).toBe('john@example.com');
      expect(member.isPrimaryContact).toBe(true);
      expect(member.memberRoleURIs).toEqual(['http://example.com/role1', 'http://example.com/role2']);
    });

    it('should set graphQLErrorsThatShouldBeWarnings with correct keys', () => {
      const member = new ProjectMember({
        email: 'john@example.com',
      });

      expect(member.graphQLErrorsThatShouldBeWarnings).toContain('affiliationId');
      expect(member.graphQLErrorsThatShouldBeWarnings).toContain('memberRoleIds');
    });
  });

  describe('names() method', () => {
    it('should return array with combined "givenName surName" and reversed versions', () => {
      const member = new ProjectMember({
        givenName: 'John',
        surName: 'Doe',
      });

      const names = member.names();

      expect(names).toHaveLength(2);
      expect(names).toContain('john doe');
      expect(names).toContain('doe john');
    });

    it('should handle missing givenName', () => {
      const member = new ProjectMember({
        surName: 'Doe',
      });

      const names = member.names();

      expect(names).toHaveLength(2);
      expect(names[0]).toBe('doe');
      expect(names[1]).toBe('doe');
    });

    it('should handle missing surName', () => {
      const member = new ProjectMember({
        givenName: 'John',
      });

      const names = member.names();

      expect(names).toHaveLength(2);
      expect(names[0]).toBe('john');
      expect(names[1]).toBe('john');
    });

    it('should handle both names present', () => {
      const member = new ProjectMember({
        givenName: 'Jane',
        surName: 'Smith',
      });

      const names = member.names();

      expect(names).toHaveLength(2);
      expect(names).toContain('jane smith');
      expect(names).toContain('smith jane');
    });

    it('should return lowercase trimmed versions', () => {
      const member = new ProjectMember({
        givenName: '  JOHN  ',
        surName: '  DOE  ',
      });

      const names = member.names();

      expect(names).toContain('john doe');
      expect(names).toContain('doe john');
      expect(names.every(n => n === n.toLowerCase())).toBe(true);
    });

    it('should handle both names missing', () => {
      const member = new ProjectMember({});

      const names = member.names();

      expect(names).toHaveLength(2);
      expect(names).toEqual(['', '']);
    });
  });

  describe('fromGraphQL static method', () => {
    it('should convert GraphQL response to ProjectMember', () => {
      const graphQLResponse: ProjectMemberQueryResponse = {
        id: 1,
        isPrimaryContact: true,
        affiliation: {
          uri: 'https://ror.org/12345',
        },
        givenName: 'John',
        surName: 'Doe',
        orcid: '0000-0000-0000-0001',
        email: 'john@example.com',
        memberRoles: [
          { id: 1, uri: 'http://example.com/role1' },
          { id: 2, uri: 'http://example.com/role2' },
        ],
      };

      const member = ProjectMember.fromGraphQL(graphQLResponse);

      expect(member.id).toBe(1);
      expect(member.isPrimaryContact).toBe(true);
      expect(member.affiliationId).toBe('https://ror.org/12345');
      expect(member.givenName).toBe('John');
      expect(member.surName).toBe('Doe');
      expect(member.orcid).toBe('0000-0000-0000-0001');
      expect(member.email).toBe('john@example.com');
      expect(member.memberRoleURIs).toEqual(['http://example.com/role1', 'http://example.com/role2']);
    });

    it('should handle memberRoles array and extract URIs', () => {
      const graphQLResponse: ProjectMemberQueryResponse = {
        email: 'john@example.com',
        memberRoles: [
          { uri: 'http://example.com/role1' },
          { uri: 'http://example.com/role2' },
          { uri: 'http://example.com/role3' },
        ],
      };

      const member = ProjectMember.fromGraphQL(graphQLResponse);

      expect(member.memberRoleURIs).toEqual([
        'http://example.com/role1',
        'http://example.com/role2',
        'http://example.com/role3',
      ]);
    });

    it('should filter out undefined URIs', () => {
      const graphQLResponse: ProjectMemberQueryResponse = {
        email: 'john@example.com',
        memberRoles: [
          { uri: 'http://example.com/role1' },
          { id: 2 },
          { uri: 'http://example.com/role3' },
        ],
      };

      const member = ProjectMember.fromGraphQL(graphQLResponse);

      expect(member.memberRoleURIs).toEqual([
        'http://example.com/role1',
        'http://example.com/role3',
      ]);
    });

    it('should handle missing memberRoles gracefully', () => {
      const graphQLResponse: ProjectMemberQueryResponse = {
        id: 1,
        email: 'john@example.com',
      };

      const member = ProjectMember.fromGraphQL(graphQLResponse);

      expect(member.memberRoleURIs).toEqual([]);
    });

    it('should handle empty memberRoles array', () => {
      const graphQLResponse: ProjectMemberQueryResponse = {
        email: 'john@example.com',
        memberRoles: [],
      };

      const member = ProjectMember.fromGraphQL(graphQLResponse);

      expect(member.memberRoleURIs).toEqual([]);
    });

    it('should handle missing affiliation', () => {
      const graphQLResponse: ProjectMemberQueryResponse = {
        email: 'john@example.com',
      };

      const member = ProjectMember.fromGraphQL(graphQLResponse);

      expect(member.affiliationId).toBeUndefined();
    });
  });

  describe('toGraphQLInput method', () => {
    it('should convert ProjectMember to GraphQL input format', () => {
      const member = new ProjectMember({
        id: 1,
        affiliationId: 'https://ror.org/12345',
        givenName: 'John',
        surName: 'Doe',
        orcid: '0000-0000-0000-0001',
        email: 'john@example.com',
        isPrimaryContact: true,
        memberRoleURIs: ['http://example.com/role1', 'http://example.com/role2'],
      });

      const input = member.toGraphQLInput();

      expect(input.projectMemberId).toBe(1);
      expect(input.affiliation).toBe('https://ror.org/12345');
      expect(input.givenName).toBe('John');
      expect(input.surname).toBe('Doe');
      expect(input.orcid).toBe('0000-0000-0000-0001');
      expect(input.email).toBe('john@example.com');
      expect(input.isPrimaryContact).toBe(true);
      expect(input.memberRoles).toEqual(['http://example.com/role1', 'http://example.com/role2']);
    });

    it('should include all fields including memberRoleURIs as memberRoles', () => {
      const member = new ProjectMember({
        memberRoleURIs: ['http://example.com/role1'],
      });

      const input = member.toGraphQLInput();

      expect(input.memberRoles).toEqual(['http://example.com/role1']);
    });

    it('should handle undefined fields', () => {
      const member = new ProjectMember({});

      const input = member.toGraphQLInput();

      expect(input.projectMemberId).toBeUndefined();
      expect(input.affiliation).toBeUndefined();
      expect(input.givenName).toBeUndefined();
      expect(input.surname).toBeUndefined();
      expect(input.orcid).toBeUndefined();
      expect(input.email).toBeUndefined();
      expect(input.memberRoles).toEqual([]);
    });
  });

  describe('maDMPMemberIsAMatch static method', () => {
    it('should return true when emails match (case-insensitive, trimmed)', () => {
      const maDMPMember = {
        email: '  JOHN@EXAMPLE.COM  ',
        mbox: 'john@example.com',
        name: () => 'John Doe',
      } as unknown as ContributorType;

      const member = new ProjectMember({
        email: 'john@example.com',
      });

      const result = ProjectMember.maDMPMemberIsAMatch(maDMPMember, member);

      expect(result).toBe(true);
    });

    it('should return true when orcid matches (case-insensitive, trimmed)', () => {
      const maDMPMember = {
        email: 'test@example.com',
        name: () => 'Jane Doe',
      } as unknown as ContributorType;

      const member = new ProjectMember({
        orcid: '0000-0000-0000-0001',
        email: 'different@example.com',
      });

      const result = ProjectMember.maDMPMemberIsAMatch(maDMPMember, member);

      expect(result).toBe(false);
    });

    it('should handle name matching limitation', () => {
      const maDMPMember = {
        email: 'jane@example.com',
        name: () => 'jane smith',
      } as unknown as ContributorType;

      const member = new ProjectMember({
        givenName: 'Jane',
        surName: 'Smith',
        email: 'different@example.com',
      });

      const result = ProjectMember.maDMPMemberIsAMatch(maDMPMember, member);

      expect(result).toBe(false);
    });

    it('should return true when no fields match but email is same', () => {
      const maDMPMember = {
        email: 'john@example.com',
        name: () => 'Other Person',
      } as unknown as ContributorType;

      const member = new ProjectMember({
        email: 'john@example.com',
        givenName: 'John',
        surName: 'Doe',
      });

      const result = ProjectMember.maDMPMemberIsAMatch(maDMPMember, member);

      expect(result).toBe(true);
    });

    it('should handle missing email gracefully', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
      } as unknown as ContributorType;

      const member = new ProjectMember({
        givenName: 'John',
        surName: 'Doe',
      });

      const result = ProjectMember.maDMPMemberIsAMatch(maDMPMember, member);

      expect(result).toBe(true);
    });
  });

  describe('maDMPMemberToProjectMember static method', () => {
    it('should parse name into givenName and surName', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
        roles: [],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.givenName).toBe('John');
      expect(member.surName).toBe('Doe');
    });

    it('should handle single-word names', () => {
      const maDMPMember = {
        name: 'John',
        mbox: 'john@example.com',
        roles: [],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.givenName).toBe('John');
      expect(member.surName).toBe('John');
    });

    it('should handle multi-word family names', () => {
      const maDMPMember = {
        name: 'John de Smith',
        mbox: 'john@example.com',
        roles: [],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.givenName).toBe('John');
      expect(member.surName).toBe('de Smith');
    });

    it('should extract ORCID from contributor_id when type is "orcid"', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
        roles: [],
        contributor_id: [{
          type: 'orcid',
          identifier: '0000-0000-0000-0001',
        }],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.orcid).toBe('0000-0000-0000-0001');
    });

    it('should extract ORCID from contact_id when type is "orcid"', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
        roles: [],
        contact_id: [{
          type: 'orcid',
          identifier: '0000-0000-0000-0002',
        }],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.orcid).toBe('0000-0000-0000-0002');
    });

    it('should use mbox as email', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
        roles: [],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.email).toBe('john@example.com');
    });

    it('should use roles as memberRoleURIs', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
        roles: ['http://example.com/role1', 'http://example.com/role2'],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.memberRoleURIs).toEqual(['http://example.com/role1', 'http://example.com/role2']);
    });

    it('should preserve existing member ID when provided', () => {
      const existing = new ProjectMember({
        id: 42,
        email: 'john@example.com',
      });

      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
        roles: [],
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember, existing);

      expect(member.id).toBe(42);
    });

    it('should handle missing roles array', () => {
      const maDMPMember = {
        name: 'John Doe',
        mbox: 'john@example.com',
      } as unknown as ContributorType;

      const member = ProjectMember.maDMPMemberToProjectMember(maDMPMember);

      expect(member.memberRoleURIs).toEqual([]);
    });
  });

  describe('reconcileFromMaDMP static method', () => {
    it('should throw error when maDMP.contact is missing', () => {
      const maDMP = {
        contact: undefined,
        contributor: [],
      } as unknown as DMPToolDMPType['dmp'];

      expect(() => {
        ProjectMember.reconcileFromMaDMP(maDMP);
      }).toThrow('No contact found on maDMP!');
    });

    it('should return array with primary contact', () => {
      const maDMP = {
        contact: {
          name: 'Jane Doe',
          mbox: 'jane@example.com',
          roles: [],
        },
        contributor: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectMember.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].isPrimaryContact).toBe(true);
      expect(result[0].email).toBe('jane@example.com');
    });

    it.only('should reconcile contributors from maDMP', () => {
      const maDMP = {
        contact: {
          name: 'Jane Doe',
          mbox: 'jane@example.com',
          contact_id: [{
            identifier: '123',
            type: 'other'
          }],
          roles: [],
        },
        contributor: [
          {
            name: 'John Smith',
            mbox: 'john@example.com',
            roles: [],
          },
          {
            name: 'Alice Johnson',
            mbox: 'alice@example.com',
            roles: [],
          },
        ],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectMember.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(3);
      expect(result.filter(m => m.isPrimaryContact)).toHaveLength(1);
    });

    it('should set isPrimaryContact=true for contact', () => {
      const maDMP = {
        contact: {
          name: 'Primary Contact',
          mbox: 'primary@example.com',
          roles: [],
        },
        contributor: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectMember.reconcileFromMaDMP(maDMP);

      expect(result[0].isPrimaryContact).toBe(true);
    });

    it('should handle empty contributors array', () => {
      const maDMP = {
        contact: {
          name: 'Primary Contact',
          mbox: 'primary@example.com',
          roles: [],
        },
        contributor: [],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectMember.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].isPrimaryContact).toBe(true);
    });

    it('should handle undefined contributors array', () => {
      const maDMP = {
        contact: {
          name: 'Primary Contact',
          mbox: 'primary@example.com',
          roles: [],
        },
        contributor: undefined,
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectMember.reconcileFromMaDMP(maDMP);

      expect(result).toHaveLength(1);
      expect(result[0].isPrimaryContact).toBe(true);
    });

    it('should return members without undefined entries', () => {
      const maDMP = {
        contact: {
          name: 'Primary Contact',
          mbox: 'primary@example.com',
          roles: [],
        },
        contributor: [
          {
            name: 'Contributor One',
            mbox: 'contributor1@example.com',
            roles: [],
          },
        ],
      } as unknown as DMPToolDMPType['dmp'];

      const result = ProjectMember.reconcileFromMaDMP(maDMP);

      result.forEach((member) => {
        expect(member).toBeDefined();
        expect(member).toBeInstanceOf(ProjectMember);
      });
    });
  });

  describe('Integration tests', () => {
    it('should round-trip through GraphQL and back', () => {
      const original = new ProjectMember({
        id: 1,
        givenName: 'John',
        surName: 'Doe',
        email: 'john@example.com',
        memberRoleURIs: ['http://example.com/role1'],
      });

      const input = original.toGraphQLInput();

      expect(input.projectMemberId).toBe(original.id);
      expect(input.givenName).toBe(original.givenName);
      expect(input.surname).toBe(original.surName);
      expect(input.email).toBe(original.email);
      expect(input.memberRoles).toEqual(original.memberRoleURIs);
    });

    it('should handle conversion with minimal data', () => {
      const member = new ProjectMember({});

      const input = member.toGraphQLInput();

      expect(input.projectMemberId).toBeUndefined();
      expect(input.givenName).toBeUndefined();
      expect(input.surname).toBeUndefined();
      expect(input.email).toBeUndefined();
      expect(input.memberRoles).toEqual([]);
    });
  });
});
