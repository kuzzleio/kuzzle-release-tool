const exec = require('child_process').exec;

/**
 * Gets the repository name and owner of a project
 *
 * @return {object}
 */
function getRepoInfo (projectPath) {
  return new Promise((resolve, reject) => {
    exec(`cd ${projectPath} && git remote get-url origin`, (error, stdout) => {
      if (error) {
        return reject(error);
      }

      const parsed = /^.*[/:](.*?)\/(.*?)\.git$/.exec(stdout.trim());

      if (parsed === null) {
        return reject(new Error(`Unable to parse the following GIT URL: ${stdout.trim()}\nMake sure the project git remote URL is set`));
      }

      resolve({owner: parsed[1], repo: parsed[2]});
    });
  });
}

module.exports = getRepoInfo;
