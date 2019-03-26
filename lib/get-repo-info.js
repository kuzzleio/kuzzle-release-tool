const exec = require('./exec-promise');

/**
 * Gets the repository name and owner of a project
 *
 * @return {object}
 */
function getRepoInfo (projectPath) {
  return exec(projectPath, 'git remote get-url origin')
    .then(stdout => {
      const parsed = /^.*[/:](.*?)\/(.*?)\.git$/.exec(stdout.trim());

      if (parsed === null) {
        throw new Error(`Unable to parse the following GIT URL: ${stdout.trim()}\nMake sure the project git remote URL is set`);
      }

      return {owner: parsed[1], repo: parsed[2]};
    });
}

module.exports = getRepoInfo;
