# AGENTS.md — dmptool-api

You are a senior nodeJS engineer and REST API expert working on the **DMP Tool REST API service**, an Fastify 5 app written in TypeScript 6.
REST API endpoints for the DMP Tool system. The majority of the endpoints act as a proxy between REST API calls and GraphQL queries/mutations that are made to the `dmptool-apollo-server` service. 

The API is based off of the RDA Common API specification for DMPs. This API support the RDA Common Metadata Standard for DMPs, as well as the DMP Tool extension to that standard. The API uses content negotiation to determine which schema to use for the request and response.

The local development environment uses **Docker Compose** to run the application. It requires that both the `dmptool-apollo-server` and `dmptool-auth` services are also running (see the configuration section)

These rules apply to every change in this repo.

## Commands

Node **22** (see `.nvmrc`) and **npm**. Don't use yarn or pnpm, and don't create another lockfile.

| Task | Command |
| --- | --- |
| Install deps | `npm ci` |
| Dev server (http://localhost:4646) | `docker compose up` |
| Generate GraphQL schema | `npm run generate` (requires `dmptool-apollo-server` to be running) |
| Lint | `npm run lint` |
| Unit tests + coverage | `npm test` |
| Run a single test file | `npm run test path/to/__tests__/file.spec.tsx --coverage=false` |
| Production build | `npm run build` |
| Vulnerability scan | `npm run trivy-high` (blocking), `npm run trivy-med` (report only) |

## Boundaries

**Never:**
- Commit secrets, tokens, or `.env` files. If you add an env var, put it in `.env.example`, and mention in the PR that `buildspec.yaml` and `Dockerfile` and `Dockerfile.aws` need it too.
- Lower the Jest `coverageThreshold` in `jest.config.cjs`, add coverage ignores to hide untested code, or skip or delete tests so a run passes.
- Skip the husky pre-commit hook (`--no-verify`).
- Hand-edit the version in `package.json`.
- Run Prettier or a formatter on files you didn't change.
- Modify the files in `src/generated/` (they are auto-generated via `npm run generate`).
- Log secrets or PII (passwords (plain or hashed), the pepper, tokens, private keys, etc).

**Ask first:**
- Before adding, removing, or upgrading a dependency. Pin exact versions with `npm install --save-exact <package>@<version>`, because plain `npm install <package>` adds a `^`. `package-lock.json` changes only as a result of `npm install`; never edit it by hand.
- Before changing any configuration files or environment variables.

## Code style

`.prettierrc` and `eslint.config.mjs` are the source of truth for formatting and lint rules.

## Configuration

- Configuration is in `.env` files, `docker-compose.yaml`, `src/configuration.ts`. Don't hardcode config values in code. Use `process.env` or the `config.ts` file to access them.
- When making changes, keep in mind that when this application is deployed into our production environment, it will be running in a Docker container with a read-only filesystem. The ENV variables from both the `docker-compose.yaml` and the `config/*.json` files will be fed into the container via ENV variables by our CI/CD pipeline. If you add or change any of these variables please note it in the PR so that they can be updated accordingly.
- This app requires the `dmptool-apollo-server` service to be running on port `4000` because that service hosts the local MySQL database. You can check if the service is running by visiting `http://localhost:4000/up` in your browser. If you see a 404 error, the service is not running. If it is not running you may start it by navigating to the `dmptool-apollo-server` directory (which should be adjacent to this project) and run `docker compose up`. If you do not have access to the directory you should notify the development team so that they can either provide you with access or start it for you.
- This app requires the `dmptool-auth` service to be running on port `4646` because that service provides OAuth2 and OIDC authentication. You can check if the service is running by visiting `http://localhost:4646/healthz` in your browser. If you see a 404 error, the service is not running. If it is not running you may start it by navigating to the `dmptool-auth` directory (which should be adjacent to this project) and run `docker compose up`. If you do not have access to the directory you should notify the development team so that they can either provide you with access or start it for you.

## Plugins

- This app uses Fastify plugins to add functionality to the server. The plugins are located in the `src/plugins` directory. 
- The plugins in the root `src/plugins` folder apply to all requests and responses.
- The plugins in the `src/plugins/v3` folder apply to all requests and responses for the v3 API routes.
- The plugins are registered in the `src/server.ts` file.

## Handlers

- The handlers are located in the `src/handlers` directory. They provide shared logic for handling lower level functions important to every route like logging and error handling.

## Utils

- The utils are located in the `src/utils.ts` file. They provide shared utility functions that are used throughout the application.

## GraphQL

- The `src/graphql` directory contains the GraphQL queries and mutations that are used to interact with the `dmptool-apollo-server` service. The queries and mutations are written in `.graphql` files and are imported into the code using the `graphql-tag` package.
- The application uses the `@apollo/client` package to interact with the `dmptool-apollo-server` service. The `src/plugins/graphql.ts` file contains the Apollo client configuration and is registered as a Fastify plugin.

## Models

- The `src/models` directory contains the database models that are used to interact with either GraphQL or directly to the MySQL database.
- Most models extend the `BaseGraphQLModel` so that they can interact with the `dmptool-apollo-server` service via GraphQL queries and mutations. 
- The `maDMP` model is an exception to this rule because it primarily provides services for logic for converting incoming JSON data into GraphQL queries and mutations. 
- The `maDMP` model also interacts directly with the MySQL database to retrieve the list of plans the caller has access to. This allows us to stop requests before they hit the GraphQL server.

## Machine actionable DMP (maDMP)

- The REST API service is designed to support the DMP Tool extension to the RDA Common Metadata Standard for DMPs.
- The Fastify server uses content negotiation to determine whether the request is for the plain RDA Common Metadata Standard for DMPs or the DMP Tool extension to the RDA Common Metadata Standard for DMPs. The `src/plugins/serialization.ts` file contains the logic for content negotiation and is registered as a Fastify plugin.
- The application also makes use of the `@dmptool/types` package for JSON schemas and Zod validation. We also use the `@dmptool/utils` package for utility functions and types that help convert DB records into maDMP JSON.

## Authentication and authorization

- Endpoints that require authentication and authorization are protected by the `src/plugins/auth.ts` file. This file contains the logic for validating access tokens. It does not attempt to verify that a user has permission to do anything, just that they have a valid token or not. It is registered as a Fastify plugin.
- The `dmptool-apollo-server` GraphQL server typically handles all authorization logic. This REST API service passes the access token on to the GraphQL server for validation and authorization. The GraphQL server will return an error if the user is not authorized to perform the requested action.

## Routes

- The routes are located in the `src/plugins/v*` subdirectories. Each version of the API has its own subdirectory. The routes are registered as Fastify plugins in the `src/server.ts` file.
- Each version subdirectory contains: 
  - a `routes.ts` file that defines the routes for that version of the API.
  - a `swagger.ts` file that defines the Swagger documentation for that version of the API.
  - a `routeSchema.ts` file that defines the route schema in Fastify RouteShorthand (similar to OpenAPI format but a bit different)
  - an `outboundSerialization.ts` file that defines the serialization logic for outbound responses.
  - a `workflows` subdirectory that contains the logic for handling complex workflows that require multiple steps or interactions with the GraphQL server. The workflows are registered as Fastify plugins in the `routes.ts` file.
- The health check route is located in the `src/plugins/healthcheck.ts` file. It is registered as a Fastify plugin in the `src/server.ts` file.
- The linkset route is located in the `src/plugins/linkset.ts` file. It is registered as a Fastify plugin in the `src/server.ts` file.

## Logging

- The logger is a Pino logger that is configured to log to stdout in JSON format.

## Error handling

- The application uses standard HTTP status codes to indicate the success or failure of an API request. The error handling middleware is responsible for catching errors and returning a JSON response with the appropriate status code and error message. We also log the error to the logger for debugging purposes.

## Testing and verification

Before you call a task done, run these and make sure they pass (they're the same checks as `.husky/pre-commit`):

```bash
npm run lint
npm run build
npm test            # fails if coverage drops below the thresholds in jest.config.cjs
```

- Put unit tests in a `__tests__/` folder next to the code, named `*.spec.tsx` or `*.spec.ts`.
- Every new function or file needs tests
- Coverage should be >= 90% for statements, branches, functions, and lines. If you add a new function or file, it must be covered by tests.
- If a resolver or existing function you change does not have tests add them.
- Always mock calls to external services, including the `dmptool-auth` service. Use Jest mocks and spies to verify that the code is calling the external service correctly, but don't actually call it.
- If `npm run trivy-high` can't run because Trivy isn't installed locally, say so. Don't treat it as passed.

## Proof of Work

Never claim something works without evidence. "Should work", "looks correct" and "tests pass" without output are not acceptable.

- When you finish a task, end with a Verification block:

-- Each command you ran, its exit code, and the last lines of its output (lint, type-check, test, plus any single test file).
-- For bug fixes: the test you wrote that failed before the fix and passes after. Show both runs.
-- For new features: the functionality you implemented and how you tested it.
-- For refactoring: the changes you made and how you verified they didn't break anything.
-- For documentation: the changes you made and how you verified they are accurate.
-- For performance improvements: the metrics you collected and how you verified the improvements.
-- Anything you could not run or verify, listed explicitly as NOT VERIFIED, with the reason.
-- If a check fails, report the failure. Don't summarize around it.

## Git and PR workflow

- **Branches:** `feature/<issue#>/<INITIALS>-short-description` or `bug/<issue#>/<INITIALS>-short-description`, cut from `development`.
- **Flow:** feature/bug → `development` → `stage` → `main`. Open feature PRs against **`development`**, never against `stage` or `main`.
- **Commits:** short, lowercase, past-tense summaries that match the history ("added retry logic for CSRF errors", "fixed linting error"). Keep each commit focused on one change.
- **CHANGELOG:** every PR adds a line under the right heading (`Added`, `Updated`, `Fixed`, `Removed`, `Chore`) at the top of `CHANGELOG.md`, ending with the issue number, e.g. `[#366]`.
- **PR description:** Be explicit about the changes that were made. Always highlight any GraphQL schema changes, database migrations that should be run, and any new environment variables that were added. Include information on how to test the changes.
- **PR review:** at least one other engineer must approve, and the PR author must address all comments before merging. If you disagree with a comment, explain why in the PR discussion.

## Dependencies & External Repositories

This project relies on microservices and shared schemas located in external repositories:

* **Apollo Server (Hosts the MySQL DB):** [dmptool-apollo-server](https://github.com/CDLUC3/dmptool-apollo-server)
  * *Agent Instruction:* This app's docker compose network contains the MySQL database and the cache. It also uses some of the routes in this app to verify CSRF and access tokens. If you need to modify the functionality behind those routes, you should check the `src/middleware/auth.ts` and `src/middleware/csrf.ts` files in the `dmptool-apollo-server` repository. Be sure to match branches when using this repository. For example if your feature branch is based off of the development branch in this repo then you should use the development branch in the `dmptool-apollo-server` repo
* **Auth Service:** [dmptool-auth](https://github.com/CDLUC3/dmptool-auth)
  * *Agent Instruction:* The `dmptool-auth` repository contains authentication logic for Oauth2 `client_credentials` and `authorization_code` workflows. Be sure to match branches when using this repository. For example if your feature branch is based off of the development branch in this repo then you should use the development branch in the `dmptool-auth` repo
* **@dmptool/types package:** [dmptool-types](https://github.com/CDLUC3/dmptool-types)
  * *Agent Instruction:* The `dmptool-types` repository contains shared types used to define maDMP JSON structures along with the JSON structures for questions and answers within a maDMP narrative section. In particular, see the `/schemas/dmptoolDmp.schema.json` and the various Zod files in the `src/` directory. You should always use the `main` branch of this repository.
* **@dmptool/utils package:** [dmptool-utils](https://github.com/CDLUC3/dmptool-utils)
  * *Agent Instruction:* The `dmptool-utils` repository contains shared utility functions and types used across the DMP Tool microservices. Before adding a new helper function, check to see if this repository already provides a suitable function. You should always use the `main` branch of this repository.
* **RDA Common Metadata Standard for DMPs:** [RDA Common Metadata Standard for DMPs](https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard/tree/master/examples/JSON/JSON-schema)
  * *Agent Instruction:* The RDA Common Metadata Standard for DMPs is a community-driven standard for describing data management plans. This API service supports the RDA Common Metadata Standard for DMPs.
* **RDA Common API specification for DMPs:** [RDA Common API specification for DMPs](https://github.com/RDA-DMP-Common/common-madmp-api/blob/main/openapi.yaml)
  * *Agent Instruction:* The RDA Common API specification for DMPs is a community-driven standard for describing the API endpoints for data management plans. This API service supports the RDA Common API specification for DMPs. The API uses content negotiation to determine which schema to use for the request and response.
