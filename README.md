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
  - ✔ Web (non-beaker)
  - ✔ Beaker (Promise API acts as polyfill for Beaker)
  - React-Native?
  - Electron?


## Installing

[Node.js](https://nodejs.org/) / [Browserify](http://browserify.org/) workflows:

```shell
npm install --save dat-sdk
```

```js
const SDK = require('dat-sdk')
const SDKPromise = require('dat-sdk/promise')
const {DatArchive} = require('dat-sdk/auto')
```

Or Web Browsers

```html
<script src="https://bundle.run/dat-sdk@1"></script>
<script src="https://bundle.run/dat-sdk@1/promise.js"></script>
<script src="https://bundle.run/dat-sdk@1/auto.js"></script>
<script>
  const SDK = window.datSDK
  // Look at the examples from here
</script>
```


## Examples (Promise)

```js
// Auto-detects sane defaults based on your environment
// Uses Beaker's APIs if they are if they are available
// DatArchive is the same as Beaker
// https://beakerbrowser.com/docs/apis/dat
const {DatArchive} = require('dat-sdk/auto')

const archive = await DatArchive.load('dat://dat.foundation')

const someData = await archive.readFile('/dat.json', 'utf8')

console.log('Dat foundation dat.json:', someData)

const myArchive = await DatArchive.create({
  title: 'My Archive'
})

await myArchive.writeFile('/example.txt', 'Hello World!')

// Log the secret key in case you want to save it for later
console.log(await myArchive.getSecretKey())

// Use a saved secret key
await DatArchive.load(someKey, {
  secretKey: someSecretKey
})
```

## API/Examples (Callbacks)

```js
const SDK = require('dat-sdk')
const { Hypercore, Hyperdrive, resolveName, deleteStorage, destroy } = SDK()

const archive = Hyperdrive(null, {
  // This archive will disappear after the process exits
  // This is here so that running the example doesn't clog up your history
  persist: false,
  // storage can be set to an instance of `random-access-*`
  // const RAI = require('random-access-idb')
  // otherwise it defaults to `random-access-web` in the browser
  // and `random-access-file` in node
  storage: null  //storage: RAI
})

archive.ready(() => {
  const url = `dat://${archive.key.toString('hex')}`

  // TODO: Save this for later!
  console.log(`Here's your URL: ${url}`)

  // Check out the hyperdrive docs for what you can do with it
  // https://www.npmjs.com/package/hyperdrive#api
  archive.writeFile('/example.txt', 'Hello World!', () => {
    console.log('Written example file!')
  })
})

resolveName('dat://beakerbrowser.com', (err, url) => {
  if (err) throw err
  const archive = Hyperdrive(url)

  archive.readFile('/dat.json', 'utf8', (err, data) => {
    if (err) throw err
    console.log(`Beaker's dat.json is ${data}`)

    archive.close((err) => {
      if (err) throw err
      deleteStorage(archive.key, (e) => {
        if (e) throw e
        console.log('Deleted beaker storage')
      })
    })
  })
})

const SOME_URL = 'dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/'

const someArchive = Hyperdrive(SOME_URL)

reallyReady(someArchive, () => {
  someArchive.readdir('/', console.log)
})

// This make sure you sync up with peers before trying to do anything with the archive
function reallyReady (archive, cb) {
  if (archive.metadata.peers.length) {
    archive.metadata.update({ ifAvailable: true }, cb)
  } else {
    archive.metadata.once('peer-add', () => {
      archive.metadata.update({ ifAvailable: true }, cb)
    })
  }
}

// Create a hypercore
// Check out the hypercore docs for what you can do with it
// https://github.com/mafintosh/hypercore
const myCore = Hypercore(null, {
  valueEncoding: 'json',
  persist: false,
  // storage can be set to an instance of `random-access-*`
  // const RAI = require('random-access-idb')
  // otherwise it defaults to `random-access-web` in the browser
  // and `random-access-file` in node
  storage: null  // storage: RAI
})

