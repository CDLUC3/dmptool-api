import {Logger} from 'pino';
import {DMPToolDMPType} from "@dmptool/types";
import {initializeLogger, LogLevelEnum, queryTable} from '@dmptool/utils';
import {ConfigurationOptionsType} from "../configuration.js";

interface MySQLConfig {
  logger: Logger;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const logLevelMap: Record<string, LogLevelEnum> = {
  fatal: LogLevelEnum.FATAL,
  error: LogLevelEnum.ERROR,
  warn: LogLevelEnum.WARN,
  info: LogLevelEnum.INFO,
  error: LogLevelEnum.ERROR,
  debug: LogLevelEnum.DEBUG,
  trace: LogLevelEnum.TRACE
};

/**
 * Configuration for the MySQL instance
 *
 * @param fastifyConfig the configuration used by Fastify
 * @returns the configuration for MySQL
 */
const mySQLConfig = (
  fastifyConfig: ConfigurationOptionsType
): MySQLConfig => {
  const logLevel: LogLevelEnum = logLevelMap[fastifyConfig.logLevel.toLowerCase()] ?? LogLevelEnum.INFO;
  const logger: Logger = initializeLogger(fastifyConfig.applicationName, logLevel);

  return {
    logger,
    host: fastifyConfig.rdsHost,
    port: fastifyConfig.rdsPort,
    user: fastifyConfig.rdsUser,
    password: fastifyConfig.rdsPassword,
    database: fastifyConfig.rdsDatabase,
  }
}

const queryMySQL = async (
  fastifyConfig: ConfigurationOptionsType,
  dmpId: string
): Promise<DMPToolDMPType | undefined> => {
  const config: MySQLConfig = mySQLConfig(fastifyConfig);

  const sql = 'SELECT * FROM some_table WHERE id = ?';
  const resp = await queryTable(config, sql, [dmpId])

  if (resp && Array.isArray(resp.results) && resp.results.length > 0) {
    console.log('It worked!', resp.results[0]);
  } else {
    console.log('No results found');
  }

  return undefined;
}
