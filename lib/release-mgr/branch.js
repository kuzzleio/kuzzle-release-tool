const
  exec = require('../exec-promise');

module.exports = class Branch {
  constructor(projectPath, tag) {
    this.projectPath = projectPath;
    this.tag = tag;
  }

  create() {
    return exec([
      `cd ${this.projectPath}`,
      {command: `git branch ${this.tag}-proposal`, ignoreError: true},
      `git checkout ${this.tag}-proposal`]);
  }

  push() {
    return exec([
      `cd ${this.projectPath}`,
      `git commit -am "Release ${this.tag}"`,
      `git push origin ${this.tag}-proposal`]);
  }

  delete() {
    return exec([
      `cd ${this.projectPath}`,
      `git branch | grep ${this.tag}-proposal`])
      .then(() => exec([
        'cd ..',
        {command: `git push origin --delete ${this.tag}-proposal`, ignoreError: true},
        {command: 'git checkout master', ignoreError: true},
        {command: `git branch -D ${this.tag}-proposal`, ignoreError: true}]))
      .catch(() => Promise.resolve());
  }

  checkout(branch) {
    return exec([
      `cd ${this.projectPath}`,
      'git fetch',
      `git checkout ${branch} -q`,
      'git pull -q']);
  }
};
