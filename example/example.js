const SDK = require('../')
// const SDK = require('dat-sdk')

run()

async function run () {
  const sdk = await SDK()
  const {
    Hypercore,
    Hyperdrive,
    resolveName,
    close // <-- Make sure to call this when you're done
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
    storage: null // storage: RAI
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
  const key = await resolveName('beakerbrowser.com')

  console.log('Resolved key', key)

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
    storage: null // storage: RAI
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
      console.log(err)
      console.log('Got key: ', node.key)
      console.log('Loaded value from trie: ', node.value)

      close(() => {
        console.log('closed.')
      })
    })
  })
}
