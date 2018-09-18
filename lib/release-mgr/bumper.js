const
  fs = require('fs'),
  exec = require('child_process').exec;

function bumpVersion (projectPath, packageInfo, newVersion) {
  return new Promise((resolve, reject) => {
    let updatedContent = null;

    if (packageInfo.type === 'json') {
      // Node.js project => we need to update the version number with NPM
      if (packageInfo.name === 'package.json') {
        return exec(`cd ${projectPath} && npm version --allow-same-version --no-git-tag-version ${newVersion} && git push`, error => {
          if (error) {
            return reject(error);
          }

          resolve();
        });
      }

      packageInfo.content.version = newVersion;
      updatedContent = JSON.stringify(packageInfo.content, null, 2);
    }
    else {
      // for now we only handle gradle files
      // (packageInfo.type === 'gradle')
      // Other package types might be added later
      updatedContent = packageInfo.content.replace(
        /\n\s*version\s*=\s*".*?"\s*\n/,
        `\nversion = "${newVersion}"\n`
      );
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
