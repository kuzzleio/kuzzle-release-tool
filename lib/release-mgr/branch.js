const
  exec = require('../exec-promise')
  , querystring = require('querystring')
  , config = require('../../config.json')

module.exports = {
  getCurrent () {
    return exec(`cd .. && git branch | grep \\* | awk '{print $2}'`)
  }
  , create (tag) {
    return exec(`cd .. && git checkout -b ${tag}-proposal`)
  }
  , push (tag) {
    return exec(`cd .. && git commit -am "Release ${tag}" && git push origin ${tag}-proposal`)
  }
}
