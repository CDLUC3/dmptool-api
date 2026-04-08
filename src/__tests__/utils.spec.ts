import {isDmpId} from '../utils.js';
import {ConfigurationOptionsType} from '../configuration.js';

describe('isDmpId', () => {
  const mockOptions: ConfigurationOptionsType = {
    dmpIdBaseUrl: 'https://doi.org',
    dmpIdShoulder: '10.12345',
    domainName: 'example.com',
  } as ConfigurationOptionsType;

  describe('should return true for valid DMP IDs', () => {
    it('should match when ID starts with encoded base URL and shoulder', () => {
      const id = encodeURIComponent('doi.org/10.12345') + '/abc123';
      expect(isDmpId(mockOptions, id)).toBe(true);
    });

    it('should match when ID starts with encoded domain name and projects path', () => {
      const id = encodeURIComponent('example.com/projects') + '/abc123';
      expect(isDmpId(mockOptions, id)).toBe(true);
    });

    it('should match when ID starts with encoded DOI prefix and shoulder', () => {
      const id = encodeURIComponent('doi:10.12345') + '/abc123';
      expect(isDmpId(mockOptions, id)).toBe(true);
    });

    it('should match when ID starts with encoded shoulder', () => {
      const id = encodeURIComponent('10.12345') + '/abc123';
      expect(isDmpId(mockOptions, id)).toBe(true);
    });

    it('should match exact encoded prefix without additional path', () => {
      const id = encodeURIComponent('doi:10.12345');
      expect(isDmpId(mockOptions, id)).toBe(true);
    });

    it('should handle http protocol in base URL', () => {
      const httpOptions = {
        ...mockOptions,
        dmpIdBaseUrl: 'http://doi.org',
      };
      const id = encodeURIComponent('doi.org/10.12345') + '/test';
      expect(isDmpId(httpOptions, id)).toBe(true);
    });
  });

  describe('should return false for invalid DMP IDs', () => {
    it('should not match when ID does not start with any valid prefix', () => {
      const id = 'invalid-id-12345';
      expect(isDmpId(mockOptions, id)).toBe(false);
    });

    it('should not match when ID is empty string', () => {
      const id = '';
      expect(isDmpId(mockOptions, id)).toBe(false);
    });

    it('should not match when prefix is in the middle of ID', () => {
      const id = 'prefix-' + encodeURIComponent('doi:10.12345');
      expect(isDmpId(mockOptions, id)).toBe(false);
    });

    it('should not match when using different shoulder', () => {
      const id = encodeURIComponent('doi:10.99999') + '/abc123';
      expect(isDmpId(mockOptions, id)).toBe(false);
    });

    it('should not match when using different domain', () => {
      const id = encodeURIComponent('different.com/projects') + '/abc123';
      expect(isDmpId(mockOptions, id)).toBe(false);
    });
  });

  describe('should handle special characters in configuration', () => {
    it('should handle shoulder with special characters', () => {
      const specialOptions = {
        ...mockOptions,
        dmpIdShoulder: '10.12345/special-char',
      };
      const id = encodeURIComponent('doi:10.12345/special-char') + '/test';
      expect(isDmpId(specialOptions, id)).toBe(true);
    });

    it('should handle domain with special characters', () => {
      const specialOptions = {
        ...mockOptions,
        domainName: 'sub-domain.example.com',
      };
      const id = encodeURIComponent('sub-domain.example.com/projects') + '/test';
      expect(isDmpId(specialOptions, id)).toBe(true);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle base URL without protocol', () => {
      const noProtocolOptions = {
        ...mockOptions,
        dmpIdBaseUrl: 'doi.org',
      };
      const id = encodeURIComponent('doi.org/10.12345') + '/test';
      expect(isDmpId(noProtocolOptions, id)).toBe(true);
    });

    it('should be case-sensitive for ID matching', () => {
      const id = encodeURIComponent('DOI:10.12345') + '/test';
      expect(isDmpId(mockOptions, id)).toBe(false);
    });
  });
});
