const
  exec = require('../exec-promise')

module.exports = {
  getCurrent () {
    return exec(`cd .. && git branch | grep \\* | awk '{print $2}'`)
  }
}
