const
  exec = require('child_process').exec

module.exports = {
  getCurrent () {
    return new Promise((resolve, reject) => {
      exec(`cd .. && git branch | grep \\* | awk '{print $2}'`, (error, stdout, stderr) => {
        if (error) {
          return reject(error)
        }
        if (stderr) {
          return reject(stderr)
        }
        resolve(stdout)
      })
    })
  },
  create (tag, suffix = '') {
    exec(`cd .. && git checkout -b ${tag}-proposal${suffix}`, (error, stdout, stderr) => {
      if (error) {
        console.error(error)
        return
      }
      if (stderr) {
        console.error(stderr)
        return
      }
    })
  }
}