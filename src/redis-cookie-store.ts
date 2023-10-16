// node core modules
import { inherits } from 'node:util';

// 3rd party modules
import _, { keys } from 'lodash';
import { Store, permuteDomain, permutePath, Cookie } from 'tough-cookie';
import type { RedisClientType } from 'redis';
import { ScanCommandOptions } from '@redis/client/dist/lib/commands/SCAN';

// internal modules

export class RedisCookieStore extends Store {

    id: string;
    client: RedisClientType;
    idx: Record<string, any>;

    constructor(redisClient: RedisClientType, id?: string) {
        super();
        const self = this;
        self.idx = {};
        self.id = id || 'default';
        self.client = redisClient;
        self.synchronous = false;
    }

    getKeyName(domain: string, path?: string) {
        const self = this;

        if (path) {
            return `cookie-store:${self.id}:cookie:${domain}:${path}`;
        }
        return `cookie-store:${self.id}:cookie:${domain}`;
    }

    findCookie(domain: string,
               path: string,
               key: string,
               cb: (err: Error | null, cookie: Cookie | null) => void) {
        const self = this;
        const { client } = self;

        const keyName = self.getKeyName(domain, path);
        client.hGet(keyName, key)
            .then(str => cb(null, Cookie.fromJSON(str)))
            .catch(err => cb(err, null));
    }

    async findCookies(
        domain: string,
        path: string,
        allowSpecialUseDomain: boolean,
        cb: (err: Error | null, cookie: Cookie[]) => void,
    ) {
        const self = this;
        const results: Cookie[] = [];
        const { client } = self;
        if (!client) {
            return cb(null, []);
        }
        if (typeof allowSpecialUseDomain === 'function') {
            cb = allowSpecialUseDomain;
            allowSpecialUseDomain = true;
        }
        if (!domain) {
            return cb(null, []);
        }
        const domains = permuteDomain(domain, allowSpecialUseDomain) || [domain];
        const paths = permutePath(path) || [path];
        const patterns = domains.map(domain => paths.map(path => `${this.getKeyName(domain)}:${path}`)).flat();
        try {
            await Promise.all(
                patterns.map(pattern => this._scan(
                    pattern,
                    async (keys) => {
                        const dataArr = await client.mGet(keys);
                        dataArr.forEach(it => {
                            results.push(Cookie.fromJSON(it));
                        });
                    }),
                ),
            );
            cb(null, results);
            return;
        } catch (e) {
            cb(e, null);
        }
    };

    putCookie(cookie: Cookie, cb: (err: Error | null) => void) {
        const self = this;
        const { client } = self;

        const { key: cookieName, domain, path } = cookie;
        const keyName = self.getKeyName(domain, path);
        const cookieString = cookie.toString();

        client.hSet(keyName, cookieName, cookieString)
            .then(() => cb(null))
            .catch(err => cb(err));
    }

    updateCookie(oldCookie: Cookie, newCookie: Cookie, cb: (err: Error | null) => void) {
        const self = this;

        // updateCookie() may avoid updating cookies that are identical.  For example,
        // lastAccessed may not be important to some stores and an equality
        // comparison could exclude that field.
        self.putCookie(newCookie, cb);
    }

    removeCookie(domain: string, path: string, key: string, cb: (err: Error | null) => void) {
        const self = this;
        const { client } = self;

        const keyName = self.getKeyName(domain, path);
        client.hDel(keyName, key)
            .then(() => cb(null))
            .catch(err => cb(err));
    }

    async removeCookies(domain: string, path: string, cb: (err: Error | null) => void) {
        const self = this;
        const { client } = self;
        if (path && path !== '*') {
            const keyName = self.getKeyName(domain, path);
            try {
                await client.del(keyName);
                cb(null);
            } catch (e) {
                cb(e);
            }
            return;
        }
        try {
            const keyName = `${self.getKeyName(domain)}:*`;
            await this._scan(keyName, async (keys) => {
                await client.del(keys);
            });
            cb(null);
        } catch (e) {
            cb(e);
        }
    }

    async getAllCookies(cb: (err: Error | null, cookie: Cookie[]) => void) {
        const client = this.client;
        const cookies: Cookie[] = [];
        const pattern = this.getKeyName('*');
        await this._scan(pattern, async (keys) => {
            const dataArr = await client.mGet(keys);
            dataArr.forEach(it => {
                cookies.push(Cookie.fromJSON(it));
            });
        });
        cb(null, cookies);
    }

    async _scan(pattern: string, cb: (keys: string[]) => Promise<void>) {
        const client = this.client;
        if (client) {
            const time = Date.now();
            // logger.log(`session repair: ${pattern} start at ${time}`);
            let cursor = 0, flag = true, count = 1;
            while (flag) {
                try {
                    const { cursor: next, keys } = await client.scan(cursor, { MATCH: pattern, COUNT: 100 } as ScanCommandOptions);
                    cursor = next;
                    if (cursor === 0) {
                        flag = false;
                    }
                    if (Array.isArray(keys) && keys.length) {
                        count = count + keys.length;
                        await cb(keys);
                    }
                    if (Date.now() - time >= 10 * 1000) {
                        flag = false;
                        // logger.error(`session repair: ${pattern} timeout`);
                    }
                } catch (e) {
                    flag = false;
                    console.log(e);
                }
            }
            // logger.log(`session repair: ${pattern} end at ${Date.now()}`);
        }
    }
}