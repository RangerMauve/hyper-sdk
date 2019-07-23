const SDK = require('./')
const { Hypercore, Hyperdrive, resolveName, destroy } = SDK()

const archive = Hyperdrive()

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
  const archive = Hyperdrive(url)

  archive.readFile('/dat.json', 'utf8', (err, data) => {
    console.log(`Beaker's dat.json is ${data}`)
  })
})

const SOME_URL = 'dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/'

const someArchive = Hyperdrive(SOME_URL)

reallyReady(someArchive, () => {
  someArchive.readdir('/', console.log)
})

function reallyReady(archive, cb) {
  let wasReady = false
  archive.once('update', tryReady)
  archive.readdir('/', function(e) {
    if(e) return
    console.log('Already loaded metadata?')
    wasReady = true
    cb()
  })

  function tryReady() {
    if(wasReady) return
    console.log('Got an append event so it must be loaded')
    wasReady = true
    cb()
  }
}


// Create a hypercore
// Check out the hypercore docs for what you can do with it
// https://github.com/mafintosh/hypercore
const myCore = Hypercore(null, {
  valueEncoding: 'json'
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
    const otherCore = new Hypercore(message, {
      valueEncoding: 'json'
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
  feed: new Hypercore()
})

trie.put('key', 'value', () => {
  trie.get('key', (value) => {
    console.log('Loaded value from trie:', value)
  })
})
