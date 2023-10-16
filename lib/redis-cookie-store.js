"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCookieStore = void 0;
const tough_cookie_1 = require("tough-cookie");
// internal modules
class RedisCookieStore extends tough_cookie_1.Store {
    id;
    client;
    idx;
    constructor(redisClient, id) {
        super();
        const self = this;
        self.idx = {};
        self.id = id || 'default';
        self.client = redisClient;
        self.synchronous = false;
    }
    getKeyName(domain, path) {
        const self = this;
        if (path) {
            return `cookie-store:${self.id}:cookie:${domain}:${path}`;
        }
        return `cookie-store:${self.id}:cookie:${domain}`;
    }
    findCookie(domain, path, key, cb) {
        const self = this;
        const { client } = self;
        const keyName = self.getKeyName(domain, path);
        client.hGet(keyName, key)
            .then(str => cb(null, tough_cookie_1.Cookie.fromJSON(str)))
            .catch(err => cb(err, null));
    }
    async findCookies(domain, path, allowSpecialUseDomain, cb) {
        const self = this;
        const results = [];
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
        const domains = (0, tough_cookie_1.permuteDomain)(domain, allowSpecialUseDomain) || [domain];
        const paths = (0, tough_cookie_1.permutePath)(path) || [path];
        const patterns = domains.map(domain => paths.map(path => `${this.getKeyName(domain)}:${path}`)).flat();
        try {
            await Promise.all(patterns.map(pattern => this._scan(pattern, async (keys) => {
                const dataArr = await client.mGet(keys);
                dataArr.forEach(it => {
                    results.push(tough_cookie_1.Cookie.fromJSON(it));
                });
            })));
            cb(null, results);
            return;
        }
        catch (e) {
            cb(e, null);
        }
    }
    ;
    putCookie(cookie, cb) {
        const self = this;
        const { client } = self;
        const { key: cookieName, domain, path } = cookie;
        const keyName = self.getKeyName(domain, path);
        const cookieString = cookie.toString();
        client.hSet(keyName, cookieName, cookieString)
            .then(() => cb(null))
            .catch(err => cb(err));
    }
    updateCookie(oldCookie, newCookie, cb) {
        const self = this;
        // updateCookie() may avoid updating cookies that are identical.  For example,
        // lastAccessed may not be important to some stores and an equality
        // comparison could exclude that field.
        self.putCookie(newCookie, cb);
    }
    removeCookie(domain, path, key, cb) {
        const self = this;
        const { client } = self;
        const keyName = self.getKeyName(domain, path);
        client.hDel(keyName, key)
            .then(() => cb(null))
            .catch(err => cb(err));
    }
    async removeCookies(domain, path, cb) {
        const self = this;
        const { client } = self;
        if (path && path !== '*') {
            const keyName = self.getKeyName(domain, path);
            try {
                await client.del(keyName);
                cb(null);
            }
            catch (e) {
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
        }
        catch (e) {
            cb(e);
        }
    }
    async getAllCookies(cb) {
        const client = this.client;
        const cookies = [];
        const pattern = this.getKeyName('*');
        await this._scan(pattern, async (keys) => {
            const dataArr = await client.mGet(keys);
            dataArr.forEach(it => {
                cookies.push(tough_cookie_1.Cookie.fromJSON(it));
            });
        });
        cb(null, cookies);
    }
    async _scan(pattern, cb) {
        const client = this.client;
        if (client) {
            const time = Date.now();
            // logger.log(`session repair: ${pattern} start at ${time}`);
            let cursor = 0, flag = true, count = 1;
            while (flag) {
                try {
                    const { cursor: next, keys } = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
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
                }
                catch (e) {
                    flag = false;
                    console.log(e);
                }
            }
            // logger.log(`session repair: ${pattern} end at ${Date.now()}`);
        }
    }
}
exports.RedisCookieStore = RedisCookieStore;
//# sourceMappingURL=redis-cookie-store.js.map