// Add some data to it
myCore.append(JSON.stringify({
  name: 'Alice'
}), () => {
  // Use extension messages for sending extra data over the p2p connection
  const discoveryCoreKey = 'dat://bee80ff3a4ee5e727dc44197cb9d25bf8f19d50b0f3ad2984cfe5b7d14e75de7'
  const discoveryCore = new Hypercore(discoveryCoreKey, {
    extensions: ['discovery']
  })

  // When you find a new peer, tell them about your core
  discoveryCore.on('peer-add', (peer) => {
    console.log('Got a peer!')
    peer.extension('discovery', myCore.key)
  })

  // When a peer tells you about their core, load it
  discoveryCore.on('extension', (type, message) => {
    console.log('Got extension message', type, message)
    if (type !== 'discovery') return
    discoveryCore.close()

    const otherCore = new Hypercore(message, {
      valueEncoding: 'json',
      persist: false
    })

    // Render the peer's data from their core
    otherCore.get(0, console.log)
  })
})

const hypertrie = require('hypertrie')

// Pass in hypercores from the SDK into other dat data structures
// Check out what you can do with hypertrie from there:
// https://github.com/mafintosh/hypertrie
const trie = hypertrie(null, {
  feed: new Hypercore(null, {
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

## API (Promise)

### `const {DatArchive, destroy} = SDK({ storageOpts, swarmOpts, driveOpts, coreOpts, dnsOpts })`

This initializes the Dat SDK.


- `storageOpts`: This lets you configure how the SDK will store data. Used by the [universal-dat-storage](https://github.com/RangerMauve/universal-dat-storage) module.
  - `application: 'dat'`: The name of the application using the SDK if you want to have the data stored separately. Used by [env-paths](https://github.com/sindresorhus/env-paths#pathsdata) to generate the storageLocation
  - `storageLocation: null`: A location (on disk) to store the archives in.
- `swarmOpts`: This lets you configure [discovery-swarm](https://www.npmjs.com/package/discovery-swarm) and [discovery-swarm-web](https://www.npmjs.com/package/discovery-swarm-web)
  - `id`: The ID to use when doing p2p traffic
  - `maxConnections`: The maximum number of connections to keep for this swarm.
  - `extensions: []`: The set of extension messages to use when replicating with peers
  - `utp: true`: Whether to use utp in discovery-swarm
  - `tcp: true`: Whether to use tcp in discovery-swarm
  - `bootstrap: ['signal.mauve.moe']`: The WebRTC bootstrap server list used by discovery-swarm-web
  - `discovery: 'discoveryswarm.mauve.moe'`: The proxy server used by discovery-swarm-web
- `driveOpts`: This lets you configure the behavior of [Hyperdrive](https://github.com/mafintosh/hyperdrive) instances
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `extensions`: The set of extension message types to use with this archive when replicating.
- `coreOpts`: This lets you configure the behavior of [Hypercore](https://github.com/mafintosh/hypercore) instances
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory feeds
  - `extensions`: The set of extension message types to use with this feed when replicating.
  - `valueEncoding: 'json' | 'utf-8' | 'binary'`: The encoding to use for the data stored in the hypercore. Use JSON to store / retrieve objects.
- `dnsOpts`: Configure the [dat dns](https://github.com/datprotocol/dat-dns) resolution module. You probably shouldn't mess with this.
  - `recordName: 'dat'`: name of .well-known file
  - `protocolRegex: /^dat:\/\/([0-9a-f]{64})/i`: RegExp object for custom protocol
  - `hashRegex: /^[0-9a-f]{64}?$/i`: RegExp object for custom hash i.e.
  - `txtRegex: /"?datkey=([0-9a-f]{64})"?/i`: RegExp object for DNS TXT record of custom protocol

### `await destroy()`

Release all resources being used by the SDK so you can safely stop your process.

### `const archive = await DatArchive.load(location, opts)`

This loads up a Dat Archive for the given URL / Key / File path.

- `location`: This is either the `dat://` URL (which might have a domain), a dat key, or a file path for your archive.
- `opts`: These are options for configuring this archive
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `secretkey`: The secret key to use for this archive to get write access

### `const archive = await DatArchive.create(opts)`

This creates a new Dat Archive.

- `opts` These are the options for the archive's metadata and it's properties
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `secretkey`: The secret key to use for this archive to get write access
  - `title`: The title of the archive
  - `description`: A brief description of what the archive contains
  - `type`: An array of strings for the type of archive this is. See the [manifest](https://beakerbrowser.com/docs/apis/manifest.html#type) docs for more info.

### `const archive = await DatArchive.fork(url, opts)`

Create a new archive based on the data within another archive

- `url` The URL of the archive to fork off of
- `opts` These options will be used in the new archive.
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `secretkey`: The secret key to use for this archive to get write access
  - `title`: The title of the archive
  - `description`: A brief description of what the archive contains
  - `type`: An array of strings for the type of archive this is. See the [manifest](https://beakerbrowser.com/docs/apis/manifest.html#type) docs for more info.

### `await DatArchive.unlink(url)`

Delete the storage for an archive.

- `url`: The URL of the archive to delete

### `const archive = await DatArchive.selectArchive()`

Prompt the user to select an archive from the ones they have created locally. The implementation is super hacky, so use with caution.

### `const url = await DatArchive.resolveName(url)`

Resolve a URL that uses dat-dns to the raw `dat://` url.

- `url`: The `dat://` URL with a domain to resolve

#### `const url = archive.url`

Get the URL for the given archive.

#### `const info = await archive.getInfo()`

Get metadata about the archive

- `info`: The metadata related to the archive.
  - `key`: string (the archive public key)
  - `url`: string (the archive URL)
  - `isOwner`: boolean (is the user the owner of this archive?)
  - `version`: number (the archive's current revision number)
  - `peers`: number (the number of active connections for the archive)
  - `mtime`: number (the walltime of the last received update; is reliable)
  - `size`: number (bytes, the size-on-disk of the archive)
  - `title`: string (the archive title)
  - `description`: string (the archive description)
  - `type`: array of strings (the archive's type identifiers)
  - `links`: object (top-level links to other resources)

#### `await archive.configure(configuration)`

Update the metadata about the archive.

- `configuration`: The metadata to update
  - `title` String. The title of the archive.
  - `description` String. The description of the archive.
  - `type` Array<String>. The archive’s type identifiers. Learn more.
  - `links` Object. Top-level links to other resources. Learn more.
  - `web_root` String. Path of the folder from which all web requests should be served.
  - `fallback_page` String. Path to a fallback page to serve instead of the default 404 page.

#### `const stat = await archive.stat(path)`

- `path`: The path to get stats about from the archive
- `stat.isDirectory()`: Check if the path is a directory
- `stat.isFile()`: Check if the path is a file
- `stat.size`: number (bytes)
- `stat.blocks`: number (number of data blocks in the metadata)
- `stat.downloaded`: number (number of blocks downloaded, if a remote archive)
- `stat.mtime`: Date (last modified time; not reliable)
- `stat.ctime`: Date (creation time; not reliable)`

#### `const data = await archive.readFile(path, opts)`

- `path` The path to the file you wish to read
- `opts.encoding`: The encoding to read the file with, can be one of `utf8`, `base64`, `hex`, and `binary`
- `data`: The entire contents of the file, either as a string, or an ArrayBuffer if you used the `binary` encoding.

#### `const list = await archive.readdir(path, opts)`

Lists the files and folders within a directory.

- `path`: The path to the directory you wish to read
- `opts`
  - `recursive`: Set to `true` to list subdirectories, too
  - `stat`: Get the `Stat` objects instead of names.
- `list`: Either a list of the file/folder names or a list of the Stat object for those items.

#### `await archive.writeFile(path, data, opts)`

Write a file to your archive.

- `path`: The location to write your file to.
- `data`: Either a string or ArrayBuffer for the data you wish to save
- `opts.encoding`: The encoding to use when writing. Must be one of `utf8`, `base64`, `hex`, or `binary`. Encoding will default to `utf8` for strings, and `binary` for ArrayBuffers.

#### `await archive.mkdir(path)`

Create a directory at the given path. Will fail if the parent directory doesn't exist.

- `path`: The path to the directory

#### `await archive.unlink(path)`

Delete the file at the given path.

- `path`: The path to the file

#### `await rmdir(path, opts)`

Deletes the directory at the given path.

- `path`: The path to the directory
- `opts.recursive`: Whether to delete subfolders / files.

#### `await archive.copy(path, dstPath)`

Copy a file from one location to another.

- `path`: The path to the file / directory to copy from.
- `dstPath`: The location the file/directory should be copied to

#### `await archive.rename(oldPath, newPath)`

Rename / move a file or directory.

- `oldPath`: The path of the file/directory to rename
- `newPath`: What the file/directory should be renamed to.

#### `const history = await archive.history({opts})`

List the history of all the changes in this archive.

- `opts`: The options for how to fetch the history of the archive
  - `start`: Where in the history to start reading
  - `end`: Where in the history to stop reading
  - `reverse`: Set to `true` to iterate through the history backwards
- `history`: An array of history items representing changes
  - `path`: Which file / directory got modified.
  - `version`: The version number the archive was at for this item
  - `type`: Either `put` for additions or `del` for deletions

#### `const olderArchive = archive.checkout(version)`

Get a view of the archive as it was at an earlier version.

- `version`: The integer representing the version you whish to look at. This correlates to the version in the history.

#### `await archive.download(path)`

Download the file or folder at the given path from the network. Use `/` to download the entire archive.

#### `const events = archive.watch(pattern, onInvalidated)`

```js
const events = archive.watch(['**/*.md'])
events.addEventListener('changed', ({path}) => console.log(path, 'changed!'))

events.close() // Stop listening for changes
```

Watch for changes in the archive.

- `pattern`: This can either be omitted to view all changes, or have an [anymatch](https://www.npmjs.com/package/anymatch) pattern to filter out just the changes you want.
- `onInvalidated`: You can optionally pass in this function to listen for changes instead of using an event listener.

#### `archive.addEventListener('network-changed', ({peers}) => void 0)`

Listen for changes in the number of peers connected to for the archive.

- `peers`: The number of connected peers

#### `archive.addEventListener('download', ({feed, block, bytes}) => void 0)`

Listen for download progress from the archive

- `feed`: The data feed the block was part of. Either `metadata` or `content`
- `block`: The index of the block downloaded
- `bytes`: The size of the block in bytes

#### `archive.addEventListener('upload', ({feed, block, bytes}) => void 0)`

Listen for upload progress from the archive.

- `feed`: The data feed the block was part of. Either `metadata` or `content`
- `block`: The index of the block uploaded
- `bytes`: The size of the block in bytes

#### `archive.addEventListener('sync', ({feed}) => void 0)`

Emitted when all known data has been downloaded

## API (Callbacks)

### `const {Hypercore, Hyperdrive, resolveName, deleteStorage, destroy} = SDK({ storageOpts, swarmOpts, driveOpts, coreOpts, dnsOpts })`

Creates an instance of the Dat SDK based on the options.

- `storageOpts`: This lets you configure how the SDK will store data. Used by the [universal-dat-storage](https://github.com/RangerMauve/universal-dat-storage) module.
  - `application: 'dat'`: The name of the application using the SDK if you want to have the data stored separately. Used by [env-paths](https://github.com/sindresorhus/env-paths#pathsdata) to generate the storageLocation
  - `storageLocation: null`: A location (on disk) to store the archives in.
- `swarmOpts`: This lets you configure [discovery-swarm](https://www.npmjs.com/package/discovery-swarm) and [discovery-swarm-web](https://www.npmjs.com/package/discovery-swarm-web)
  - `id`: The ID to use when doing p2p traffic
  - `maxConnections`: The maximum number of connections to keep for this swarm.
  - `extensions: []`: The set of extension messages to use when replicating with peers
  - `utp: true`: Whether to use utp in discovery-swarm
  - `tcp: true`: Whether to use tcp in discovery-swarm
  - `bootstrap: ['signal.mauve.moe']`: The WebRTC bootstrap server list used by discovery-swarm-web
  - `discovery: 'discoveryswarm.mauve.moe'`: The proxy server used by discovery-swarm-web
- `driveOpts`: This lets you configure the behavior of [Hyperdrive](https://github.com/mafintosh/hyperdrive) instances
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `extensions`: The set of extension message types to use with this archive when replicating.
- `coreOpts`: This lets you configure the behavior of [Hypercore](https://github.com/mafintosh/hypercore) instances
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory feeds
  - `extensions`: The set of extension message types to use with this feed when replicating.
  - `valueEncoding: 'json' | 'utf-8' | 'binary'`: The encoding to use for the data stored in the hypercore. Use JSON to store / retrieve objects.
- `dnsOpts`: Configure the [dat dns](https://github.com/datprotocol/dat-dns) resolution module. You probably shouldn't mess with this.
  - `recordName: 'dat'`: name of .well-known file
  - `protocolRegex: /^dat:\/\/([0-9a-f]{64})/i`: RegExp object for custom protocol
  - `hashRegex: /^[0-9a-f]{64}?$/i`: RegExp object for custom hash i.e.
  - `txtRegex: /"?datkey=([0-9a-f]{64})"?/i`: RegExp object for DNS TXT record of custom protocol

### `destroy(cb)`

This closes all resources used by the SDK so you can safely end your process. `cb` will be invoked once resources are closed or if there's an error.

### `resolveName(url, cb(err, key))`

Resolve a DNS name to a Dat key.

  - `url` is a Dat URL like `dat://dat.foundation`
  - `cb` will get invoked with the result of the resolve
  - `key` will be the Dat key that you can pass to `hyperdrive`
  - `err` will be any errors that happen during resolution

### `deleteStorage(key, cb)`

Delete the storage for a given archive or hypercore key.

- `key` should be the key for the hypercore or hyperdrive that should be deleted
- `cb` will be invoked after the deletion is over.

### `const archive = Hyperdrive(location, opts)`

This initializes a Hyperdrive (aka a Dat archive), the SDK will begin finding peers for it and will de-duplicate calls to initializing the same archive more than once.

- `location`: This **must** be provided. It's either a path for where the archive should be stored, or a Dat URL / key. If this is null, a new key will be generated.
- `opts`: These are the options for configuring the hyperdrive.
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory archives
  - `extensions`: The set of extension message types to use with this archive when replicating.
  - `secretKey`: A secret key for granting write access. This can be useful when restoring backups.

The rest of the Hyperdrive docs were taken from the [Hyperdrive README](https://github.com/mafintosh/hyperdrive/blob/v9/README.md)

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

#### `archive.on('extension', name, message, peer)`

Emitted when a peer sends you an extension message with `archive.extension()`.
You can respond with `peer.extension(name, message)`.

#### `var oldDrive = archive.checkout(version, [opts])`

Checkout a readonly copy of the archive at an old version. Options are used to configure the `oldDrive`:

```js
{
  metadataStorageCacheSize: 65536 // how many entries to use in the metadata hypercore's LRU cache
  contentStorageCacheSize: 65536 // how many entries to use in the content hypercore's LRU cache
  treeCacheSize: 65536 // how many entries to use in the append-tree's LRU cache
}
```

#### `archive.download([path], [callback])`

Download all files in path of current version.
If no path is specified this will download all files.

You can use this with `.checkout(version)` to download a specific version of the archive.

``` js
archive.checkout(version).download()
```

#### `var stream = archive.history([options])`

Get a stream of all changes and their versions from this archive.

#### `archive.extension(name, message)`

Send an extension message to connected peers. [Read more in the hypercore docs](https://github.com/mafintosh/hypercore#feedextensionname-message).

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

#### `archive.readFile(name, [options], callback)`

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

#### `archive.writeFile(name, buffer, [options], [callback])`

Write a file from a single buffer. Similar to fs.writeFile.

#### `archive.unlink(name, [callback])`

Unlinks (deletes) a file. Similar to fs.unlink.

#### `archive.mkdir(name, [options], [callback])`

Explictly create an directory. Similar to fs.mkdir

#### `archive.rmdir(name, [callback])`

Delete an empty directory. Similar to fs.rmdir.

#### `archive.readdir(name, [options], [callback])`

Lists a directory. Similar to fs.readdir.

Options include:

``` js
{
    cached: true|false, // default: false
}
```

If `cached` is set to `true`, this function returns results from the local version of the archive’s append-tree. Default behavior is to fetch the latest remote version of the archive before returning list of directories.

#### `archive.stat(name, [options], callback)`

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

#### `archive.lstat(name, [options], callback)`

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

#### `archive.access(name, [options], callback)`

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

#### `archive.open(name, flags, [mode], callback)`

Open a file and get a file descriptor back. Similar to fs.open.

Note that currently only read mode is supported in this API.

#### `archive.read(fd, buf, offset, len, position, callback)`

Read from a file descriptor into a buffer. Similar to fs.read.

#### `archive.close(fd, [callback])`

Close a file. Similar to fs.close.

#### `archive.close([callback])`

Closes all open resources used by the archive.
The archive should no longer be used after calling this.

### `const feed = Hypercore(key, opts)`

Initializes a Hypercore (aka Feed) and begins replicating it.

- `key`: This is the dat key for the feed, you can omit it if you want to create a new hypercore instance
- `opts`: The options for configuring this feed
  - `sparse: true`: Whether the history should be loaded on the fly instead of replicating the full history
  - `persist: true`: Whether the data should be persisted to storage. Set to false to create in-memory feeds
  - `extensions`: The set of extension message types to use with this feed when replicating.
  - `valueEncoding: 'json' | 'utf-8' | 'binary'`: The encoding to use for the data stored in the hypercore. Use JSON to store / retrieve objects.
  - `secretKey`: The secret key to use for the feed. Useful for restoring from backups.

#### `feed.append(data, [callback])`

Append a block of data to the feed.

Callback is called with `(err, seq)` when all data has been written at the returned `seq` or an error occurred.

#### `feed.get(index, [options], callback)`

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

#### `feed.getBatch(start, end, [options], callback)`

Get a range of blocks efficiently. Options include

``` js
{
  wait: sameAsAbove,
  timeout: sameAsAbove,
  valueEncoding: sameAsAbove
}
```

#### `feed.head([options], callback)`

Get the block of data at the tip of the feed. This will be the most recently
appended block.

Accepts the same `options` as `feed.get()`.

#### `feed.download([range], [callback])`

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

#### `feed.undownload(range)`

Cancel a previous download request.

#### `feed.signature([index], callback)`

Get a signature proving the correctness of the block at index, or the whole stream.

Callback is called with `(err, signature)`.
The signature has the following properties:
``` js
{
  index: lastSignedBlock,
  signature: Buffer
}
```

#### `feed.verify(index, signature, callback)`

Verify a signature is correct for the data up to index, which must be the last signed
block associated with the signature.

Callback is called with `(err, success)` where success is true only if the signature is
correct.

#### `feed.rootHashes(index, callback)`

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

#### `feed.clear(start, [end], [callback])`

Clear a range of data from the local cache.
Will clear the data from the bitfield and make a call to the underlying storage provider to delete the byte range the range occupies.

`end` defaults to `start + 1`.

#### `feed.seek(byteOffset, callback)`

Seek to a byte offset.

Calls the callback with `(err, index, relativeOffset)`, where `index` is the data block the byteOffset is contained in and `relativeOffset` is
the relative byte offset in the data block.

#### `feed.update([minLength], [callback])`

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

#### `feed.close([callback])`

Fully close this feed.

Calls the callback with `(err)` when all storage has been closed.

#### `feed.audit([callback])`

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

---

[Dat Project]: https://dat.foundation
