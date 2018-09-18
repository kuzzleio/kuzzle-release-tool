const
  readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      switch (answer.toLowerCase()) {
        case 'y':
        case '':
          rl.close();
          resolve(true);
          break;
        case 'n':
          rl.close();
          resolve(false);
          break;
        default:
          ask('Please type y or n: ');
          break;
      }
    });
  });
}

module.exports = ask;
