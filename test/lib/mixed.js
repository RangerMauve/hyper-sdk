const createNative = require('./native')
const createHyperspace = require('./hyperspace')

module.exports = async function createMixed (n) {
  const nNative = Math.ceil(n / 2)
  const nHyperspace = n - nNative
  const native = await createNative(nNative)
  const hyperspace = await createHyperspace(nHyperspace)
  const sdks = []
  for (let i = 0; i < n; i++) {
    sdks.push(i % 2 === 0 ? native.sdks.shift() : hyperspace.sdks.shift())
  }
  return { sdks, cleanup }

  async function cleanup () {
    console.log('# [test/mixed] cleanup start (cleans up native and hyperspace)')
    await Promise.all([
      hyperspace.cleanup(),
      native.cleanup()
    ])
    console.log('# [test/mixed] cleanup end')
  }
}
