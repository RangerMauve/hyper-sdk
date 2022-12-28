import test from 'tape'
import { once } from 'events'
import { create } from './index.js'
import b4a from 'b4a'
import { withDir } from 'tmp-promise'

const NULL_KEY = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
const NULL_BUFFER = b4a.alloc(32, 0)
const NULL_HEX_KEY = NULL_BUFFER.toString('hex')
const NULL_URL = `hyper://${NULL_KEY}/`

test('Specify storage for sdk', async (t) => {
  await withDir(async (dir) => {
    const storage = dir.path
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

      t.equal(url1, url2, 'Loaded core has same key')

      const contents = await core2.get(0)

      t.deepEqual(contents.toString('utf8'), data, 'Got data back from disk')
    } finally {
      await sdk.close()
    }
  }, { unsafeCleanup: true })
})

test('Load hypercores by names and urls', async (t) => {
  const sdk = await create({ storage: false })
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
      t.equal(core.url, NULL_URL, 'Correct URL got loaded')
    }
  } finally {
    await sdk.close()
  }
})

test('Resolve DNS entries to keys', async (t) => {
  const expected = NULL_KEY

  const sdk = await create({ storage: false })

  try {
    const resolved = await sdk.resolveDNSToKey('example.mauve.moe')

    t.equal(resolved, expected, 'Resolved to correct key')
  } finally {
    await sdk.close()
  }
})

test('Resolve DNS in hyper URLs', async (t) => {
  const expected = NULL_KEY

  const sdk = await create({ storage: false })

  try {
    const core = await sdk.get('hyper://example.mauve.moe')

    t.equal(core.id, expected, 'Loaded correct core from DNSLink')
  } finally {
    await sdk.close()
  }
})

test.only('Load a core between two peers', async (t) => {
  t.timeoutAfter(30000)

  const sdk1 = await create({ storage: false })
  const sdk2 = await create({ storage: false })
  try {
    t.comment('Initializing core on first peer')

    const core1 = await sdk1.get('example')
    await core1.append('Hello World!')

    t.comment('Loading core on second peer')

    const core2 = await sdk2.get(core1.url)

    /* if (!core2.peers?.length) {
      throw new Error('Unable to find peer')
    } */

    t.equal(core2.url, core1.url, 'Got expected URL')
    t.equal(core2.length, 1, 'Not empty')

    const data = await core2.get(0)
    t.deepEqual(data, Buffer.from('Hello World!'), 'Got block back out')
  } finally {
    await Promise.all([
      sdk1.close(),
      sdk2.close()
    ])
  }
})

test('Connect directly between two peers', async (t) => {
  t.timeoutAfter(30000)

  const sdk1 = await create({ storage: false })
  const sdk2 = await create({ storage: false })

  const onPeer = once(sdk2, 'peer-add')
  const onPeernt = once(sdk2, 'peer-remove')
  try {
    await sdk1.joinPeer(sdk2.publicKey)

    const [peerInfo] = await onPeer

    t.deepEquals(peerInfo.publicKey, sdk1.publicKey, 'Connected to peer')
  } finally {
    await Promise.all([
      sdk1.close(),
      sdk2.close()
    ])
  }

  await onPeernt

  t.pass('Peer remove event detected')
})

// test('', async (t) => {})

function delay(time = 1000) {
  return new Promise((resolve) => setTimeout(resolve, time))
}
