import { expect } from "chai";
const RedisAdapter = require("../lib/adapters/RedisAdapter").default;

describe("RedisAdapter", () => {
    describe("RedisAdapter#get()", () => {
        it("should invoke the get method of the Redis client with the right arguments", () => {
            // Create Redis client mock
            function RedisClient() { }
            RedisClient.prototype.get = (...args: any[]) => {
                expect(args[0]).to.equal("key");
                expect(args[1]).to.be.a("function");
            };

            const client = new RedisClient();
            const adapter = new RedisAdapter(client, 3600);
            adapter.get("key", () => { });
        });
    });
    describe("RedisAdapter#set()", () => {
        it("should invoke the set method of the Redis client with the right arguments", () => {
            // Create Redis client mock
            function RedisClient() { }
            RedisClient.prototype.set = (...args: any[]) => {
                expect(args[0]).to.equal("key");
                expect(args[1]).to.equal("value");
                expect(args[2]).to.equal("EX");
                expect(args[3]).to.equal(3600);
                expect(args[4]).to.be.a("function");
            };

            const client = new RedisClient();
            const adapter = new RedisAdapter(client, 3600);
            adapter.set("key", "value", () => { });
        });
    });
    describe("RedisAdapter#touch()", () => {
        it("should invoke the set method of the Redis client with the right arguments", () => {
            // Create Redis client mock
            function RedisClient() { }
            RedisClient.prototype.expire = (...args: any[]) => {
                expect(args[0]).to.equal("key");
                expect(args[1]).to.equal(3600);
                expect(args[2]).to.be.a("function");
            };

            const client = new RedisClient();
            const adapter = new RedisAdapter(client, 3600);
            adapter.touch("key", () => { });
        });
    });
});
