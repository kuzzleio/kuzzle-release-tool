const
  readline = require('readline')
  , rl = readline.createInterface({
  input: process.stdin
  , output: process.stdout
})

module.exports = (question) => {
  return new Promise((resolve, reject) => {
    rl.question(question, answer => {
      switch (answer.toLowerCase()) {
        case 'y':
        case '':
          rl.close()
          return resolve()
          break
        case 'n':
          rl.close()
          return reject()
          break
        default:
          ask('Please type y or n: ')
          break
      }
    })
  })
}
