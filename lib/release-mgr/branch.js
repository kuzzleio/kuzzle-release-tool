const
  exec = require('../exec-promise')

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
  , delete (tag) {
    return exec(`cd .. && git branch | grep ${tag}-proposal`)
      .then(() => exec(`cd .. && (git push origin --delete ${tag}-proposal ; git checkout master ; git branch -D ${tag}-proposal)`))
      .catch(() => Promise.resolve())
  }
}
