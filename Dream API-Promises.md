## Dream API

Based on Beaker's upcoming [APIs](https://hackmd.io/7U2Tydh0QVGdk2JYDVYMmA)

This is going to be fleshed out after the Callback-style API is ready.

```js
const { Hyperdrive, Hypercore, PeerSockets, DNS } = require('@dat/sdk')

// Cr
var d = new Hyperdrive(url)
var d = await Hyperdrive.load(url)
var d = await Hyperdrive.create(opts)

// The `dat://` URL for the drive
d.url

// Set the timeout for various operations
// How long to wait to read a file before erroring out
await d.setTimeout(ms)
const ms = await d.getTimeout()

// Get info about
const stat = d.stat(path)

const {size, blocks, downloaded, mtime, ctime} = stat
const isDirectory = stat.isDirectory()
const isFile = stat.isFile()

// Used to set additional metadata for a given file
// Replaces dat.json file
// Kinda magical, so don't use it too much. :P
await d.configure(path, {
  title,
  description,
  type,
  // links,
  web: {
    root,
    fallbackPage
  },
})

// Mount another drive like a symlink in unix
await d.mount(path, drive)
await d.unmount(path)

await d.createDirectory(path)
await d.deleteDirectory(path, {recursive})
// Get the list of files / folders / mounts in a directory
await d.readDirectory(path, {recursive, stat})

await d.writeFile(path, data, {encoding, offset, length})
await d.readFile(path, {encoding, offset, length})
await d.deleteFile(path)

await d.copy(srcPath, dstUrl)
await d.move(srcPath, dstUrl)

for (let item of await d.history(pattern, {start, end, reverse})) {
  const {path, version, history} = item
}

// Add a new "tag" so that you can refer to this version of the drive
// using a human readable name instead of the machine-readable version number
await d.tag(tagName)
// List all the tags for the drive
await d.tags()

// Get a read-only instance of the drive that looks like it when the tag was made
// Can also use the machine-readable version number
await d.checkout(revisionOrTag)

// Watch for changes in the drive
var watcher = d.watch(pattern, onChanged)
watcher.addEventListener('changed', {path})

watcher.addEventListener('network-changed', ({peers}))
watcher.addEventListener('download', ({feed, block, bytes}))
watcher.addEventListener('upload', ({feed, block, bytes}))
watcher.addEventListener('sync', ({feed}))
```
