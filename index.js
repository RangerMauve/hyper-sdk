import HyperSwarm from 'hyperswarm'
import Corestore from 'corestore'
import Hypercore from "hypercore"

// TODO: Base36 encoding/decoding for URLs instead of hex

export const HYPER_PROTOCOL_SCHEME = 'hyper://'
export const DEFAULT_DOH_PROVIDER = 'TODO'

// Monkey-patching Hypercore with first class URL support
Object.defineProperty(Hypercore.prototype, 'url', {
  get: function () {
    const keyHex = this.key.toString('hex')

    return HYPER_PROTOCOL_SCHEME + keyHex + '/'
  }
})

export class SDK {
  constructor ({
    swarm = throwMissing('swarm'),
    corestore = throwMissing('corestore'),
    dnsOverHTTPProvider = ,
    autoJoin = true
  }) {
    swarm.on('connection', (connection) => {
      this.replicate(connection)
    })
  }

  async get(nameOrKeyOrURL) {
    // If a buffer, pass to the key
    // If a URL, use the hostname as either a key or a DNS to resolve
    // If not a URL, try to decode to a key
    // if not a key, use as name to generate a hypercore

    // There shouldn't be a way to pass null

    // Await for core to be ready
    // Await for initial peer if not writable?
  }

  async namespace(name) {

  }

  async ready() {
    // Wait for the network to be configured?

  }

  async close() {
    // Close corestore, close hyperswarm
  }

  replicate (connection) {
    this.corestore.replicate(connection)
  }
}

export async function create (opts) {
  const swarm = new Hyperswarm(opts)
  const corestore = new Corestore(opts)

  const sdk = new SDK({

  })

  await sdk.ready()
}

function throwMissing (name) {
  throw new TypeError(`Missing parameter ${name}`)
}

function resolveDNSLink(domain, dnsOverHTTPProvider) {
  // Get DNSLink domain
  // Use fetch to get TXT records over HTTP
  // Look for one starting with /hyper/
  // Return parsed key
}
