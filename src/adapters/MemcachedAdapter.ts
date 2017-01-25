import CacheAdapter from './CacheAdapter';
import { ResultCallback } from './CacheAdapter';

export default class MemcachedAdapter extends CacheAdapter {
    constructor(public memcachedClient: any, public expire: number) {
        super();
    }

    /**
     * Implements the CacheAdapter's abstract get method
     * @param {string} key - the value of the key to look up
     * @param {function} callback - the result callback
     */
    get(key: string, callback: ResultCallback) {
        this.memcachedClient.get(key, callback);
    }
    /**
     * Implements the CacheAdapter's abstract set method
     * @param {string} key - the value of the key to be used for this particular value
     * @param {string} value - the value to be stored in the cache
     * @param {function} callback - the result callback
     */
    set(key: string, value: string, callback: ResultCallback) {
        this.memcachedClient.set(key, value, this.expire, callback);
    }
}