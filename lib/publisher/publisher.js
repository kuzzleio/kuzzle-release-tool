const
  rp = require('request-promise')
  , config = require('../../config.json')

module.exports = class Publisher {
  constructor(owner, repo, tag) {
    this.owner = owner
    this.repo = repo
    this.tag = tag
  }

  publish (changelog, draft, prerelease) {
    return rp({
      method: 'POST'
      , uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/releases?access_token=6a17512f313563d2ec8b5bb1ab9f98ec85e7ea4b`
      , headers: {
        'user-agent': 'ci-changelog'
      }
      , body: {
        target_commitish: 'master'
        , tag_name: this.tag
        , name: this.tag
        , body: changelog
        , draft
        , prerelease
      }
      , json: true
    })
  }
}
