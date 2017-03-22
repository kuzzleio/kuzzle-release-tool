const
  exec = require('child_process').exec

module.exports = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      if (error) {
        return reject(error)
      }
      resolve(stdout)
    })
  })
}
