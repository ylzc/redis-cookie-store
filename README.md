# Redis Cookie Store

a Redis store for tough-cookie module.
See [tough-cookie documentation](https://github.com/goinstant/tough-cookie#constructionstore--new-memorycookiestore-rejectpublicsuffixes)
for more info.

## Installation

```sh
npm install --save @ijs/tough-cookie-redis-store
```

## Options

* `client` An existing redis client object you normally get from `redis.createClient()`
* `id` **optional** ID for each redis store so that we can use multiple stores with the same redis database [
  *default:* 'default']

## Usage

```js
const { createClient } = require('redis');
const { CookieJar } = require('tough-cookie');
const { RedisCookieStore } = require('@ijs/tough-cookie-redis-store');

const client = createClient();

const defaultJar = new CookieJar(new RedisCookieStore(client));

const myJar = new CookieJar(new RedisCookieStore(client, 'my-cookie-store'));
```

## 说明

内部使用redis hash结构存储

HSET的三个参数key, value, fieldValue分别是:  
key: `cookie-store:${store.id}:cookie:${cookie.domain}:${cookie.path}`即域名+路径  
value: `cookie.key`  
fieldValue: `JSON.stringify(cookie.toJSON())`

node_redis 库有auto pipeline的能力所以代码使用`SCAN`进行循环执行`HGETALL`批量获取cookie  
emm 具体性能测试没有详细进行，理论上是会因为大key（一个hash有很多成员）出现性能问题。

但是目前个人使用场景 `new CookieJar(new RedisCookieStore(client, userId))` 是按照用户来区分，
理论上一个userId+域名+路径作为一个hash不会出现大key，就是redis中key总量比较大

## License

MIT
