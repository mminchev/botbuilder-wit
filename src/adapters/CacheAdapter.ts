export type ResultCallback = (error: Error, result: any) => void;

abstract class CacheAdapter {
    constructor(public expire: number) { }

    abstract get(key: string, callback: ResultCallback): void;
    abstract set(key: string, value: string, callback: ResultCallback): void;
    abstract touch(key: string, callback: ResultCallback): void;
}

export default CacheAdapter;