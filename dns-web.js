
module.exports = () => {
  return {
    resolveName (...args) {
      const err = new Error('Cannot resolve in Browser')
      if (args.length === 1) {
        return Promise.reject(err)
      } else if (args.length === 2) {
        const cb = args[1]
        cb(err)
      } else if (args.length > 2) {
        const cb = args[2]
        cb(err)
      }
    },
    listCache () {
      return {}
    },
    flushCache () {
    }
  }
}
