# sdk
The official Dat SDK

[<img src="https://datproject.github.io/design/downloads/dat-logo.png" align="right" width="140">][Dat Project]

## Why use this?

Dat consists of a bunch of low level building blocks for working with data in distributed applications. Although this modularity makes it easy to mix and match pieces, it adds complexity when it comes to actually building something.

The Dat SDK combines the lower level pieces of the Dat ecosystem into high level APIs that you can use across platforms so that you can focus on your application rather than the gritty details of how it works.

## Goals

- High level API
- Cross-platform with same codebase
  - ✔ Node
  - ✔ Web
  - ✔ Electron
  - React-Native (with [nodejs-mobile-react-native?](https://github.com/janeasystems/nodejs-mobile-react-native))

## Watch the workshop [Video](https://www.youtube.com/watch?v=HyHk4aImd_I&list=PL7sG5SCUNyeYx8wnfMOUpsh7rM_g0w_cu&index=20). Try it yourself: [workshop](https://github.com/RangerMauve/dat-workshop)

## Installing Node

[Node.js](https://nodejs.org/) / [Browserify](http://browserify.org/) workflows:

```shell
npm install --save dat-sdk
```

```js
const SDK = require('dat-sdk')
```

## Building a bundle for Browsers

The easiest way to get started is to run the `build` command in this `sdk`, then copy the `bundle.js` into your own project. Here's how:

```shell
git clone git@github.com:datproject/sdk.git

cd sdk

# Compile the SDK into a single JS file
npm run build

# Copy `dat-sdk-bundle.js` into your project
```

```html
<script src="dat-sdk-bundle.js"></script>
<script>
  const SDK = window.datSDK
  // Look at the examples from here
</script>
```

## Compile with Browserify

If the bundle above doesn't work for your setup, and you want to DIY in your own project, you'll need to mimic how the SDK generates the bundle, using:

- [x] Browserify
- [x] Babelify (babel for browserify)
- [x] babel.config.json file

Combine [Browserify](http://browserify.org/) with [Babel](https://babeljs.io/) (via [Babelify](https://www.npmjs.com/package/babelify)) to make this work in the browser:

**Dev** Dependencies (*must* be a DevDependency):

```
npm install --save-dev browserify babelify util 
```
and the regular dependencies
```
npm install --save dat-sdk@next @geut/sodium-javascript-plus hyperswarm-web
```

Add this as the `build` command in your `package.json`. It is important to add the transform (`-t`) with `babelify` to make it work. Babel will use the aliases in the [babel.config.json](https://github.com/datproject/sdk/blob/master/babel.config.json) file to change the code from nodejs to browser.

```shell
"build": "browserify -t [ babelify --global ] index.js > bundle.js"
```

Once you `npm run build` then you can use the generated `bundle.js` in your project!

## Compile with Webpack (webpack.config.js)

To bundle with webpack, you'll need to alias some dependencies.

```js
const path = require('path')

module.exports = {
  entry: './index.js',
  target: 'web',
  resolve: {
    alias: {
      fs: 'graceful-fs',
      hyperswarm: 'hyperswarm-web',
      util: './node_modules/util/util.js'
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
}
```

Then you can include `./dist/bundle.js` in your HTML page.

## API/Examples

```js
const SDK = require('dat-sdk')

const sdk = await SDK();
const {
	Hypercore,
	Hyperdrive,
	resolveName,
	close
} = sdk

// Create a new Hyperdrive.
// If you want to create a new archive, pass in a name for it
// This will be used to derive a secret key
// Every time you open a drive with that name it'll derive the same key
// This uses a master key that's generated once per device
// That means the same name will yield a different key on a different machine
const archive = Hyperdrive('My archive name', {
  // This archive will disappear after the process exits
  // This is here so that running the example doesn't clog up your history
  persist: false,
  // storage can be set to an instance of `random-access-*`
  // const RAI = require('random-access-idb')
  // otherwise it defaults to `random-access-web` in the browser
  // and `random-access-file` in node
  storage: null  //storage: RAI
})

// You should wait for the archive to be totally initialized
await archive.ready()

const url = `dat://${archive.key.toString('hex')}`

// TODO: Save this for later!
console.log(`Here's your URL: ${url}`)

// Check out the hyperdrive docs for what you can do with it
// https://www.npmjs.com/package/hyperdrive#api
await archive.writeFile('/example.txt', 'Hello World!')
console.log('Written example file!')

// This example is currently broken because Beaker's website isn't on Dat 2 yet
const key = await resolveName('dat://beakerbrowser.com')
const archive = Hyperdrive(key)
await archive.download()
// Pure all the data
await archive.destroyStorage()

const SOME_URL = 'dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/'

const someArchive = Hyperdrive(SOME_URL)

console.log(await someArchive.readdir('/'))

// Create a hypercore
// Check out the hypercore docs for what you can do with it
// https://github.com/mafintosh/hypercore
const myCore = Hypercore('my hypercore name', {
  valueEncoding: 'json',
  persist: false,
  // storage can be set to an instance of `random-access-*`
  // const RAI = require('random-access-idb')
  // otherwise it defaults to `random-access-web` in the browser
  // and `random-access-file` in node
  storage: null  // storage: RAI
})

// Add some data to it
await myCore.append(JSON.stringify({
  name: 'Alice'
}))

// Use extension messages for sending extra data over the p2p connection
const discoveryCoreKey = 'dat://bee80ff3a4ee5e727dc44197cb9d25bf8f19d50b0f3ad2984cfe5b7d14e75de7'
const discoveryCore = new Hypercore(discoveryCoreKey)

// Register the extension message handler
const extension = discoveryCore.registerExtension('discovery', {
	// Set the encoding type for messages
	encoding: 'binary',
	onmessage: (message, peer) => {
		// Recieved messages will be automatically decoded
		console.log('Got key from peer!', message)

		const otherCore = new Hypercore(message, {
      valueEncoding: 'json',
      persist: false
    })

    // Render the peer's data from their core
    otherCore.get(0, console.log)
	}
})

// When you find a peer tell them about your core
discoveryCore.on('peer-add', (peer) => {
	console.log('Got a peer!')
	extension.send(myCore.key, peer)
})

const hypertrie = require('hypertrie')

// Pass in hypercores from the SDK into other dat data structures
// Check out what you can do with hypertrie from there:
// https://github.com/mafintosh/hypertrie
const trie = hypertrie(null, {
  feed: new Hypercore('my trie core', {
    persist: false
  })
})

trie.put('key', 'value', () => {
  trie.get('key', (err, node) => {
    console.log('Got key: ', node.key)
    console.log('Loaded value from trie: ', node.value)
  })
})

```

## API

The API supports both promises and callbacks. Everywhere where you see `await`, you can instead pass a node-style callback.

### `const {Hypercore, Hyperdrive, resolveName, keyPair, deriveSecret, registerExtension, close} = await SDK(opts?)`

Creates an instance of the Dat SDK based on the options.

- `opts.applicationName`: An optional name for the application using the SDK. This will automatically silo your data from other applications using the SDK and will store it in the appropriate place using [random-access-application](https://github.com/RangerMauve/random-access-application/)
- `opts.persist: true`: An optional arg for whether data should be persisted. Set this to `false` if you want stuff stored in memory. Ignored if you pass in a custom storage or corestore.
- `opts.storage`: An optional [random-access-storage](https://github.com/random-access-storage/random-access-storage) instance for storing data.
- `opts.corestore`: An optional [Corestore](https://github.com/andrewosh/corestore) instance for using as hypercore storage.
- `opts.corestoreOpts`: Options to pass into Corestore when it's initialized.
- `opts.swarmOpts`: This lets you configure [hyperswarm](https://github.com/hyperswarm/hyperswarm) and [hyperswarm-web](https://github.com/RangerMauve/hyperswarm-web)
  - `maxPeers`: The maximum number of connections to keep for this swarm.
  - `ephemeral **Node**`: Set to `false` if this is going to be in a long running process on a server. 
  - `bootstap **Node**`: An array of addresses to use for the DHT bootstraping. Defaults to `['bootstrap1.hyperdht.org:49737', 'bootstrap2.hyperdht.org:49737', 'bootstrap3.hyperdht.org:49737']`
  - `preferredPort: 42666 **Node**`: The port hyperswarm should try to bind on. You should allow it through your firewall on TCP/UDP for best results. 
  - `webrtcBootstrap **Browser**: ['https://geut-webrtc-signal.herokuapp.com/'] **BROWSER**`: The WebRTC bootstrap server list used by [discovery-swarm-webrtc](https://github.com/geut/discovery-swarm-webrtc)
  - `wsProxy **Browser**: 'wss://hyperswarm.mauve.moe' **BROWSER**`: The Websocket proxy used for [hyperswarm-proxy-ws](https://github.com/RangerMauve/hyperswarm-proxy-ws)
- `opts.driveOpts`: This lets you configure the behavior of [Hyperdrive](https://github.com/mafintosh/hyperdrive) instances
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
- `opts.coreOpts`: This lets you configure the behavior of [Hypercore](https://github.com/mafintosh/hypercore) instances
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory feeds
  - `extensions`: The set of extension message types to use with this feed when replicating.
  - `valueEncoding: 'json' | 'utf-8' | 'binary'`: The encoding to use for the data stored in the hypercore. Use JSON to store / retrieve objects.
- `opts.dnsOpts`: Configure the [dat dns](https://github.com/datprotocol/dat-dns) resolution module. You probably shouldn't mess with this.
  - `recordName: 'dat'`: name of .well-known file
  - `protocolRegex: /^dat:\/\/([0-9a-f]{64})/i`: RegExp object for custom protocol
  - `hashRegex: /^[0-9a-f]{64}?$/i`: RegExp object for custom hash i.e.
  - `txtRegex: /"?datkey=([0-9a-f]{64})"?/i`: RegExp object for DNS TXT record of custom protocol

### `await close()`

This closes all resources used by the SDK so you can safely end your process. `cb` will be invoked once resources are closed or if there's an error.

### `const key = await resolveName(url)`

Resolve a DNS name to a Dat key.

  - `url` is a Dat URL like `dat://dat.foundation`
  - `key` will be the Dat key that you can pass to `hyperdrive`

### `const {publicKey, secretKey} = keyPair`

This gives you the public / private keypair used for the Noise protocol encryption when connecting to peers.
You can use this to identify peers in the network using `peer.remotePublicKey`

### `const secret = await deriveSecret(namespace, name)`

Derives a secret key based on the SDK's master key.
`namespace` can be used to namespace different applications, and `name` is the name of the key you want.
This can be used as a seed for generating secure private keys without needing to store an extra key on disk.

### `const extension = registerExtension(name, handlers)`

Listens on extension messages of type `name` on the feeds replication channels.

- `handlers.encoding`: The encoding to use for messages. `json`, `binary`, 'utf8'
- `handlers.onmessage(message, peer)`: Function to invoke when a peer sends you a message for this extension type.
- `handlers.onerror(err, peer)`: Function to invoke when a peer has sent you a mis-coded message on this extension.

You can respond to messages with `extension.send(message, peer)`.
You can also broadcast out messages to all peers with `extension.broadcast(message)`

### `const archive = Hyperdrive(keyOrName, opts)`

This initializes a Hyperdrive (aka a Dat archive), the SDK will begin finding peers for it and will de-duplicate calls to initializing the same archive more than once.

- `keyOrName`: This **must** be provided. It's either a Dat URL / key or a string identifying the name. If you want to have a writable archive, you can use the name to generate one and use the name later to get the same archive back without having to save the key somewhere.
- `opts`: These are the options for configuring the hyperdrive.
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `secretKey`: A secret key for granting write access. This can be useful when restoring backups.
	- `discoveryKey`: Optionally specify which discovery key you'd like to use for finding peers for this archive.
	- `lookup: true`: Specify whether you wish to lookup peers for this archive. Set `false` along with `announce` to avoid advertising
	- `announce: true`: Specify whether you wish to advertise yourself as having the archive.

The rest of the Hyperdrive docs were taken from the [Hyperdrive README](https://github.com/mafintosh/hyperdrive/blob/v9/README.md). Note that we're wrapping over the APIs with [Hyperdrive-Promise](https://github.com/geut/hyperdrive-promise) so any callback methods can be `await`ed instead.

#### `archive.version`

Get the current version of the archive (incrementing number).

#### `archive.key`

The public key identifying the archive.

#### `archive.discoveryKey`

A key derived from the public key that can be used to discovery other peers sharing this archive.

#### `archive.writable`

A boolean indicating whether the archive is writable.

#### `archive.on('ready')`

Emitted when the archive is fully ready and all properties has been populated.

#### `archive.on('update')`

Emitted when the archive has got a new change.

#### `archive.on('error', err)`

Emitted when a critical error during load happened.

#### `archive.on('close')`

Emitted when the archive has been closed

#### `archive.on('peer-add', peer)`

Emitted when a new peer has started replicating wiht the archive.

#### `archive.on('peer-remove', peer)`

Emitted when a peer has stopped replicating wit the archive.

#### `var oldDrive = archive.checkout(version, [opts])`

Checkout a readonly copy of the archive at an old version. Options are used to configure the `oldDrive`:

```js
{
  metadataStorageCacheSize: 65536 // how many entries to use in the metadata hypercore's LRU cache
  contentStorageCacheSize: 65536 // how many entries to use in the content hypercore's LRU cache
  treeCacheSize: 65536 // how many entries to use in the append-tree's LRU cache
}
```

#### `await archive.download([path])`

Download all files in path of current version.
If no path is specified this will download all files.

You can use this with `.checkout(version)` to download a specific version of the archive.

``` js
archive.checkout(version).download()
```

#### `await archive.clear(path)`

Clear the storage of all files in the path.
This is the opposite of the `download` API.
Note that this doesn't delete the files from history, just clears the data locally.

You can use this with `.checkout(version)` to clear a specific version of the archive.

#### `var stream = archive.history([options])`

Get a stream of all changes and their versions from this archive.

#### `var stream = archive.createReadStream(name, [options])`

Read a file out as a stream. Similar to fs.createReadStream.

Options include:

``` js
{
  start: optionalByteOffset, // similar to fs
  end: optionalInclusiveByteEndOffset, // similar to fs
  length: optionalByteLength
}
```

#### `const data = await archive.readFile(name, [options])`

Read an entire file into memory. Similar to fs.readFile.

Options can either be an object or a string

Options include:
```js
{
  encoding: string
  cached: true|false // default: false
}
```
or a string can be passed as options to simply set the encoding - similar to fs.

If `cached` is set to `true`, this function returns results only if they have already been downloaded.

#### `var stream = archive.createDiffStream(version, [options])`

Diff this archive with another version. `version` can both be a version number of a checkout instance of the archive. The `data` objects looks like this

``` js
{
  type: 'put' | 'del',
  name: '/some/path/name.txt',
  value: {
    // the stat object
  }
}
```

#### `var stream = archive.createWriteStream(name, [options])`

Write a file as a stream. Similar to fs.createWriteStream.
If `options.cached` is set to `true`, this function returns results only if they have already been downloaded.

#### `await archive.writeFile(name, buffer, [options])`

Write a file from a single buffer. Similar to fs.writeFile.

#### `await archive.unlink(name)`

Unlinks (deletes) a file. Similar to fs.unlink.

#### `await archive.mkdir(name, [options])`

Explictly create an directory. Similar to fs.mkdir

#### `await archive.rmdir(name)`

Delete an empty directory. Similar to fs.rmdir.

#### `const names = await archive.readdir(name, [options])`

Lists a directory. Similar to fs.readdir.

Options include:

``` js
{
    cached: true|false, // default: false
}
```

If `cached` is set to `true`, this function returns results from the local version of the archive’s append-tree. Default behavior is to fetch the latest remote version of the archive before returning list of directories.

#### `const stat = await archive.stat(name, [options])`

Stat an entry. Similar to fs.stat. Sample output:

```
Stat {
  dev: 0,
  nlink: 1,
  rdev: 0,
  blksize: 0,
  ino: 0,
  mode: 16877,
  uid: 0,
  gid: 0,
  size: 0,
  offset: 0,
  blocks: 0,
  atime: 2017-04-10T18:59:00.147Z,
  mtime: 2017-04-10T18:59:00.147Z,
  ctime: 2017-04-10T18:59:00.147Z,
  linkname: undefined }
```

The output object includes methods similar to fs.stat:

``` js
var stat = archive.stat('/hello.txt')
stat.isDirectory()
stat.isFile()
```

Options include:
```js
{
  cached: true|false // default: false,
  wait: true|false // default: true
}
```

If `cached` is set to `true`, this function returns results only if they have already been downloaded.

If `wait` is set to `true`, this function will wait for data to be downloaded. If false, will return an error.

#### `await archive.lstat(name, [options])`

Stat an entry but do not follow symlinks. Similar to fs.lstat.

Options include:
```js
{
  cached: true|false // default: false,
  wait: true|false // default: true
}
```

If `cached` is set to `true`, this function returns results only if they have already been downloaded.

If `wait` is set to `true`, this function will wait for data to be downloaded. If false, will return an error.

#### `await archive.access(name, [options])`

Similar to fs.access.

Options include:
```js
{
  cached: true|false // default: false,
  wait: true|false // default: true
}
```

If `cached` is set to `true`, this function returns results only if they have already been downloaded.

If `wait` is set to `true`, this function will wait for data to be downloaded. If false, will return an error.

#### `const fd = await archive.open(name, flags, [mode])`

Open a file and get a file descriptor back. Similar to fs.open.

Note that currently only read mode is supported in this API.

#### `await archive.read(fd, buf, offset, len, position)`

Read from a file descriptor into a buffer. Similar to fs.read.

#### `await archive.close(fd)`

Close a file. Similar to fs.close.

#### `await archive.close()`

Closes all open resources used by the archive.
The archive should no longer be used after calling this.
If you load this hyperdrive's key more than once at once, `close()` will be a noop until all handles invoke it.

#### `await archive.destroyStorage()`

Closes all resources used by the archive, and destroys its data from storage.
The archive should no longer be used after calling this.

### `const feed = Hypercore(keyOrName, opts)`

Initializes a Hypercore (aka Feed) and begins replicating it.

- `keyOrName`: This **must** be provided. It's either a Dat URL / key or a string identifying the name of the feed. If you want to have a writable feed, you can use the name to generate one and use the name later to get the same feed back without having to save the key somewhere.
- `opts`: The options for configuring this feed
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory feeds
  - `valueEncoding: 'json' | 'utf-8' | 'binary'`: The encoding to use for the data stored in the hypercore. Use JSON to store / retrieve objects.
  - `secretKey`: The secret key to use for the feed. Useful for restoring from backups.
	- `discoveryKey`: Optionally specify which discovery key you'd like to use for finding peers for this feed.
	- `lookup: true`: Specify whether you wish to lookup peers for this feed. Set to `false` along with `announce` to avoid advertising.
	- `announce: true`: Specify whether you wish to advertise yourself as having the feed.

#### `const seq = await feed.append(data)`

Append a block of data to the feed.

Callback is called with `(err, seq)` when all data has been written at the returned `seq` or an error occurred.

#### `const data = await feed.get(index, [options])`

Get a block of data.
If the data is not available locally this method will prioritize and wait for the data to be downloaded before calling the callback.

Options include

``` js
{
  wait: true, // wait for index to be downloaded
  timeout: 0, // wait at max some milliseconds (0 means no timeout)
  valueEncoding: 'json' | 'utf-8' | 'binary' // defaults to the feed's valueEncoding
}
```

Callback is called with `(err, data)`

#### `const results = await feed.getBatch(start, end, [options])`

Get a range of blocks efficiently. Options include

``` js
{
  wait: sameAsAbove,
  timeout: sameAsAbove,
  valueEncoding: sameAsAbove
}
```

#### `const data = await feed.head([options])`

Get the block of data at the tip of the feed. This will be the most recently
appended block.

Accepts the same `options` as `feed.get()`.

#### `await feed.download([range])`

Download a range of data. Callback is called when all data has been downloaded.
A range can have the following properties:

``` js
{
  start: startIndex,
  end: nonInclusiveEndIndex,
  linear: false // download range linearly and not randomly
}
```

If you do not mark a range the entire feed will be marked for download.

If you have not enabled sparse mode (`sparse: true` in the feed constructor) then the entire
feed will be marked for download for you when the feed is created.

#### `await feed.undownload(range)`

Cancel a previous download request.

#### `const signature = await feed.signature([index])`

Get a signature proving the correctness of the block at index, or the whole stream.

Callback is called with `(err, signature)`.
The signature has the following properties:
``` js
{
  index: lastSignedBlock,
  signature: Buffer
}
```

#### `const success = await feed.verify(index, signature)`

Verify a signature is correct for the data up to index, which must be the last signed
block associated with the signature.

Callback is called with `(err, success)` where success is true only if the signature is
correct.

#### `const roots = await feed.rootHashes(index)`

Retrieve the root *hashes* for given `index`.

Callback is called with `(err, roots)`; `roots` is an *Array* of *Node* objects:
```
Node {
  index: location in the merkle tree of this root
  size: total bytes in children of this root
  hash: hash of the children of this root (32-byte buffer)
}
```


#### `var number = feed.downloaded([start], [end])`

Returns total number of downloaded blocks within range.
If `end` is not specified it will default to the total number of blocks.
If `start` is not specified it will default to 0.

#### `var bool = feed.has(index)`

Return true if a data block is available locally.
False otherwise.

#### `var bool = feed.has(start, end)`
Return true if all data blocks within a range are available locally.
False otherwise.

#### `await feed.clear(start, [end])`

Clear a range of data from the local cache.
Will clear the data from the bitfield and make a call to the underlying storage provider to delete the byte range the range occupies.

`end` defaults to `start + 1`.

#### `feed.seek(byteOffset, callback)`

Seek to a byte offset.

Calls the callback with `(err, index, relativeOffset)`, where `index` is the data block the byteOffset is contained in and `relativeOffset` is
the relative byte offset in the data block.

#### `await feed.update([minLength])`

Wait for the feed to contain at least `minLength` elements.
If you do not provide `minLength` it will be set to current length + 1.

Does not download any data from peers except for a proof of the new feed length.

``` js
console.log('length is', feed.length)
feed.update(function () {
  console.log('length has increased', feed.length)
})
```

#### `var stream = feed.createReadStream([options])`

Create a readable stream of data.

Options include:

``` js
{
  start: 0, // read from this index
  end: feed.length, // read until this index
  snapshot: true, // if set to false it will update `end` to `feed.length` on every read
  tail: false, // sets `start` to `feed.length`
  live: false, // set to true to keep reading forever
  timeout: 0, // timeout for each data event (0 means no timeout)
  wait: true // wait for data to be downloaded
}
```

#### `var stream = feed.createWriteStream()`

Create a writable stream.

#### `await feed.close()`

Fully close this feed.
If you loaded this feed more than once, `close` will be a noop until all handles have invoked it.

Calls the callback with `(err)` when all storage has been closed.

#### `await feed.destroyStorage()`

Closes the feed and deletes all of it's data from storage.

#### `const {valid, invalid} = await feed.audit()`

Audit all data in the feed. Will check that all current data stored
matches the hashes in the merkle tree and clear the bitfield if not.

When done a report is passed to the callback that looks like this:

```js
{
  valid: 10, // how many data blocks matches the hashes
  invalid: 0, // how many did not
}
```

If a block does not match the hash it is cleared from the data bitfield.

#### `const extension = feed.registerExtension(name, handlers)`

Listens on extension messages of type `name` on the feeds replication channels.

- `handlers.encoding`: The encoding to use for messages. `json`, `binary`, 'utf8'
- `handlers.onmessage(message, peer)`: Function to invoke when a peer sends you a message for this extension type.
- `handlers.onerror(err, peer)`: Function to invoke when a peer has sent you a mis-coded message on this extension.

You can respond to messages with `extension.send(message, peer)`.
You can also broadcast out messages to all peers with `extension.broadcast(message)`

#### `feed.writable`

Can we append to this feed?

Populated after `ready` has been emitted. Will be `false` before the event.

#### `feed.readable`

Can we read from this feed? After closing a feed this will be false.

Populated after `ready` has been emitted. Will be `false` before the event.

#### `feed.key`

Buffer containing the public key identifying this feed.

Populated after `ready` has been emitted. Will be `null` before the event.

#### `feed.discoveryKey`

Buffer containing a key derived from the feed.key.
In contrast to `feed.key` this key does not allow you to verify the data but can be used to announce or look for peers that are sharing the same feed, without leaking the feed key.

Populated after `ready` has been emitted. Will be `null` before the event.

#### `feed.length`

How many blocks of data are available on this feed?

Populated after `ready` has been emitted. Will be `0` before the event.

#### `feed.byteLength`

How much data is available on this feed in bytes?

Populated after `ready` has been emitted. Will be `0` before the event.

#### `feed.stats`

Return per-peer and total upload/download counts.

The returned object is of the form:
```js
{
  totals: {
    uploadedBytes: 100,
    uploadedBlocks: 1,
    downloadedBytes: 0,
    downloadedBlocks: 0
  },
  peers: [
    {
      uploadedBytes: 100,
      uploadedBlocks: 1,
      downloadedBytes: 0,
      downloadedBlocks: 0
    },
    ...
  ]
}
```

Stats will be collected by default, but this can be disabled by setting `opts.stats` to false.

#### `feed.on('ready')`

Emitted when the feed is ready and all properties have been populated.

#### `feed.on('error', err)`

Emitted when the feed experiences a critical error.

#### `feed.on('download', index, data)`

Emitted when a data block has been downloaded.

#### `feed.on('upload', index, data)`

Emitted when a data block is uploaded.

#### `feed.on('append')`

Emitted when the feed has been appended to (i.e. has a new length / byteLength)

#### `feed.on('sync')`

Emitted every time ALL data from `0` to `feed.length` has been downloaded.

#### `feed.on('close')`

Emitted when the feed has been fully closed

#### `feed.on('peer-add', peer)`

Emitted when a new peer has started replicating with the feed.

#### `feed.on('peer-remove', peer)`

Emitted when a peer has stopped replicating with the feed.


---

[Dat Project]: https://dat.foundation
