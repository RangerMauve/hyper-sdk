const SDK = require('./')
const test = require('tape')
const RAA = require('random-access-application')

const isBrowser = process.title === 'browser'

function getNewStorage () {
  if (isBrowser) {
    // Get a random number, use it for random-access-application
    const name = Math.random().toString()
    return RAA(name)
  } else {
    return require('tmp').dirSync({
      prefix: 'dat-sdk-tests-'
    }).name
  }
}

run()

async function run () {
  const { Hyperdrive, Hypercore, resolveName, close } = await SDK({
    storage: getNewStorage()
  })
  const { Hyperdrive: Hyperdrive2, Hypercore: Hypercore2, close: close2 } = await SDK({
    storage: getNewStorage()
  })

  const TEST_TIMEOUT = 60 * 1000

  const EXAMPLE_DNS_URL = 'dat://dat.foundation'
  const EXAMPLE_DNS_RESOLUTION = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

  test.onFinish(() => {
    close(() => {
      close2()
    })
  })

  test('Hyperdrive - create drive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const drive = Hyperdrive('Example drive 1')

    drive.writeFile('/example.txt', 'Hello World!', (err) => {
      t.notOk(err, 'Able to write to hyperdrive')

      t.end()
    })
  })

  test('Hyperdrive - get existing drive', (t) => {
    const drive = Hyperdrive('Example drive 2')

    drive.ready(() => {
      const existing = Hyperdrive(drive.key)

      t.equal(existing, drive, 'Got existing drive by reference')

      t.end()
    })
  })

  test('Hyperdrive - load drive over network', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const EXAMPLE_DATA = 'Hello World!'

    const drive1 = Hyperdrive2('Example drive 3')

    drive1.writeFile('/index.html', EXAMPLE_DATA, (err) => {
      t.notOk(err, 'wrote to initial archive')
      const drive = Hyperdrive(drive1.key)
      t.deepEqual(drive1.key, drive.key, 'loaded correct archive')
      drive.once('peer-add', () => {
        t.pass('Got peer for drive')
        drive.readFile('/index.html', 'utf8', (err, data) => {
          t.notOk(err, 'loaded file without error')
          t.equal(data, EXAMPLE_DATA)

          t.end()
        })
      })
    })
  })

  test('Hyperdrive - replicate in-memory drive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const EXAMPLE_DATA = 'Hello World!'

    const drive1 = Hyperdrive2('Example drive 4', { persist: false })

    drive1.writeFile('/index.html', EXAMPLE_DATA, (err) => {
      t.notOk(err, 'wrote to initial archive')
      const drive = Hyperdrive(drive1.key, { persist: false })
      t.deepEqual(drive1.key, drive.key, 'loaded correct archive')
      drive.once('peer-add', () => {
        drive.readFile('/index.html', 'utf8', (err, data) => {
          t.notOk(err, 'loaded file without error')
          t.equal(data, EXAMPLE_DATA)

          t.end()
        })
      })
    })
  })

  test('Hyperdrive - new drive created after close', (t) => {
    const drive = Hyperdrive('Example drive 5')

    drive.ready(() => {
      drive.close(() => {
        const existing = Hyperdrive(drive.key)

        t.notOk(existing === drive, 'Got new drive by reference')

        t.end()
      })
    })
  })

  test('resolveName - resolve and load archive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    resolveName(EXAMPLE_DNS_URL, (err, resolved) => {
      t.notOk(err, 'Resolved successfully')

      t.equal(resolved, EXAMPLE_DNS_RESOLUTION)
      t.end()
    })
  })

  test('Hypercore - create', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const core = Hypercore('Example hypercore 1')

    core.append('Hello World', (err) => {
      t.notOk(err, 'able to write to hypercore')

      t.end()
    })
  })

  test('Hypercore - load from network', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(3)

    const core1 = Hypercore('Example hypercore 2')

    core1.append('Hello World', () => {
      const core2 = Hypercore2(core1.key)

      t.deepEqual(core2.key, core1.key, 'loaded key correctly')

      core2.once('peer-add', () => {
        core2.get(0, (err, data) => {
          t.notOk(err, 'no error reading from core')
          t.ok(data, 'got data from replicated core')

          t.end()
        })
      })
    })
  })

  test('Hypercore - replicate in-memory cores', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(3)

    const core1 = Hypercore('Example hypercore 3', { persist: false })

    core1.append('Hello World', () => {
      const core2 = Hypercore2(core1.key, { persist: false })

      t.deepEqual(core2.key, core1.key, 'loaded key correctly')

      core2.once('peer-add', () => {
        core2.get(0, (err, data) => {
          t.notOk(err, 'no error reading from core')
          t.ok(data, 'got data from replicated core')
          t.end()
        })
      })
    })
  })

  test('Hypercore - only close when all handles are closed', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(5)

    const core1 = Hypercore('Example hypercore 4')
    const core2 = Hypercore('Example hypercore 4')

    core1.on('close', () => t.pass('close event emitted once'))

    t.ok(core1 === core2, 'Second handle is same instance')

    core1.append('Hello World', () => {
      core1.close(() => {
        t.pass('First core closed')
        core1.get(0, (err) => {
          t.notOk(err, 'Still able to read after close')
          core2.close(() => {
            t.pass('Second core closed')
          })
        })
      })
    })
  })
}
