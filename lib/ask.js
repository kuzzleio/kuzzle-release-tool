const
  readline = require('readline')
  , rl = readline.createInterface({
  input: process.stdin
  , output: process.stdout
})

const ask = question => {
  return new Promise((resolve, reject) => {
    rl.question(question, answer => {
      switch (answer.toLowerCase()) {
        case 'y':
        case '':
          rl.close()
          resolve(answer)
          break;
        case 'n':
          rl.close()
          reject()
          break
        default:
          ask('Please type y or n: ')
          break
      }
    })
  })
}

module.exports = ask
