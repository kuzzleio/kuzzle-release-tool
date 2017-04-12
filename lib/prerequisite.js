const
  fs = require('fs')

module.exports = {
  hasTestEnv () {
    return new Promise((resolve, reject) => {
      fs.stat('./kuzzle-test-environment', (err) => {
        if (err) {
          return reject()
        }
        resolve()
      })
    })
  }
}
