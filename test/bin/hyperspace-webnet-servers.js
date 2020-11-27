const tmp = require('tmp-promise')
const dht = require('@hyperswarm/dht')
const HyperspaceServer = require('hyperspace/server')
const webnet = require('webnet')

const n = parseInt(process.argv[2]) || 2
main(n).catch(console.error)

async function main (n) {
  const { cleanup } = await createMany(n)
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)
}

async function createOne (opts = {}) {
  const tmpDir = opts.dir || await tmp.dir({ prefix: 'dat-sdk-hyperspace', unsafeCleanup: true })
  const webnetServer = webnet.createServer()
  webnetServer.on('listening', () => {
    console.log(`Hyperspace server listening on ws://localhost:${opts.port}`)
  })
  const server = new HyperspaceServer({
    ...opts,
    server: webnetServer,
    storage: tmpDir.path,
    network: {
      bootstrap: opts.bootstrap || false,
      preferredPort: 0
    },
    noMigrate: true
  })
  server.on('client-open', () => {
    console.log('client session opened')
  })
  await server.ready()

  const cleanup = async () => {
    await server.close()
    await tmpDir.cleanup()
  }

  return { server, cleanup, dir: tmpDir }
}

async function createMany (numDaemons, opts) {
  const cleanups = []
  const clients = []
  const servers = []
  const dirs = []

  const bootstrapper = dht({
    bootstrap: false
  })
  bootstrapper.listen()
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })
  const bootstrapPort = bootstrapper.address().port
  const bootstrapOpt = [`localhost:${bootstrapPort}}`]

  for (let i = 0; i < numDaemons; i++) {
    const serverOpts = opts ? Array.isArray(opts) ? opts[i] : opts : null
    const { server, client, cleanup, dir } = await createOne({
      ...serverOpts,
      bootstrap: bootstrapOpt,
      port: 9000 + i
    })
    cleanups.push(cleanup)
    servers.push(server)
    clients.push(client)
    dirs.push(dir)
  }

  return { clients, servers, cleanup, dirs, bootstrapOpt }

  async function cleanup (opts) {
    for (const cleanupInstance of cleanups) {
      await cleanupInstance(opts)
    }
    await bootstrapper.destroy()
  }
}
