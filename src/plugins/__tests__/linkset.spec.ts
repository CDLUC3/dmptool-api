import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import linksetPlugin from '../linkset.js';
import configPlugin from "../config.js";

describe('routesPlugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(configPlugin, {});
    await fastify.register(linksetPlugin, {});
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('HEAD /.well-known/api-catalog', () => {
    it('should return 200 status code', async () => {
      const response = await fastify.inject({
        method: 'HEAD',
        url: '/.well-known/api-catalog',
      });

      expect(response.statusCode).toBe(200);
      const expectedHdr = "application/linkset+json;profile=\"https://www.rfc-editor.org/info/rfc9727\""
      expect(response.headers['content-type']).toEqual(expectedHdr);
      const expectedLinkHdr = `<http://localhost:4060/.well-known/api-catalog>; rel="api-catalog"`;
      expect(response.headers['link']).toEqual(expectedLinkHdr);
    });
  });

  describe('GET /.well-known/api-catalog', () => {
    it('should return 200 status code', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/.well-known/api-catalog',
      });

      expect(response.statusCode).toBe(200);
      const expectedHdr = "application/linkset+json; profile=\"https://www.rfc-editor.org/info/rfc9727\"; charset=utf-8";
      expect(response.headers['content-type']).toEqual(expectedHdr);
      const json = JSON.parse(response.body);
      const expected = {
        anchor: `http://localhost:4060/.well-known/api-catalog`,
        item: [
          {href: `http://localhost:4060/api/v3`},
        ]
      };
      expect(json.linkset[0]).toEqual(expected);
    });
  });
});
