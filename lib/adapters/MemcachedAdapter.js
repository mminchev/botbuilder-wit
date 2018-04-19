"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CacheAdapter_1 = require("./CacheAdapter");
class MemcachedAdapter extends CacheAdapter_1.default {
    constructor(memcachedClient, expire) {
        super(expire);
        this.memcachedClient = memcachedClient;
        this.expire = expire;
    }
    get(key, callback) {
        this.memcachedClient.get(key, callback);
    }
    set(key, value, callback) {
        this.memcachedClient.set(key, value, this.expire, callback);
    }
    touch(key, callback) {
        this.memcachedClient.touch(key, this.expire, callback);
    }
}
exports.default = MemcachedAdapter;
//# sourceMappingURL=MemcachedAdapter.js.map