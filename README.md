# sdk
The official Dat SDK (WIP)

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

## API/Examples

```js
const {Hypercore, Hyperdrive, resolveName, destroy } = require('dat-sdk')

const archive = new Hyperdrive()

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
  const archive = new Hyperdrive(url)

  archive.readFile('/dat.json', 'utf8', (err, data) => {
    console.log(`Beaker's dat.json is ${data}`)
  })
})

// Create a hypercore
// Check out the hypercore docs for what you can do with it
// https://github.com/mafintosh/hypercore
const myCore = new Hypercore(null, {
  valueEncoding: 'json'
})

// Add some data to it
myCore.append({
  name: 'Alice'
}, () => {
  // Use extension messages for sending extra data over the p2p connection
  const discoveryCoreKey = 'dat://bee80ff3a4ee5e727dc44197cb9d25bf8f19d50b0f3ad2984cfe5b7d14e75de7'
  const discoveryCore = new Hypercore(discoveryCoreKey, {
    extensions: ['discovery']
  })

  // When you find a new peer, tell them about your core
  discoveryCore.on('peer-add', (peer) => {
    peer.extension('discovery', myCore.key)
  })

  // When a peer tells you about their core, load it
  discoveryCore.on('extension', (type, message) => {
    if(type !== 'discovery') return
    const otherCore = new Hypercore(message)

    // Render the peer's data from their core
    otherCore.get(0, console.log)
  })
})

const hypertrie = require('hypertrie')

// Pass in hypercores from the SDK into other dat data structures
// Check out what you can do with hypertrie from there:
// https://github.com/mafintosh/hypertrie
const trie = hypertrie(null, {
  feed: new Hypercore()
})

trie.put('key', 'value', () => {
  trie.get('key', (value) => {
    console.log('Loaded value from trie:', value)
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
- [ ] Initial Beaker integration
  - [ ] [Wrap](https://github.com/RangerMauve/datarchive-to-hyperdrive) DatArchive with hyperdrive
  - [ ] Wrap resolveName API with Beaker APIs
  - [ ] Test that hypercore still works using web storage / proxying
  - [ ] Make sure tests work in Node / Web / Beaker
  - Release v0.2.0
- [ ] Update callback API based on feedback
  - [ ] Figure out Corestore / debugging?
- [ ] Initial Promise API
  - [ ] Draft API (Hyperdrive, Hypercore, DNS, Corestore)
  - [ ] Create wrappers over Callback API
  - [ ] Auto-detect presence of Beaker APIs and use those
  - [ ] Release V 0.2.0
- [ ] Demo reusing logic between Beaker and Node / etc (static site generator?)
- [ ] Integrate with Daemon
  - [ ] Corestore API
  - [ ] Wrap RPC client API in Callback API
  - [ ] Auto-spawn the daemon
  - [ ] Have web use existing implementation
  - [ ] Update Cabal with new Daemon-based code
- [ ] Update API / Integration based on feedback
- [ ] V 1.0.0
- [ ] Higher level Peers API?
- [ ] Electron support with auto-spawning
- [ ] React-native support with node.js thread running daemon
- [ ] Web-Daemon
