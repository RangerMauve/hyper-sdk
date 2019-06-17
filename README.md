# sdk
The official Dat SDK (WIP)

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

## Roadmap

- [ ] Initial Callback API using hyperdiscovery / universal-dat-storage
  - [ ] Draft API
  - [ ] Implement API
  - [ ] Higher level Peers API?
  - [ ] Node.js compat
  - [ ] Web compat
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
  - [ ] Update Cabal with new Daemon-based code
- [ ] Update API / Integration based on feedback
- [ ] V 1.0.0
