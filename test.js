import test from 'tape'
import { once } from 'events'
import { create } from './index.js'
import b4a from 'b4a'

const NULL_KEY = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
const NULL_BUFFER = b4a.alloc(32, 0)
const NULL_HEX_KEY = NULL_BUFFER.toString('hex')
const NULL_URL = `hyper://${NULL_KEY}/`

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

test('Connect directly between two peers', async (t) => {
  t.timeoutAfter(10000)

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
