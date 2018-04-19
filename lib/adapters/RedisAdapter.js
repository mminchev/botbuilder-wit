"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CacheAdapter_1 = require("./CacheAdapter");
class RedisAdapter extends CacheAdapter_1.default {
    constructor(redisClient, expire) {
        super(expire);
        this.redisClient = redisClient;
        this.expire = expire;
    }
    get(key, callback) {
        this.redisClient.get(key, callback);
    }
    set(key, value, callback) {
        this.redisClient.set(key, value, "EX", this.expire, callback);
    }
    touch(key, callback) {
        this.redisClient.expire(key, this.expire, callback);
    }
}
exports.default = RedisAdapter;
//# sourceMappingURL=RedisAdapter.js.map