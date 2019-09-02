# sdk
The official Dat SDK

[<img src="https://datproject.github.io/design/downloads/dat-logo.png" align="right" width="140">][Dat Project]

## Why use this?

Dat consists of a bunch of low level building blocks for working with data in distributed applications. Although this modularity makes it easy to mix and match pieces, it adds complexity when it comes to actually building something.

The Dat SDK combines the lower level pieces of the Dat ecosystem into high level APIs that you can use across platforms so that you can focus on your application rather than the gritty details of how it works.

## Goals

- High level API
- Compatible with Beaker
- Cross-platform with same codebase
  - Node
  - Web (non-beaker)
  - Beaker
  - React-Native?
  - Electron?

## API/Examples (Promise)

```js
// Auto-detects sane defaults based on your environment
// Uses Beaker's APIs if they are if they are available
// DatArchive is the same as Beaker
// https://beakerbrowser.com/docs/apis/dat
const {DatArchive} = require('dat-sdk/auto')

const archive = await DatArchive.load('dat://dat.foundation')

const someData = await DatArchive.readFile('/dat.json', 'utf8')

console.log('Dat foundation dat.json:', someData)

const myArchive = await DatArchive.create({
  title: 'My Archive'
})

await myArchive.writeFile('/example.txt', 'Hello World!')
```

## API/Examples (Callbacks)

```js
const SDK = require('../')
const { Hypercore, Hyperdrive, resolveName, deleteStorage, destroy } = SDK()

const archive = Hyperdrive(null, {
  // This archive will disappear after the process exits
  // This is here so that running the example doesn't clog up your history
  persist: false,
  // storage can be set to an instance of `random-access-*`
  // otherwise it defaults to `random-access-web` in the browser
  // and `random-access-file` in node
  storage: null
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
  persist: false
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

## Roadmap

- [ ] Initial Callback API using hyperdiscovery / universal-dat-storage
  - [x] Draft API
  - [x] Implement API
    - [x] Hyperdrive
    - [x] Hypercore
    - [x] Extensions support (not released in master yet)
    - [x] dat-dns support
  - [x] Node.js compat (tests)
  - [x] Web compat (tests)
  - [x] Release v0.1.0
- [x] Update callback API based on feedback
  - [x] Better ability to work with folders
  - [x] Ability to close drives
  - [x] Check that hypercore replication is working
  - [x] Release v0.2.0
- [x] Initial Promise API / Beaker support
  - [x] Implement DatArchive API over CB based SDK
  - [x] Expose 'auto' module that automatically configures the SDK
  - [x] Release
- [ ] New Hyperdrive and Hyperswarm and Corestore
  - [ ] Add corestore for replication
  - [ ] virtual-corestore API
  - [ ] Use virtual Corestore for hyperdrive and hypercore and a new corestore API
  - [ ] Update discovery-swarm-web to use hyperswarm
  - [ ] Release
- [ ] Initial Beaker integration
  - [ ] [Wrap](https://github.com/RangerMauve/datarchive-to-hyperdrive) DatArchive with hyperdrive
  - [ ] Wrap resolveName API with Beaker APIs
  - [ ] Test that hypercore still works using web storage / proxying
  - [ ] Make sure tests work in Node / Web / Beaker
  - [ ] Release
- [ ] Promise API for new data types
  - [ ] Draft API (Hypercore, DNS, Corestore)
  - [ ] Create wrappers over Callback API
  - [ ] Auto-detect presence of Beaker APIs and use those
  - [ ] Release
- [ ] Demo reusing logic between Beaker and Node / etc (static site generator?)
- [ ] Integrate with Daemon
  - [ ] Corestore API
  - [ ] Wrap RPC client API in Callback API
  - [ ] Auto-spawn the daemon
  - [ ] Have web use existing implementation
  - [ ] Update Cabal with new Daemon-based code
  - [ ] Release
- [ ] Update API / Integration based on feedback
- [ ] V 1.0.0
- [ ] Higher level Peers API?
- [ ] Electron support with auto-spawning
- [ ] React-native support with node.js thread running daemon
- [ ] Web-Daemon

[Dat Project]: https://dat.foundation
