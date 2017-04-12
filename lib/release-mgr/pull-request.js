const
  rp = require('request-promise')
  , config = require('../../config.json')

module.exports = {
  create (owner, repo, ghToken, tag, changelog) {
    console.log(owner, repo, tag)
    return rp({
      uri: `https://${config.github.api}/repos/${owner}/${repo}/pulls?access_token=${ghToken}`
      , method: 'POST'
      , headers: {
        'user-agent': 'ci-changelog'
      }
      , body: {
        title: `Release ${tag}`
        , head: `${tag}-proposal`
        , base: 'master'
        , body: changelog
      }
      , json: true
    })
  }
}
