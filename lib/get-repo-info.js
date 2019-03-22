const exec = require('./exec-promise');

/**
 * Gets the repository name and owner of a project
 *
 * @return {object}
 */
async function getRepoInfo (projectPath) {
  const stdout = exec([`cd ${projectPath}`, 'git remote get-url origin']);

  const parsed = /^.*[/:](.*?)\/(.*?)\.git$/.exec(stdout.trim());

  if (parsed === null) {
    throw new Error(`Unable to parse the following GIT URL: ${stdout.trim()}
Make sure the project git remote URL is set`);
  }

  return {owner: parsed[1], repo: parsed[2]};
}

module.exports = getRepoInfo;
