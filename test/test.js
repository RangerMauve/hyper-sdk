const test = require('tape')
const createNative = require('./lib/native')
const createHyperspace = require('./lib/hyperspace')
const createMixed = require('./lib/mixed')

let cleanups = []

async function cleanupTests () {
  console.log('# [test] cleaning up previous run')
  while (cleanups.length > 0) {
    await cleanups.shift()()
  }
}

function runOnFirstCall (init) {
  let result
  return () => {
    if (!result) {
      result = init()
    }
    return result
  }
}

test.onFinish(cleanupTests)
run(createNative, 'native')
run(createHyperspace, 'hyperspace')
run(createMixed, 'mixed')

function run (createTestSDKs, name) {
  const init = runOnFirstCall(async () => {
    await cleanupTests()
    console.log(`# [test/${name}] init start`)
    const { sdks, cleanup } = await createTestSDKs(2)
    const { Hyperdrive, Hypercore, resolveName, resolveURL, close } = sdks[0]
    const { Hyperdrive: Hyperdrive2, Hypercore: Hypercore2, close: close2 } = sdks[1]
    cleanups.push(async () => {
      await Promise.all([
        close(),
        close2()
      ])
      await cleanup()
    })
    console.log(`# [test/${name}] init end`)
    return {
      Hyperdrive,
      Hypercore,
      resolveName,
      resolveURL,
      Hyperdrive2,
      Hypercore2
    }
  })

  const TEST_TIMEOUT = 60 * 1000 * 2

  const EXAMPLE_DNS_DOMAIN = 'dns-test-setup.dat-ecosystem.org'
  const EXAMPLE_DNS_RESOLUTION = '000978b5589a5099aa3610a8ee550dcd454c3e33f4cac93b7d41b6b850cde000'

  test(name + ': Hyperdrive - create drive', async t => {
    t.timeoutAfter(TEST_TIMEOUT)
    const { Hyperdrive } = await init()

    const drive = Hyperdrive('Example drive 1')

    await drive.writeFile('/example.txt', 'Hello World!')
    t.pass('Able to write to hyperdrive')
  })

  test(name + ': Hyperdrive - get existing drive', async t => {
    const { Hyperdrive } = await init()

    const drive = Hyperdrive('Example drive 2')
    await drive.ready()

    const existing = Hyperdrive(drive.key)

    t.equal(existing, drive, 'Got existing drive by reference')
  })

  test(name + ': Hyperdrive - load drive over network', async t => {
    t.timeoutAfter(TEST_TIMEOUT)

    const EXAMPLE_DATA = 'Hello World!'

    const { Hyperdrive2, Hyperdrive } = await init()

    const drive1 = Hyperdrive2('Example drive 3')
    await drive1.writeFile('/index.html', EXAMPLE_DATA)
    const drive = Hyperdrive(drive1.key)
    t.deepEqual(drive1.key, drive.key, 'loaded correct drive')
    await new Promise(resolve => drive.once('peer-open', resolve))
    t.pass('Got peer for drive')
    t.equal(
      await drive.readFile('/index.html', 'utf8'),
      EXAMPLE_DATA
    )
  })

  test(name + ': Hyperdrive - new drive created after close', async t => {
    const { Hyperdrive } = await init()
    const drive = Hyperdrive('Example drive 5')

    await drive.ready()
    await drive.close()

    const existing = Hyperdrive(drive.key)

    t.notOk(existing === drive, 'Got new drive by reference')
  })

  test(name + ': resolveName - resolve names and urls', async t => {
    const { resolveName, resolveURL } = await init()
    t.equal(
      await resolveName(EXAMPLE_DNS_DOMAIN),
      EXAMPLE_DNS_RESOLUTION
    )
    t.equal(
      (await resolveURL(`hyper://${EXAMPLE_DNS_DOMAIN}/my/path`)).href,
      `hyper://${EXAMPLE_DNS_RESOLUTION}/my/path`
    )
  })

  test(name + ': Hypercore - create', async t => {
    t.timeoutAfter(TEST_TIMEOUT)

    const { Hypercore } = await init()
    const core = Hypercore('Example hypercore 1')
    await core.append('Hello World')
  })

  test(name + ': Hypercore - load from network', async t => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(2)

    const { Hypercore, Hypercore2 } = await init()

    const core1 = Hypercore('Example hypercore 2')
    await core1.append('Hello World')
    const core2 = Hypercore2(core1.key)
    await core2.ready()
    t.deepEqual(core2.key, core1.key, 'loaded key correctly')
    await new Promise(resolve => core2.once('peer-open', resolve))
    t.ok(
      await core2.get(0),
      'got data from replicated core'
    )
  })

  test(name + ': Hypercore - only close when all handles are closed', async t => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(5)

    const { Hypercore } = await init()

    const core1 = Hypercore('Example hypercore 4')
    const core2 = Hypercore('Example hypercore 4')

    core1.once('close', () => t.pass('close event emitted once'))

    t.ok(core1 === core2, 'Second handle is same instance')

    await core1.append('Hello World')
    await core1.close()
    t.pass('First core closed')
    t.ok(
      await core1.get(0),
      'Still able to read after close'
    )
    await core2.close()
    t.pass('Second core closed')
  })
}
