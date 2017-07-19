const
  exec = require('../exec-promise');

module.exports = class Branch {
  constructor(tag, projectPath) {
    this.tag = tag;
    this.projectPath = projectPath;
  }

  getCurrent() {
    return exec(`cd ${this.projectPath} && git branch | grep \\* | awk \'{print $2}\'`);
  }

  create() {
    return exec(`cd ${this.projectPath} && git checkout -b ${this.tag}-proposal`);
  }

  push() {
    return exec(`cd ${this.projectPath} && git add CHANGELOG.md && git commit -am "Release ${this.tag}" && git push origin ${this.tag}-proposal`);
  }

  delete() {
    return exec(`cd ${this.projectPath} && git branch | grep ${this.tag}-proposal`)
      .then(() => exec(`cd .. && (git push origin --delete ${this.tag}-proposal ; git checkout master ; git branch -D ${this.tag}-proposal)`))
      .catch(() => Promise.resolve());
  }
};
