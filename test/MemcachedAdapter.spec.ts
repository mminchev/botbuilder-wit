import { expect } from 'chai';
const MemcachedAdapter = require('../lib/adapters/MemcachedAdapter').default;

describe('MemcachedAdapter', function () {
    describe('MemcachedAdapter#get()', function () {
        it('should invoke the get method of the Memcached client with the right arguments', function () {
            // Create Memcached client mock
            function Client() { }
            Client.prototype.get = function () {
                expect(arguments[0]).to.equal('key');
                expect(arguments[1]).to.be.a('function');
            };

            const client = new Client();
            const adapter = new MemcachedAdapter(client, 3600);
            adapter.get('key', () => { });
        });
    });
    describe('MemcachedAdapter#set()', function () {
        it('should invoke the set method of the Memcached client with the right arguments', function () {
            // Create Memcached client mock
            function Client() { }
            Client.prototype.set = function () {
                expect(arguments[0]).to.equal('key');
                expect(arguments[1]).to.equal('value');
                expect(arguments[2]).to.equal(3600);
                expect(arguments[3]).to.be.a('function');
            };

            const client = new Client();
            const adapter = new MemcachedAdapter(client, 3600);
            adapter.set('key', 'value', () => { });
        });
    });
    describe('MemcachedAdapter#touch()', function () {
        it('should invoke the set method of the Memcached client with the right arguments', function () {
            // Create Memcached client mock
            function Client() { }
            Client.prototype.touch = function () {
                expect(arguments[0]).to.equal('key');
                expect(arguments[1]).to.equal(3600);
                expect(arguments[2]).to.be.a('function');
            };

            const client = new Client();
            const adapter = new MemcachedAdapter(client, 3600);
            adapter.touch('key', () => { });
        });
    });
});