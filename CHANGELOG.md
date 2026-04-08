# dmptool-api Changelog

## 2026-04-02
- Added new `config` plugin and `configuration.ts` to load env variables and make them available to the server
- Added new routes for CRUD operations on a DMP
- Added new `utils.ts` file with helper functions
- Added new `types.ts` file with type definitions

## 2026-04-01
- Update to use `fastify.log` instead of `console.log`
- Refactored the server startup to encapsulate the hook registration and listen into a single function

## 2026-03-25
Initial commit - setup Fastify with basic routes and JWT auth plugins
