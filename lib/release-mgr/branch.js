const
  exec = require('../exec-promise')

module.exports = class Branch {
  constructor(tag) {
    this.tag = tag
  }

  getCurrent () {
    return exec(`cd .. && git branch | grep \\* | awk '{print $2}'`)
  }

  create () {
    return exec(`cd .. && git checkout -b ${this.tag}-proposal`)
  }

  push () {
    return exec(`cd .. && git commit -am "Release ${this.tag}" && git push origin ${this.tag}-proposal`)
  }

  delete () {
    return exec(`cd .. && git branch | grep ${this.tag}-proposal`)
      .then(() => exec(`cd .. && (git push origin --delete ${this.tag}-proposal ; git checkout master ; git branch -D ${this.tag}-proposal)`))
      .catch(() => Promise.resolve())
  }
}
