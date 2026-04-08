# dmptool-api Changelog

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
