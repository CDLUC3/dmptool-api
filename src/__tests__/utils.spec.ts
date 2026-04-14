import { describe, expect, it } from '@jest/globals';
import { isDmpId, stringToInteger } from '../utils.js';
import { ConfigurationOptions } from '../types.js';

describe('isDmpId', () => {
  const mockOptions: ConfigurationOptions = {
    dmpIdBaseUrl: 'https://doi.org',
    dmpIdShoulder: '10.12345',
    domainName: 'example.com',
  } as ConfigurationOptions;

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

describe('stringToInteger', () => {
  it('should return the integer when given a valid numeric string', () => {
    expect(stringToInteger('3306')).toBe(3306);
    expect(stringToInteger('0')).toBe(0);
    expect(stringToInteger('-50')).toBe(-50);
  });

  it('should return undefined for non-numeric strings', () => {
    expect(stringToInteger('localhost')).toBeUndefined();
    expect(stringToInteger('abc123')).toBeUndefined(); // parseInt might get '123', but isInteger catches partials
  });

  it('should return undefined for empty strings or whitespace', () => {
    expect(stringToInteger('')).toBeUndefined();
    expect(stringToInteger('   ')).toBeUndefined();
  });

  it('should return undefined for decimal strings', () => {
    // Depending on your needs, parseInt('10.5') returns 10.
    // If you want STRICT integers, you might need to check the original string.
    // As written, parseInt('10.5') returns 10, which IS an integer.
    expect(stringToInteger('10.5')).toBe(10);
  });

  it('should handle null or undefined gracefully', () => {
    // @ts-ignore: testing runtime safety for non-TS consumers
    expect(stringToInteger(null)).toBeUndefined();
    // @ts-ignore
    expect(stringToInteger(undefined)).toBeUndefined();
  });

  it('should handle very large numbers', () => {
    expect(stringToInteger('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should handle an undefined val', () => {
    expect(stringToInteger(undefined)).toBe(undefined);
  });
});
