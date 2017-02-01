import { expect } from 'chai';
const RedisAdapter = require('../lib/adapters/RedisAdapter').default;

describe('RedisAdapter', function () {
    describe('RedisAdapter#get()', function () {
        it('should invoke the get method of the Redis client with the right arguments', function () {
            // Create Redis client mock
            function RedisClient() { }
            RedisClient.prototype.get = function () {
                expect(arguments[0]).to.equal('key');
                expect(arguments[1]).to.be.a('function');
            };

            const client = new RedisClient();
            const adapter = new RedisAdapter(client, 3600);
            adapter.get('key', () => { });
        });
    });
    describe('RedisAdapter#set()', function () {
        it('should invoke the set method of the Redis client with the right arguments', function () {
            // Create Redis client mock
            function RedisClient() { }
            RedisClient.prototype.set = function () {
                expect(arguments[0]).to.equal('key');
                expect(arguments[1]).to.equal('value');
                expect(arguments[2]).to.equal('EX');
                expect(arguments[3]).to.equal(3600);
                expect(arguments[4]).to.be.a('function');
            };

            const client = new RedisClient();
            const adapter = new RedisAdapter(client, 3600);
            adapter.set('key', 'value', () => { });
        });
    });
    describe('RedisAdapter#touch()', function () {
        it('should invoke the set method of the Redis client with the right arguments', function () {
            // Create Redis client mock
            function RedisClient() { }
            RedisClient.prototype.expire = function () {
                expect(arguments[0]).to.equal('key');
                expect(arguments[1]).to.equal(3600);
                expect(arguments[2]).to.be.a('function');
            };

            const client = new RedisClient();
            const adapter = new RedisAdapter(client, 3600);
            adapter.touch('key', () => { });
        });
    });
});