const fs = require('fs');

const yaml = require('yaml');

const exec = require('../exec-promise');

async function bumpVersion (projectPath, packageInfo, newVersion) {
  let updatedContent = null;

  if (packageInfo.type === 'json') {
    // Node.js project => we need to update the package-lock.json file,
    // and then the version number with NPM
    if (packageInfo.name === 'package.json') {
      await exec(projectPath, [
        `npm version --allow-same-version --no-git-tag-version ${newVersion}`,
        `git push --set-upstream origin ${newVersion}-proposal`,
      ]);
    }
    else {
      packageInfo.content.version = newVersion;
      updatedContent = JSON.stringify(packageInfo.content, null, 2);
    }
  }
  else if (packageInfo.type === 'gradle') {
    updatedContent = packageInfo.content.replace(
      /\n\s*version\s*=\s*".*?"\s*\n/,
      `\nversion = "${newVersion}"\n`);
  }
  else if (packageInfo.type === 'nuget') {
    updatedContent = packageInfo.content.replace(
      `<version>${packageInfo.version}</version>`,
      `<version>${newVersion}</version>`);
  }
  else if (packageInfo.type === 'dart') {
    packageInfo.content.version = newVersion;
    updatedContent = yaml.stringify(packageInfo.content);
  }

  if (updatedContent !== null) {
    fs.writeFileSync(packageInfo.path, updatedContent);
  }
}

module.exports = bumpVersion;
