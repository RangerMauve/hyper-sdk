const SDK = require('./')
const test = require('tape')
const tmp = require('tmp')

const storageLocation = tmp.dirSync({
  prefix: 'universal-dat-storage-'
}).name

const { Hyperdrive, Hypercore, resolveName, destroy } = SDK({
  storageOpts: {
    storageLocation
  }
})

const DATPROJECT_KEY = 'dat://60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

test.onFinish(destroy)

test('Hyperdrive - load drive', (t) => {
  const drive = Hyperdrive(DATPROJECT_KEY)

  drive.readFile('/dat.json', 'utf8', (err, data) => {
    t.notOk(err, 'loaded file without error')

    t.end()
  })
})

test('Hyperdrive - create drive', (t) => {
  const drive = Hyperdrive()

  drive.writeFile('/example.txt', 'Hello World!', (err) => {
    t.notOk(err, 'Able to write to hyperdrive')

    t.end()
  })
})

test('resolveName - resolve and load archive', (t) => {
  resolveName('dat://dat.foundation', (err, resolved) => {
    t.notOk(err, 'Resolved successfully')

    const drive = Hyperdrive(resolved)

    drive.readFile('/dat.json', 'utf8', (err2) => {
      t.notOk(err2, 'loaded file without error')

      t.end()
    })
  })
})

test('Hypercore - create', (t) => {
  const core = Hypercore()

  core.append('Hello World', (err) => {
    t.notOk(err, 'able to write to hypercore')

    t.end()
  })
})
