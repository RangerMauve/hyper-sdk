# sdk
The official Dat SDK (WIP)

## Why use this?

Dat consists of a bunch of low level building blocks for working with data in distributed applications. Although this modularity makes it easy to mix and match pieces, it adds complexity when it comes to actually building something.

The Dat SDK combines the lower level pieces of the Dat ecosystem into high level APIs that you can use across platforms so that you can focus on your application rather than the gritty details of how it works.

## Goals

- High level API
- Compatible with Beaker
- Cross-platform with same codebase
  - Node
  - Beaker
  - Web (non-beaker)
  - React-Native?
- Easy to wrap with Node APIs for backwards-compat
- Initial implementation using DatArchive?

## API

```
const {Hypercore, Hyperdrive, resolveName } = require('@dat/sdk')
```

## Roadmap

- [ ] Initial Callback API using hyperdiscovery / universal-dat-storage
  - [x] Draft API
  - [ ] Implement API
    - [ ] Hyperdrive
    - [ ] Hypercore
    - [ ] Corestore
    - [ ] Extensions support
    - [ ] dat-dns support
  - [ ] Higher level Peers API?
  - [ ] Node.js compat (tests)
  - [ ] Web compat (tests)
  - [ ] Release V 0.1.0
- [ ] Integrate with Cabal as a demo
- [ ] Update callback API based on feedback
- [ ] Initial Promise API
  - [ ] Draft API (Hyperdrive, Hypercore, DNS, Corestore)
  - [ ] Create wrappers over Callback API
  - [ ] Auto-detect presence of Beaker APIs and use those
  - [ ] Release V 0.2.0
- [ ] Demo reusing logic between Beaker and Node / etc (static site generator?)
- [ ] Integrate with Daemon
  - [ ] Wrap RPC client API in Callback API
  - [ ] Auto-spawn the daemon
  - [ ] Have web use existing implementation
  - [ ] Update Cabal with new Daemon-based code
- [ ] Update API / Integration based on feedback
- [ ] V 1.0.0
- [ ] Electron support with auto-spawning
- [ ] React-native support with node.js thread running daemon
- [ ] Web-Daemon
