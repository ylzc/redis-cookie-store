# Redis Cookie Store

a Redis store for tough-cookie module. See [tough-cookie documentation](https://github.com/goinstant/tough-cookie#constructionstore--new-memorycookiestore-rejectpublicsuffixes) for more info.

## Installation

```sh
npm install --save @ijs/redis-cookie-store
```

## Options

* `client` An existing redis client object you normally get from `redis.createClient()`
* `id` **optional** ID for each redis store so that we can use multiple stores with the same redis database [*default:* 'default']

## Usage

```js
const { createClient } = require('redis');
const { CookieJar } = require('tough-cookie');
const { RedisCookieStore } = require('@ijs/redis-cookie-store');

const client = createClient();

const defaultJar = new CookieJar(new RedisCookieStore(client));

const myJar = new CookieJar(new RedisCookieStore(client, 'my-cookie-store'));
```

## License

MIT
