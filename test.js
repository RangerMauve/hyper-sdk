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
  const { Hyperdrive, Hypercore, resolveName, destroy } = await SDK({
    storage: getNewStorage()
  })
  const { Hyperdrive: Hyperdrive2, Hypercore: Hypercore2, destroy: destroy2 } = await SDK({
    storage: getNewStorage()
  })

  const TEST_TIMEOUT = 10 * 1000

  const EXAMPLE_DNS_URL = 'dat://dat.foundation'
  const EXAMPLE_DNS_RESOLUTION = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

  test.onFinish(() => {
    destroy(() => {
      destroy2()
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

    const drive1 = Hyperdrive2('Example drive 3')

    drive1.ready(() => {
      drive1.writeFile('/index.html', 'Hello World!', () => {
        const drive = Hyperdrive(drive1.key)
        reallyReady(drive, () => {
          drive.readFile('/index.html', 'utf8', (err, data) => {
            t.notOk(err, 'loaded file without error')

            t.end()
          })
        })
      })
    })
  })

  test('Hyperdrive - new drive created after close', (t) => {
    const drive = Hyperdrive('Example drive 3')

    drive.ready(() => {
      drive.once('close', () => {
        const existing = Hyperdrive(drive.key)

        t.notEqual(existing, drive, 'Got new drive by reference')

        t.end()
      })
      drive.close()
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

    const core = Hypercore('Example hypercore 2')

    core.append('Hello World', () => {
      const core2 = Hypercore2(core.key)

      reallyReady(core2, () => {
        t.equal(core2.key.toString('hex'), core.key.toString('hex'), 'loaded key')
        core2.get(0, (err, data) => {
          t.notOk(err, 'no error reading from core')
          t.ok(data, 'got data from replicated core')

          t.end()
        })
      })
    })
  })
}

// This make sure you sync up with peers before trying to do anything with the archive
function reallyReady (driveOrFeed, cb) {
  driveOrFeed.ready(() => {
    const feed = driveOrFeed.metadata ? driveOrFeed.metadata : driveOrFeed
    if (feed.peers.length) {
      feed.update({ ifAvailable: true }, cb)
    } else {
      feed.once('peer-add', () => {
        feed.update({ ifAvailable: true }, cb)
      })
    }
  })
}
