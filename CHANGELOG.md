# dmptool-api Changelog

## 2026-05-26
- Added create-time validation for `POST /dmps` to reject payloads containing more than one `dmp.project` with a `dmp_invalid` error
- Added GraphQL funding models and workflow support to map `dmp.project[0].funding` plus DMP Tool extensions (`funding_opportunity` and `funding_project`) into `ProjectFunding` and `PlanFunding` records
- Added/updated workflow and model tests for the new funding processing path
- Refactored error handling behavior across the API to enforce consistent log severity by failure type (request warning, model error, system fatal)
- Added route-level auth guards for mutating v3 endpoints (`POST/PUT/DELETE /dmps`) with structured `authentication_required` responses
- Updated `POST /dmps` flow to consume workflow log metadata and log with explicit severity before returning structured API errors
- Improved `createPlanWorkflow` model-error handling by distinguishing strict vs lenient model errors and allowing lenient artifacts (e.g. alternate identifiers) without failing successful creates
- Fixed `planWorkflow` alternate identifier logging typo (`alternat_identifier` -> `alternate_identifier`)
- Refactored member processing into strict/lenient model-error classification with severity-aware logging in `memberWorkflow`
- Added new `mutationWorkflow` to encapsulate shared update/delete precondition checks (DMP id validation and `If-Unmodified-Since` conflict handling)
- Updated `PUT /dmps` and `DELETE /dmps` routes to use workflow results and centralized route-level failure logging
- Updated GraphQL error conversion to treat upstream 400 responses as fatal internal errors while bubbling 401/403/404 with debug-level logging
- Updated global Fastify error handler logging to use warning-level logging for request/validation errors and fatal-level logging for system errors
- Updated route/workflow/error tests to align with ESM-safe mocking (`unstable_mockModule`) and new error handling behavior

## 2026-05-21
- Renamed versionedTemplate model to VersionedTemplate
- Uncommented lint, test and audit in CodeBuild file
- Added codegen GraphQL files to repo

## 2026-05-22
- Refactored error handling behavior across the API to enforce consistent log severity by failure type (request warning, model error, system fatal)
- Added route-level auth guards for mutating v3 endpoints (`POST/PUT/DELETE /dmps`) with structured `authentication_required` responses
- Updated `POST /dmps` flow to consume workflow log metadata and log with explicit severity before returning structured API errors
- Improved `createPlanWorkflow` model-error handling by distinguishing strict vs lenient model errors and allowing lenient artifacts (e.g. alternate identifiers) without failing successful creates
- Fixed `planWorkflow` alternate identifier logging typo (`alternat_identifier` -> `alternate_identifier`)
- Refactored member processing into strict/lenient model-error classification with severity-aware logging in `memberWorkflow`
- Added new `mutationWorkflow` to encapsulate shared update/delete precondition checks (DMP id validation and `If-Unmodified-Since` conflict handling)
- Updated `PUT /dmps` and `DELETE /dmps` routes to use workflow results and centralized route-level failure logging
- Updated GraphQL error conversion to treat upstream 400 responses as fatal internal errors while bubbling 401/403/404 with debug-level logging
- Updated global Fastify error handler logging to use warning-level logging for request/validation errors and fatal-level logging for system errors
- Updated route/workflow/error tests to align with ESM-safe mocking (`unstable_mockModule`) and new error handling behavior

## 2026-05-21
- Renamed versionedTemplate model to VersionedTemplate
- Uncommented lint, test and audit in CodeBuild file
- Added codegen GraphQL files to repo

## 2026-05-20
- Added `CODEGEN_GRAPHQL_URI` to the `.env.example` (was missing last time)
- Removed hardcoded DMP examples from README and instead added reference to the `docs/jsonSamples` files
- Added GraphQL queries and mutations for Affiliations and Project/Plan Members
- Added Models for Collaborator, Affiliations, MemberRole and Project/Plan Members
- Fixed an issue with the Plan create where it was not setting the title because the GraphQL mutation doesn't allow it. It now calls create and then update if the create was successful
- Fixed an issue where the Project was not properly saving the Research Domain id. It will now lookup the id using a new GraphQL query
- Added tests for every Model
- Moved logic to find the specified template or use the default into the VersionedTemplate Model.
- The logic in the `routes.ts` file for the `POST /dmps` endpoint was getting long and hard to follow once I added the Member logic, so refactored to break that logic up into new `src/plugins/v3/workflows` files
  - The `saveMembersWorkflow.ts` which should work for both creating a new Project/Plan or updating an existing one
  - The `planWorkflow.ts` which just handles creating a Project/Plan at the moment but will also include update and delete in the future
- Removed overrides for `fast-jwt`, `fast-uri` and `fast-xml-parser`
- Added overrides for `ws` and `brace-expansion` to fix some issues with the latest versions of those packages

## 2026-05-14
- Added helper types to `src/types.ts` to facilitate access to nested portions of the JSON schemas
- Updated the `server.ts` to load the new GraphQL plugin
- Modified the api v3 routes to allow creation of DMPs
- Update the serialization plugin to support the DMP Tool and RDA schemas
- Added a redirect to the routes plugin to handle missing slash to Swagger UI
- Fixed some issues with the structure of the DMP Tool schema
- Added the refresh token to the Fastify request
- Added Plan, Project and VersionedTemplate models
- Added an abstract `BaseGQL.ts` file to handle common GraphQL functionality
- Added GraphQL query and mutation documents to `src/graphql/`
- Added a new GraphQL plugin to set up the GraphQL client
- Updated the `configuration.ts` to support GraphQL config
- Added JSON sample files to `docs/jsonSamples/` for use when testing the Swagger UI
- Added a `generate` script to package.json to generate the GraphQL schema
- Added a GraphQL `codegen.ts` file to generate the GraphQL schema to `src/generated/`
- Updated `.gitignore` to skip the `src/generated` directory
- Added Graphql URI to the `docker-compose.yml`
- Added `generateDMPId` function to `maDMP.ts` to support Current DMP Tool integration
- Updated dependencies

## 2026-04-02
- Updated the `server` to use the new plugins and added `strictSchema: false` to allow our Zod defaults to work
- Added `@fastify/rate-limit`, `@fastify/swagger` and `@fastify/swagger-ui`
- Updated `@dmptool/types` version and `serializer` definition to work with the updated schema
- Added new `error` plugin to ensure error formats
- Added `linkset` plugin that adds an API discovery endpoint for machines
- Added `serialization` plugin to handle content negotiation
- Updated `routes` plugin to support all the RDA Common API spec endpoints
- Added new `config` plugin and `configuration.ts` to load env variables and make them available to the server
- Added a `utils` file with a `isDmpId` helper function
- Added new routes for CRUD operations on a DMP
- Added new `utils.ts` file with helper functions
- Added new `types.ts` file with type definitions
- Enabled use of the jest `setup` file
- Updated `.env.example` with new ENV variables
- Updated README documentation

## 2026-04-01
- Update to use `fastify.log` instead of `console.log`
- Refactored the server startup to encapsulate the hook registration and listen into a single function

## 2026-03-25
Initial commit - setup Fastify with basic routes and JWT auth plugins
