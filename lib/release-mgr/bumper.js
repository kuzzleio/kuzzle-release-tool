const
  fs = require('fs'),
  exec = require('../exec-promise');

function bumpVersion (projectPath, packageInfo, newVersion) {
  return new Promise((resolve, reject) => {
    let updatedContent = null;

    if (packageInfo.type === 'json') {
      // Node.js project => we need to update the package-lock.json file,
      // and then the version number with NPM
      if (packageInfo.name === 'package.json') {
        return exec(projectPath, [
          `npm version --allow-same-version --no-git-tag-version ${newVersion}`,
          `git push --set-upstream origin ${newVersion}-proposal`])
          .then(() => resolve())
          .catch(e => reject(e));
      }

      packageInfo.content.version = newVersion;
      updatedContent = JSON.stringify(packageInfo.content, null, 2);
    } else if (packageInfo.type === 'gradle') {
      updatedContent = packageInfo.content.replace(
        /\n\s*version\s*=\s*".*?"\s*\n/,
        `\nversion = "${newVersion}"\n`
      );
    } else if (packageInfo.type === 'nuget') {
      updatedContent = packageInfo.content.replace(
        `<version>${packageInfo.version}</version>`,
        `<version>${newVersion}</version>`);
    }

    if (updatedContent !== null) {
      fs.writeFile(packageInfo.path, updatedContent, err => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    }
  });
}

module.exports = bumpVersion;
