const
  rp = require('request-promise'),
  config = require('../../config.json');

module.exports = class Publisher {
  constructor(owner, repo, tag, ghToken) {
    this.owner = owner;
    this.repo = repo;
    this.tag = tag;
    this.ghToken = ghToken;
  }

  publish(changelog, draft, prerelease) {
    return rp({
      method: 'POST',
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/releases?access_token=${this.ghToken}`,
      headers: {
        'user-agent': 'ci-changelog'
      },
      body: {
        target_commitish: 'master',
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
