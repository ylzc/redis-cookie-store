import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from '@jest/globals';
import { createClient, RedisClientType } from 'redis';
import { Cookie, CookieJar } from 'tough-cookie';
import { RedisCookieStore } from '../src';

describe('get set cookies in store', () => {
    let redisClient: RedisClientType;

    async function prepare(store: RedisCookieStore) {
        const randomCookies = new Array(Math.floor(Math.random() * 8 + 2))
            .fill(null)
            .map((value, index, array) => {
                return new Cookie({
                    key: `test-key-${index}`,
                    value: `test-value-${index}-${Math.random()}`,
                    path: '/',
                    httpOnly: true,
                    domain: 'https://www.baidu.com',
                });
            });
        await redisClient.flushDb();
        await Promise.all(randomCookies.map(it => store.putCookie(it, () => {
        })));
        return randomCookies;
    }

    beforeAll(async () => {
        redisClient = createClient({
            url: process.env.REDIS_URL,
        });
        await redisClient.connect();
        await redisClient.flushDb();
    });
    test('should get 0 cookies from store', async () => {
        const store = new RedisCookieStore(redisClient);
        await store.getAllCookies((err, res) => {
            expect(Array.isArray(res)).toBe(true);
            expect(res.length).toBe(0);
        });
    });
    test('should get 1 cookies from store', async () => {
        const store = new RedisCookieStore(redisClient);
        const cookie = new Cookie({
            key: 'test-key',
            value: 'test-value',
            path: '/',
            httpOnly: true,
            domain: 'https://www.baidu.com',
        });
        await store.putCookie(cookie, () => {
        });
        await store.getAllCookies((err, res) => {
            expect(Array.isArray(res)).toBe(true);
            expect(res.length).toBe(1);
            expect(res[0].toString()).toBe(cookie.toString());
        });
    }, 10_000);
    test('should get 10 cookies from store', async () => {
        const store = new RedisCookieStore(redisClient);
        const randomCookies = await prepare(store);
        const cookies1 = await new Promise<Cookie[]>(resolve => {
            store.findCookies('https://www.baidu.com', '', true, (err, cookie) => {
                resolve(cookie);
            });
        });
        expect(Array.isArray(cookies1)).toBeTruthy();
        expect(cookies1.length).toBe(randomCookies.length);
        expect(
            cookies1.every((it) => {
                return !!randomCookies.find(random => it.toString() === random.toString());
            }),
        ).toBeTruthy();
    }, 10_000);
    test('should del all cookies from store', async () => {
        const store = new RedisCookieStore(redisClient);
        const randomCookies = await prepare(store);
        await store.removeAllCookies(() => {
        });
        await store.getAllCookies((err, res) => {
            expect(Array.isArray(res)).toBe(true);
            expect(res.length).toBe(0);
        });
    }, 10_000);
    afterAll(async () => {
        if (redisClient) {
            await redisClient.disconnect();
        }
    });
});