const SDK = require('../promise')
const test = require('tape')

test('cross-swarm: create and load archive', async (t) => {
  const { DatArchive: DatArchive1, destroy: destroy1 } = SDK()
  const { DatArchive: DatArchive2, destroy: destroy2 } = SDK()

  const FILE_LOCATION = '/example.txt'
  const FILE_CONTENTS = 'Hello World!'

  try {
    const original = await DatArchive1.create({ persist: false })

    t.pass('created archive ' + original.url)

    await original.writeFile(FILE_LOCATION, FILE_CONTENTS)

    t.pass('wrote file')

    const copy = await DatArchive2.load(original.url, { persist: false })

    t.equal(original.url, copy.url, 'loaded correct archive')

    t.pass('loaded copy archive')

    const read = await copy.readFile(FILE_LOCATION, 'utf8')

    t.equal(read, FILE_CONTENTS, 'got file contents')

    t.end()
  } catch (e) {
    t.error(e)
  } finally {
    destroy1()
    destroy2()
  }
})
