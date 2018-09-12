const
  exec = require('../exec-promise');

module.exports = class Branch {
  constructor(projectPath, tag) {
    this.projectPath = projectPath;
    this.tag = tag;
  }

  create() {
    return exec(`cd ${this.projectPath}; git branch ${this.tag}-proposal; git checkout ${this.tag}-proposal`);
  }

  push() {
    return exec(`cd ${this.projectPath} && git commit -am "Release ${this.tag}" && git push origin ${this.tag}-proposal`);
  }

  delete() {
    return exec(`cd ${this.projectPath} && git branch | grep ${this.tag}-proposal`)
      .then(() => exec(`cd .. && (git push origin --delete ${this.tag}-proposal ; git checkout master ; git branch -D ${this.tag}-proposal)`))
      .catch(() => Promise.resolve());
  }

  checkout(branch) {
    return exec(`cd ${this.projectPath} && git fetch && git checkout ${branch} -q && git pull -q`);
  }
};
