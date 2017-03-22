const fs = require('fs')

module.exports = {
  bumpVersion: (version, jsonPackage, path = '../package.json') => {
    jsonPackage.version = version
    return new Promise((resolve, reject) => {
      fs.writeFile(path, JSON.stringify(jsonPackage, null, 2), (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
}
