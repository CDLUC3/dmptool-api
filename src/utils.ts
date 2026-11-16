import { ConfigurationOptions } from "./types.js";

/**
 * LANGUAGES:
 *
 * The maDMP JSON schemas work with 3 character codes (ISO 639-3). For example `eng`
 * The DMP Tool works with 5 character codes (ISO 639-1 language with ISO 3166-1
 * alpha-2 country code) for example `en-US`
 *
 * The following functions and types help map between the different language code formats
 */
export const DEFAULT_LANGUAGE = 'en-US' as const;

export const LanguageMapThreeToFive = {
  'eng': 'en-US',
  'ptb': 'pt-BR'
} as const

export type LangISO3 = keyof typeof LanguageMapThreeToFive; // 'eng' | 'ptb'
export type LangISO5 = typeof LanguageMapThreeToFive[LangISO3]; // 'en-US' | 'pt-BR'

export const LanguageMapFiveToThree = Object.fromEntries(
  Object.entries(LanguageMapThreeToFive).map(([k, v]) => [v, k])
) as Record<LangISO5, LangISO3>;

export const isValidISO3 = (lang: string): lang is LangISO3 => {
  return lang in LanguageMapThreeToFive;
}

/**
 * Extracts the identifier from an object that may contain an identifier or
 * an array of identifiers.
 *
 * @param idObj the object containing the identifier(s)
 * @returns the first identifier found, or undefined if no identifier is present
 */
export const extractIdentifier = (
  idObj?: { identifier?: string } | { identifier?: string }[]
): string | undefined => {
  if (Array.isArray(idObj)) return idObj[0]?.identifier?.trim();
  return idObj?.identifier?.trim();
};

/**
 * Whether the valid is an email address
 *
 * @param email the string value
 * @returns true if the value is in a valid email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Checks whether the given identifier is a DMP ID (DOI or a URL under the configured domain).
 *
 * @param options The configuration options.
 * @param id The identifier to check.
 * @returns True if the identifier is a DMP ID, false otherwise.
 */
export const isDmpId = (
  options: ConfigurationOptions,
  id: string,
): boolean => {
  const encodedId = encodeURIComponent(id);
  const prefixes = [
    `${options.dmpIdBaseUrl.replace(/https?:\/\//, '')}/${options.dmpIdShoulder}`,
    `${options.domainName}/projects/`,
    'projects/',
    `doi:${options.dmpIdShoulder}`,
    // The Apollo server will use this if it cannot generate a unique DMP id with
    // our DOI shoulder (shouldn't ever happen, but it could)
    'TEMP-API',
    options.dmpIdShoulder
  ].map((prefix: string): string => encodeURIComponent(prefix));

  return prefixes.some((prefix: string): boolean => encodedId.startsWith(prefix));
};

/**
 * Process a DMP id that was passed in the URL path. The id can conform to any
 * of the following formats:
 * - DMP Tool URL format (e.g. /projects123/dmps/123) then it is a non-published
 *   plan so we just need the last part of the path (the plan id)
 * - DOI format (e.g. doi:10.1234/5678) then we just return it as is
 * - DMP Tool DOI URL format (e.g. https://doi.org/10.12345/5678) then we just return it as is
 *
 * @param options the configuration options
 * @param id the id that was passed in the URL path
 * @returns the processed id
 */
export const processDMPId = (
  options: ConfigurationOptions,
  id: string
): string => {
  const idWithoutProtocol: string = id.replace(/https?:\/\//, '').trim();
  const doiDomain = `${options.dmpIdBaseUrl.replace(/https?:\/\//, '')}/${options.dmpIdShoulder}`;

  if (idWithoutProtocol.startsWith(`${options.domainName}/projects/`)
   || idWithoutProtocol.startsWith('projects/')) {
    // It is a DMP Tool URL format, so we just need the last part of the path (the plan id)
    return idWithoutProtocol.split('/').reverse()[0];

  } else if (idWithoutProtocol.startsWith('doi:')) {
    // It is a DOI format, so we just return without the `doi:` prefix
    return idWithoutProtocol.replace('doi:', '');

  } else if (idWithoutProtocol.startsWith(doiDomain)) {
    // It is a DMP Tool DOI URL format, so we just return without the DOI domain prefix
    return idWithoutProtocol.replace(options.dmpIdBaseUrl, '');
  }

  return idWithoutProtocol.trim();
}

/**
 * Safely convert a string to an integer
 *
 * @param val the string
 * @returns the integer or undefined if it was not a valid integer
 */
export const stringToInteger = (
  val: string | undefined
): number | undefined => {
  if (!val) return undefined;

  const parsed: number = val ? parseInt(val, 10) : NaN;

  return Number.isInteger(parsed) ? parsed : undefined;
}
