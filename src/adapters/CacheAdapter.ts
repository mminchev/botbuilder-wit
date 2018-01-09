import { CacheAdapterResult } from "../types";

abstract class CacheAdapter {
    constructor(public expire: number) { }

    public abstract get(key: string, callback: CacheAdapterResult): void;
    public abstract set(key: string, value: string, callback: CacheAdapterResult): void;
    public abstract touch(key: string, callback: CacheAdapterResult): void;
}

export default CacheAdapter;
