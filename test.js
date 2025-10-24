import { test, configure } from 'brittle'
import { once } from 'events'
import { create } from './index.js'
import b4a from 'b4a'
import tmp from 'test-tmp'

const NULL_KEY = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
const NULL_BUFFER = b4a.alloc(32, 0)
const NULL_HEX_KEY = NULL_BUFFER.toString('hex')
const NULL_URL = `hyper://${NULL_KEY}/`

// Close can take a while
const timeout = 120_000

configure({ timeout })

test('Specify storage for sdk', async (t) => {
  const storage = await tmp()
  const name = 'example'
  const data = 'Hello World!'
  let sdk = await create({ storage })
  let sdk2 = null

  try {
    try {
      sdk2 = await create({ storage })
      t.fail(new Error('Should not be able to load SDK over existing dir'))
    } catch {
      t.pass('Threw error when opening same storage path twice')
    } finally {
      if (sdk2) await sdk2.close()
    }

    const core1 = await sdk.get(name)
    const url1 = core1.url
    await core1.append(data)

    await sdk.close()

    sdk = await create({ storage })

    const core2 = await sdk.get(name)
    const url2 = core2.url

    t.is(url1, url2, 'Loaded core has same key')

    const contents = await core2.get(0)

    t.alike(contents.toString('utf8'), data, 'Got data back from disk')
  } finally {
    await sdk.close()
  }
})

test('Support storage reuse by default', async (t) => {
  const storage = await tmp()

  const sdk = await create({ storage })
  const core = await sdk.get('persist in memory')
  const key = core.key

  const data = b4a.from('beep')
  await core.append(data)
  await core.close()
  t.ok(core.closed, 'initial core was closed')

  const coreAgain = await sdk.get(key)
  t.alike(await coreAgain.get(0, { wait: false }), data, 'found persisted data')

  await sdk.close()
})

test('Load hypercores by names and urls', async (t) => {
  const storage = await tmp()

  const sdk = await create({ storage })
  const name = 'example'

  try {
    const core = await sdk.get(name)

    t.ok(core, 'Got core for name')

    const toTry = [
      NULL_KEY,
      NULL_BUFFER,
      NULL_HEX_KEY,
      `hyper://${NULL_KEY}`,
      `hyper://${NULL_HEX_KEY}`
    ]

    for (const key of toTry) {
      const core = await sdk.get(key)

      t.ok(core, `Got core for ${key}`)
      t.is(core.url, NULL_URL, 'Correct URL got loaded')
    }
  } finally {
    await sdk.close()
  }
})

test('Loading same key twice results in same core', async (t) => {
  const storage = await tmp()

  const sdk = await create({ storage })
  const name = 'example'

  try {
    const core1 = await sdk.get(name)
    const core2 = await sdk.get(core1.key)
    const core3 = await sdk.get(core1.url)
    t.is(core1, core2, 'Key loaded same core from memory')
    t.is(core1, core3, 'URL loaded same core from memory')

    const drive1 = await sdk.getDrive(name)
    const drive2 = await sdk.getDrive(drive1.key)
    const drive3 = await sdk.getDrive(drive1.url)
    t.is(drive1, drive2, 'Key loaded same drive from memory')
    t.is(drive1, drive3, 'URL loaded same drive from memory')

    const bee1 = await sdk.getBee(name)
    const bee2 = await sdk.getBee(bee1.key)
    const bee3 = await sdk.getBee(bee1.url)
    t.is(bee1, bee2, 'Key loaded same bee from memory')
    t.is(bee1, bee3, 'URL loaded same bee from memory')

    await core1.close()
    await drive1.close()
    const core4 = await sdk.get(name)
    t.not(core1, core4, 'New core after close')
    const drive4 = await sdk.getDrive(name)
    t.not(drive1, drive4, 'New drive after close')
    const bee4 = await sdk.getBee(name)
    t.not(bee1, bee4, 'New bee after close')
  } finally {
    await sdk.close()
  }
})

test('Resolve DNS entries to keys', async (t) => {
  const storage = await tmp()

  const expected = NULL_KEY

  const sdk = await create({ storage })

  try {
    const resolved = await sdk.resolveDNSToKey('example.mauve.moe')

    t.is(resolved, expected, 'Resolved to correct key')
  } finally {
    await sdk.close()
  }
})

test('Resolve DNS in hyper URLs', async (t) => {
  const storage = await tmp()

  const expected = NULL_KEY

  const sdk = await create({ storage })

  try {
    const core = await sdk.get('hyper://example.mauve.moe')

    t.is(core.id, expected, 'Loaded correct core from DNSLink')
  } finally {
    await sdk.close()
  }
})

test('Get hostname from cache when fetch fails', async (t) => {
  const storage = await tmp()

  const expected = NULL_KEY

  const fetch = globalThis.fetch || (await import('bare-fetch')).default

  let isFirst = true
  let hasFailed = false
  function testFetch (...args) {
    if (isFirst) {
      isFirst = false
      return fetch(...args)
    }
    hasFailed = true
    throw new Error('Simulated Network Fail')
  }

  let sdk = await create({ fetch: testFetch, storage })

  try {
    const resolved = await sdk.resolveDNSToKey('example.mauve.moe')

    t.is(resolved, expected, 'Resolved to correct key')

    await sdk.close()
    console.log('close')
    sdk = await create({ fetch: testFetch, storage })

    const resolved2 = await sdk.resolveDNSToKey('example.mauve.moe')

    t.is(resolved2, expected, 'Resolved to correct key, without network')
    t.is(hasFailed, true, 'Fetch was called and failed')
  } finally {
    await sdk.close()
  }
})

