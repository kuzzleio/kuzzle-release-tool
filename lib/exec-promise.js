const
  exec = require('child_process').exec

module.exports = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(error)
      }
      if (stderr) {
        console.error(stderr)
      }
      resolve(stdout)
    })
  })
}
