## Dream API

Based on existing Dat, but the swarming / storage is handled by the SDK.

Should work the same in Node/Browser/Beaker (once hypercore in Beaker lands)

```js
const SDK = require('@dat/sdk')

const  { Hyperdrive, Hypercore, Corestore } = new SDK()

// Hyperdrive is a high level data structure in Dat for dealing with filesystem
// It's great for sharing folders and data that can be represented as files
// P2P websites can be authored and loaded from Hyperdrives (Dat Archives)

// Create a new hyperdrive, default storage
// Swarming is handled by the SDK
// Storage handled by the SDK
var drive = new Hyperdrive()

// Load a hyperdrive from a Dat URL, handles DNS
var drive = new Hyperdrive('dat://whatever')

// Load a hyperdrive from a Dat Key buffer
var drive = new Hyperdrive(Buffer.from([420, 69, 6, 6, 6, ..etc ]))

// Load a hyperdrive from a folder
// If it's writable any changes you make to the folder will be saved to the drive
// If it's not writable, any changes loaded from the drive will be synced to the folder
// Will create a .dat file automatically if one doesn't exist
var drive = new Hyperdrive('./foobar')

var drive = new Hyperdrive(null, {
  // Similar options to what's inside hyperdrive already
  sparse: true,
  sparseMetadata: false,

  // Specify the extensions to use for replication
  // Passed into the corestore for the drive
  extensions: ['foobar']
})

// Broadcast an extenion message out
drive.extension('foobar', data)

// Listen on extension messages from peers
drive.on('extension', (type, message, peer) => {
  if(type !== 'foobar') return
  console.log('Got message', message)

  peer.extension('foobar', 'hello world', (err) => {
    console.log('Responded to', message)
  })
})

// List the peers for the Drive
// TODO: Document peers and provide minimal API for interaction / health
drive.peers()

// Use the regular hyperdrive API from here
// https://github.com/mafintosh/hyperdrive
drive.ready(function () {
  drive.readFile('/example.txt', 'utf8', function (err, data) {
    if(err) throw err
    console.log('Example contains', data)
  })
})

// Hypercore is the lower level data structure used in Dat, an append only log
// Each log can be identified by it's read key, and can be updated with a write key
// Hypercores can be used to create streams of events over time
// Hyperdrive is actually implemented by combining several hypercores together
// The Hypercore API is useful for managing a single Hypercore at a time
// If you want to create higher level data structures, use a Corestore

// Similar to hyperdrive, stuff is managed by the SDK
var core = new Hypercore()

// From a dat URl or key
var core = new Hypercore('dat://something')

// From a "name", useful for something like multifeed?
// TODO: Might be better left to the application?
var core = new Hypercore('myFeed')

var core = new Hypercore(null, {
  // Same as regular Hypercore
  valueEncoding: 'json' | 'utf-8' | 'binary',
  sparse: false,

  // Specify the extensions to use for replication
  // This one is used in multifeed
  extensions: ['MANIFEST', 'REQUEST_FEEDS']
})

// Send out extension messages
// Convert JSON to buffer automatically
// Example based on kappa-db multifeed
// https://github.com/kappa-db/multifeed/blob/master/mux.js
core.extension('REQUEST_FEEDS', [key1, key2])
core.on('extenion', (type, message, peer) => {
  peer.extension('MANIFEST', {
    keys: [key1, key2]
  })
})

// Same sort of peers object as in Hyperdrive
core.peers()

// Use the regular hypercore APIs from here
// https://github.com/mafintosh/hypercore
core.ready(function () {
  core.append({hello: 'world'})
})

// Corestore is a high level API for grouping multiple hypercores together
// It handles replicating them / tracking the list of cores
// Every corestore has a default core that's used for replication / advertising

// Create a new corestore
const store = new Corestore()

// Load an existing corestore
// TODO: How is this key fetched from the corestore in the first place?
const store = new Corestore(key)

// Get the corestore to generate a default hypercore
// This core's key will be used for replication
const defaultCore = store.default(null, {
  // Same as regular Hypercore
  valueEncoding: 'json' | 'utf-8' | 'binary',
  sparse: false,

  // Specify the extensions to use for replication, same as hypercore
  extensions: ['example']
})

// Set the default core to be a specific hypercore
const defaultCore = store.default('dat://somekey')

// Get another hypercore and auto-generate the key
// This core will be replicated over the same stream as the first one
// The other side will somehow need to learn about it's key in order to replicate
// You can either store the key inside the
const otherCore = store.get()

// Get a core with an existing key
// It'll be tracked with the rest of the cores and replicated through the default
const otherCore = store.get('dat://somekey')

class Peer {
  // Get buffer with peer's unique ID
  get id() {}

  // Send an extension message to this peer
  extension(type, data, cb) {}

  // This can be used to see which
  get bitfield() {}
  // TODO
}
```