test('Load a core between two peers', async (t) => {
  const storage1 = await tmp()
  const storage2 = await tmp()

  const sdk1 = await create({ storage: storage1 })
  const sdk2 = await create({ storage: storage2 })
  try {
    t.comment('Initializing core on first peer')

    const core1 = await sdk1.get('example')
    await core1.append('Hello World!')

    t.comment('Loading core on second peer')

    const core2 = await sdk2.get(core1.url)

    t.ok(core2.peers?.length, 'Found peer')
    t.is(core2.url, core1.url, 'Got expected URL')
    t.is(core2.length, 1, 'Not empty')

    const data = await core2.get(0)
    t.alike(data, Buffer.from('Hello World!'), 'Got block back out')
  } finally {
    await Promise.all([
      sdk1.close(),
      sdk2.close()
    ])
  }
})

test('Connect directly between two peers', async (t) => {
  const storage1 = await tmp()
  const storage2 = await tmp()

  const sdk1 = await create({ storage: storage1 })
  const sdk2 = await create({ storage: storage2 })

  const onPeer = once(sdk2, 'peer-add')
  const onPeernt = once(sdk2, 'peer-remove')
  try {
    await sdk1.joinPeer(sdk2.publicKey)

    const [peerInfo] = await onPeer

    t.alike(peerInfo.publicKey, sdk1.publicKey, 'Connected to peer')
  } finally {
    await Promise.all([
      sdk1.close(),
      sdk2.close()
    ])
  }

  await onPeernt

  t.pass('Peer remove event detected')
})

test('Get a hyperdrive and share a file', async (t) => {
  const storage1 = await tmp()
  const storage2 = await tmp()

  const sdk1 = await create({ storage: storage1 })
  const sdk2 = await create({ storage: storage2 })

  try {
    const drive1 = await sdk1.getDrive('example')

    const ws = drive1.createWriteStream('/blob.txt')
    const onWrote = once(ws, 'close')

    ws.write('Hello, ')
    ws.write('world!')
    ws.end()

    await onWrote

    const drive2 = await sdk2.getDrive(drive1.url)

    t.is(drive2.url, drive1.url, 'Loaded drive has same URL')

    const rs = drive2.createReadStream('/blob.txt')

    let data = ''
    for await (const chunk of rs) {
      data += chunk.toString('utf8')
    }

    t.is(data, 'Hello, world!', 'Loaded expected data')
  } finally {
    await Promise.all([
      sdk1.close(),
      sdk2.close()
    ])
  }
})

test('Get a hyperbee and share a key value pair', async (t) => {
  const storage1 = await tmp()
  const storage2 = await tmp()

  const sdk1 = await create({ storage: storage1 })
  const sdk2 = await create({ storage: storage2 })

  try {
    const encodingOpts = { keyEncoding: 'utf8', valueEncoding: 'utf8' }
    const db1 = await sdk1.getBee('example', encodingOpts)

    await db1.put('hello', 'world')

    const db2 = await sdk2.getBee(db1.url, encodingOpts)
    t.is(db2.url, db1.url, 'Loaded bee has same URL')
    t.is(db2.version, db1.version, 'Loaded bee has same version')
    const { value } = await db2.get('hello')

    t.is(value, 'world', 'Got value for key')
  } finally {
    await Promise.all([
      sdk1.close(),
      sdk2.close()
    ])
  }
})

test('Load URL of created core is writable', async (t) => {
  const data = 'Hello World!'

  const storage = await tmp()

  const sdk = await create({ storage })

  try {
    const core = await sdk.get('example')
    t.is(core.writable, true)
    await core.append(data)
    const { url } = core
    await core.close()

    const reloadedCore = await sdk.get(url)
    t.not(reloadedCore, core, 'new core created')
    t.is(reloadedCore.url, url, 'same url')
    t.is(reloadedCore.writable, true, 'can still write')
    await t.execution(reloadedCore.append(data), 'able to write')
    t.is(reloadedCore.length, 2, 'both entries in length')
  } finally {
    await sdk.close()
  }
})

test.solo('Load URL of created core from disk is writable', async (t) => {
  const data = 'Hello World!'

  const storage = await tmp()

  let sdk = await create({ storage })

  try {
    const core = await sdk.get('example')
    t.is(core.writable, true)
    await core.append(data)
    const { url } = core
    await sdk.close()

    sdk = await create({ storage })

    const reloadedCore = await sdk.get(url)
    t.not(reloadedCore, core, 'new core created')
    t.is(reloadedCore.url, url, 'same url')
    t.is(reloadedCore.writable, true, 'can still write')
    await t.execution(reloadedCore.append(data), 'able to write')
    t.is(reloadedCore.length, 2, 'both entries in length')
  } finally {
    await sdk.close()
  }
})

// test('', async (t) => {})
