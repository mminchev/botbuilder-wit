import { expect } from "chai";
const MemcachedAdapter = require("../lib/adapters/MemcachedAdapter").default;

describe("MemcachedAdapter", () => {
    describe("MemcachedAdapter#get()", () => {
        it("should invoke the get method of the Memcached client with the right arguments", () => {
            // Create Memcached client mock
            // tslint:disable-next-line:no-empty
            function Client() { }
            Client.prototype.get = (...args: any[]) => {
                expect(args[0]).to.equal("key");
                expect(args[1]).to.be.a("function");
            };

            const client = new Client();
            const adapter = new MemcachedAdapter(client, 3600);
            adapter.get("key", () => { });
        });
    });
    describe("MemcachedAdapter#set()", () => {
        it("should invoke the set method of the Memcached client with the right arguments", () => {
            // Create Memcached client mock
            function Client() { }
            Client.prototype.set = (...args: any[]) => {
                expect(args[0]).to.equal("key");
                expect(args[1]).to.equal("value");
                expect(args[2]).to.equal(3600);
                expect(args[3]).to.be.a("function");
            };

            const client = new Client();
            const adapter = new MemcachedAdapter(client, 3600);
            adapter.set("key", "value", () => { });
        });
    });
    describe("MemcachedAdapter#touch()", () => {
        it("should invoke the set method of the Memcached client with the right arguments", () => {
            // Create Memcached client mock
            function Client() { }
            Client.prototype.touch = (...args: any[]) => {
                expect(args[0]).to.equal("key");
                expect(args[1]).to.equal(3600);
                expect(args[2]).to.be.a("function");
            };

            const client = new Client();
            const adapter = new MemcachedAdapter(client, 3600);
            adapter.touch("key", () => { });
        });
    });
});
