const
  readline = require('readline')

const ask = question => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
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
