const
  rp = require('request-promise'),
  config = require('../../config.json');

module.exports = class Publisher {
  constructor(owner, repo, tag, ghToken, targetBranch) {
    this.owner = owner;
    this.repo = repo;
    this.tag = tag;
    this.ghToken = ghToken;
    this.targetBranch = targetBranch;
  }

  publish(changelog, draft, prerelease) {
    return rp({
      method: 'POST',
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/releases`,
      headers: {
        'user-agent': 'ci-changelog',
        'authorization': `token ${this.ghToken}`,
      },
      body: {
        target_commitish: this.targetBranch,
        tag_name: this.tag,
        name: this.tag,
        body: changelog,
        draft,
        prerelease
      },
      json: true
    });
  }
};
