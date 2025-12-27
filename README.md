# hyper-sdk

A Software Development Kit for the [hypercore-protocol](https://hypercore-protocol.org/)

## Why use this?

Hypercore-protocol and it's ecosystem consists of a bunch of low level building blocks for working with data in distributed applications. Although this modularity makes it easy to mix and match pieces, it adds complexity when it comes to actually building something.

The Hyper SDK combines the lower level pieces of the Hyper stack into high level APIs that you can use across platforms so that you can focus on your application rather than the gritty details of how it works.

## Goals

- High level API
- Cross-platform with same codebase
  - ✔ [Node.js](https://nodejs.org/en)
  - ✔ [Electron](https://www.electronjs.org/)
  - ✔ [Pear](https://docs.pears.com/)
  - 🏗️ Web (PRs welcome)

## Installation

Make sure you've set up [Node.js](https://nodejs.org/).

```shell
npm install --save hyper-sdk
# or yarn
```

```js
import * as SDK from "hyper-sdk"
```

## API

### SDK.create()

```JavaScript
const sdk = await SDK.create({
  // This argument is mandatory since Hypercore no longer support in-memory
  // Check out the env-paths module for application specific path storage
  storage: './hyper-sdk',

  // This controls whether the SDK will automatically start swarming when loading a core via `get`
  // Set this to false if you want to have more fine control over peer discovery
  autoJoin: true,

  // Specify options to pass to the Corestore constructor
  // The storage will get derived from the `storage` parameter
  // https://github.com/hypercore-protocol/corestore/
  corestoreOpts: {},

  // Specify options to pass to the hyperswarm constructor
  // The keypair will get derived automatically from the corestore
  // https://github.com/hyperswarm/hyperswarm
  swarmOpts: {},
})
```

### sdk.publicKey

The public key used for identifying this peer in the hyperswarm network.

This is a 32 byte buffer which can be use in conjunction with `sdk.joinPeer()` to connect two peers directly together.

### sdk.connections

The list of active connections to other peers, taken from hyperswarm.

### sdk.peers

The list of active peers.

Each peer has a `publicKey`, and list of `topics`

You can find more docs in the [hyperswarm](https://github.com/hyperswarm/hyperswarm#peerinfo-api) repo.

### sdk.cores

List of active Hypercores.

### sdk.on('peer-add', peerInfo) / sdk.on('peer-remove', peerInfo)

You can listen on when a peer gets connected or disconnected with this event.

You can find more docs in the [hyperswarm](https://github.com/hyperswarm/hyperswarm#peerinfo-api) repo.

```JavaScript
sdk.on('peer-add', (peerInfo) => {
  console.log('Connected to', peerInfo.publicKey, 'on', peerInfo.topics)
})
sdk.on('peer-add', (peerInfo) => {
  console.log('Disconnected from')
})
```

### sdk.get()

You can initialize a [Hypercore](https://github.com/hypercore-protocol/hypercore) instance by passing in a key, a name to derive a key from, or a URL containing either a key or a DNS name.

Unlike corestore, you may not initialize a hypercore from a `null` key since everything must be derivable or loadable.

Unless `autoJoin` is set to `false`, the peer discovery will be automatically started for the core.

```JavaScript
// Derive a key from a "name"
const core = await sdk.get('example name')

// Resolve DNS to a hypercore
const core = await sdk.get('hyper://example.mauve.moe')

// Buffer key, 32 bytes of 0's
const core = await sdk.get(b4a.alloc(32, 0))

// Hex key, equivalent to 32 bytes of zeros
const core = await sdk.get('hyper://0000000000000000000000000000000000000000000000000000000000000000')

// z32 encoded, equivalent to 32 bytes of zeros
const core = await sdk.get('hyper://yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy')

// Don't auto-join the swarm for the core on init
const core = await sdk.get('example', {autoJoin: false})
```

### sdk.getDrive()

You can initialize a [Hyperdrive](https://github.com/holepunchto/hyperdrive-next) instance by passing in the same arguments as in `sdk.get()`.

In addition to the usual `hyperdrive` properties, there's a new `url` property to get the `hyper://` URL for the drive to used elsewhere.

Note that the drives's metadata DB's discovery key will be used for replicating if `autoJoin` is `true`.

Hyperdrive is mostly useful for storing and loading files since it splits the metadata representing the file systema and the blob storage into separate cores.

```JavaScript
const drive = await sdk.getDrive('hyper://blob.mauve.moe')
for(const path of drive.readdir('/')) {
  const stat = drive.stat(path)
}
```

### sdk.getBee()

You can initialize a [Hyperbee](https://github.com/holepunchto/hyperbee) instance by passing the same arguments as in `sdk.get()`.

In addition to the usual `hyperbee` properties, there's a new `url` property to get the `hyper://` URL for the bee to used elsewhere.

Additionally, you should pass in a `keyEncoding` and a `valueEncoding` in order to control the encoding for data that's being written.

Hyperbee is best used when you want to create database indexes.

For an out of the box database with a proper query language, check out [HyperbeeDeeBee](https://github.com/RangerMauve/hyperbeedeebee/).

```JavaScript
const db = await sdk.getBee('example db')

const db = await sdk.getBee('example db', {keyEncoding: 'utf8', valueEncoding: 'json')
await db.put('hello', 'world')

for(const entry of db.createReadStream()) {
  console.log(entry)
}
```

### sdk.resolveDNSToKey()

You can manually resolve DNS addresses to hypercore keys on domains using the DNS Link spec with this method.

However, it's not mandatory to use DNS since `sdk.get()` will automatically detect and perform resolutions of DNS for `hyper://` URLs.

Hyper-SDK currently bypasses the OS DNS resolver and uses DNS Over HTTPS. You can configure your own using the `dnsResolver` config option and any of the options [on this list](https://dnsprivacy.org/public_resolvers/#dns-over-https-doh). By default we use the one provided by [Mozilla](https://developers.cloudflare.com/1.1.1.1/commitment-to-privacy/privacy-policy/firefox/).

```JavaScript
const key = await sdk.resolveDNSToKey('example.mauve.moe')
```

### sdk.namespace()

Get back a namespaced [Corestore](https://github.com/hypercore-protocol/corestore/) instance which can be passed to things like Hyperdrive.

Note that cores initialized with a namespaced corestore will not be auto-joined and you will need to call `sdk.join(core.discoveryKey)` on said cores.

```JavaScript
import Hypderdrive from "hyperdrive"

const drive = new Hyperdrive(sdk.namespace('example'))

// Wait for the drive to initiailize
await drive.ready()

// Manually trigger peer lookup for this drive
sdk.join(drive.publicKey)
```

### sdk.join() / sdk.leave()

You can manually trigger peer discovery of hypercores as well as stop peer discovery.
This can be done by using the `discoveryKey` of a hypercore, or any 32 byte buffer.

As well, you can use string names for topics in order to discover peers based on a human readable string.
When using string topics, they are converted to 32 byte buffers using the [Hypercore Crypto namespace algorithm](https://github.com/mafintosh/hypercore-crypto#list--cryptonamespacename-count).

```JavaScript
const core = await sdk.get('example', {autoJoin: false})

// Start finding peers without advertising
sdk.join(core.discoveryKey, {server: false})

// Listen on a human readable topic
sdk.join("cool cat videos")

sdk.leave(core.discoveryKey)
sdk.leave("cool cat videos")
```

### sdk.joinPeer() / sdk.leavePeer()

```JavaScript
const sdk1 = await SDK.create({storage: './sdk1'})
const sdk2 = await SDK.create({storage: './sdk1'})

sdk1.joinPeer(sdk2.publicKey)
```

### sdk.close()

This will gracefully close connections, remove advertisements from the DHT, and close any open file handles.

Make sure you invoke this to keep the network fast and to avoid data corruption!

### sdk.suspend()

This will pause network and data operations.
Use it when your app is in the background or the user wants to pause seeding.

### sdk.resume()

Undo the effects of `suspend()`, re-enable network and storage.

## TypeScript Support

This module comes with TypeScript types, but by default Hypercore and other Holepunch libraries do not.

You can add these missing types by importing them from the SDK's `types` folder in your `tsconfig.json` file.

Your `tsconfig.json` file should look something like this:

```
{
    "compilerOptions": {
        "module": "nodenext",
        "moduleResolution": "nodenext",
    },
    "extends": "@tsconfig/node20/tsconfig.json",
    "include": [
        "./test.js",
        "./node_modules/hyper-sdk/types/*.d.ts"
    ]
}
```