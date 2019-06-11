## Dream API

Based on existing Dat, but the swarming / storage is handled by the SDK.

Should work the same in Node/Browser/Beaker (once hypercore in Beaker lands)

```js
const { Hyperdrive, Hypercore } = require('@dat/sdk')

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
  sparseMetadata: true,

  // Can set the Dat URL to use for discovery, abstracts interaction with swarm
  // TODO: Bikeshed this name
  discovery: `dat://somekey`,

  // Specify the extensions to use for replication
  extensions: ['foobar']
})

// Broadcast an extenion message out
drive.extension('foobar', data)

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

// Similar to hyperdrive, stuff is managed by the SDK
var core = new Hypercore()

// From a dat URl or key
var core = new Hypercore('dat://something')

// From a "name", useful for something like multifeed?
// Might be better left to the application?
var core = new Hypercore('myFeed')

var core = new Hypercore(null, {
  // Same as regular Hypercore
  valueEncoding: 'json' | 'utf-8' | 'binary',
  sparse: false,

  // Can set the Dat URL to use for discovery, abstracts interaction with swarm
  // Can pass in buffers for keys derived from other protocols
  // TODO: Bikeshed this name
  discovery: Buffer.from('cabal://somekeyehere'.slice(8), 'hex'),

  // Specify the extensions to use for replication
  // This one is used in multifeed
  extensions: ['MANIFEST']
})

// Send out extension messages
// Convert JSON to buffer automatically
core.extension('MANIFEST', {keys: []})

// Same sort of peers object as in Hyperdrive
core.peers()

// Use the regular hypercore APIs from here
// https://github.com/mafintosh/hypercore
core.ready(function () {
  core.append({hello: 'world'})
})

class Peer {
  get id() {}
  get bitfield() {}
  extension(type, data, cb) {}
  // TODO
}
```
