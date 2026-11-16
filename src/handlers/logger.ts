import { Logger } from "pino";
import { FastifyRequest } from "fastify";
import { randomHex } from "@dmptool/utils";
import { User } from "../types.js";

export const decorateLog = (request: FastifyRequest): void => {
  const requestId: string = randomHex(16);

  request.log = request.log.child({
    app: request.dmptoolConfig.applicationName?.toLowerCase()?.replace(' ', '-'),
    env: request.dmptoolConfig.deploymentEnv,
    // Generate a random request ID to help us follow a request through the logs
    requestId,
    caller: request.caller,
    user: request.user as User,
    url: request.url,
  });

  // Update the nested loggers that will be passed through to the @dmptool/utils
  if (request.dmptoolConfig.dynamo) request.dmptoolConfig.dynamo.logger = request.log as Logger;
  if (request.dmptoolConfig.rds) request.dmptoolConfig.rds.logger = request.log as Logger;
  if (request.dmptoolConfig.ssm) request.dmptoolConfig.ssm.logger = request.log as Logger;
}
