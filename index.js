const path = require('path')
const SDK = require('./sdk')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const DEFAULT_APPLICATION_NAME = 'dat-sdk'

module.exports = async function createSDK (opts) {
  const backend = getBackend(opts)
  return SDK({ ...opts, backend })
}

function getBackend (opts) {
  if (!opts.applicationName) {
    opts.applicationName = DEFAULT_APPLICATION_NAME
  }
  if (opts.persist === undefined) opts.persist = true

  let { backend, hyperspaceClient } = opts
  if (!backend && hyperspaceClient) backend = 'hyperspace'
  if (!backend) backend = 'native'

  let createBackend
  if (backend === 'native') {
    createBackend = require('./native')
  } else if (backend === 'hyperspace') {
    createBackend = require('./hyperspace')
  } else if (typeof backend === 'function') {
    createBackend = backend
  } else {
    throw new Error('Invalid backend')
  }

  return createBackend
}
