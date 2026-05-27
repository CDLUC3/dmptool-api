import {ApiError, ConfigurationOptions} from "./types.js";

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
  const prefixes = [
    `${options.dmpIdBaseUrl.replace(/https?:\/\//, '')}/${options.dmpIdShoulder}`,
    `${options.domainName}/projects`,
    `doi:${options.dmpIdShoulder}`,
    // The Apollo server will use this if it cannot generate a unique DMP id with
    // our DOI shoulder (shouldn't ever happen, but it could)
    'TEMP-API',
    options.dmpIdShoulder
  ].map((prefix: string): string => encodeURIComponent(prefix));

  return prefixes.some((prefix: string): boolean => id.startsWith(prefix));
};

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

