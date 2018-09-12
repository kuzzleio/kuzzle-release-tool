const
  exec = require('../exec-promise');

module.exports = class Branch {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  create(tag) {
    return exec(`cd ${this.projectPath}; git branch ${tag}-proposal; git checkout ${tag}-proposal`);
  }

  push(tag) {
    return exec(`cd ${this.projectPath} && git commit -am "Release ${tag}" && git push origin ${tag}-proposal`);
  }

  delete(tag) {
    return exec(`cd ${this.projectPath} && git branch | grep ${tag}-proposal`)
      .then(() => exec(`cd .. && (git push origin --delete ${tag}-proposal ; git checkout master ; git branch -D ${tag}-proposal)`))
      .catch(() => Promise.resolve());
  }

  checkout(branch) {
    return exec(`cd ${this.projectPath} && git fetch && git checkout ${branch} -q && git pull -q`);
  }
};
