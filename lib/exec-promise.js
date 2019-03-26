const
  { exec } = require('child_process'),
  Bluebird = require('bluebird');

/**
 * Execute one or multiple commands.
 * Each command can be either a string, or an object.
 * If an object is provided, it must follow this format:
 * {
 *   command: '<command to be executed>',
 *   ignoreError: <boolean (default: false)>
 * }
 *
 * Command strings are the same than the object above with the "ignoreError"
 * set to false.
 *
 * If an array is provided, then commands are executed one after the other.
 *
 * Usage:
 *   execPromise(cwd, 'command')
 *   execPromise(cwd, {command: 'command', ignoreError: true})
 *   execPromise(cwd, ['command1', 'command2', '...', 'commandn'])
 *   execPromise(cwd, ['command1', {command: 'command2', ignoreError: true}])
 *
 * @param {string} cwd - current working directory
 * @param  {Array.<String|Object>|String|Objet} command
 * @return {string} commands output (concatenated)
 */
function execPromise(cwd, command) {
  const list = Array.isArray(command) ? command : [ command ];
  let output = '';

  return Bluebird.each(list, item => {
    let
      cmd,
      ignoreError = false;

    if (typeof item === 'string') {
      cmd = item;
    } else {
      cmd = item.command;
      ignoreError = Boolean(item.ignoreError);
    }

    return new Promise((resolve, reject) => {
      exec(cmd, {cwd}, (error, stdout, stderr) => {
        if (!ignoreError) {
          if (stderr) {
            console.error(stderr);
          }

          if (error) {
            return reject(error);
          }
        }

        output += stdout;
        resolve();
      });
    });
  })
    .then(() => output);
}

module.exports = execPromise;
