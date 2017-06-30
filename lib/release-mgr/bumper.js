const fs = require('fs');

function bumpVersion (packageInfo, newVersion) {
  return new Promise((resolve, reject) => {
    let updatedContent;

    if (packageInfo.type === 'json') {
      packageInfo.content.version = newVersion;
      
      updatedContent = JSON.stringify(packageInfo.content, null, 2);
    }
    else {
      // for now we only handle gradle files
      // (packageInfo.type === 'gradle')
      // Other package types might be added later
      updatedContent = packageInfo.content.replace(
        /\n\s*version\s*=\s*\".*?\"\s*\n/, 
        `\nversion = "${newVersion}"\n`
      );
    }

    fs.writeFile(packageInfo.path, updatedContent, err => {
      if (err) {
        return reject(err);
      }
      
      resolve();
    });
  });
}

module.exports = bumpVersion;
