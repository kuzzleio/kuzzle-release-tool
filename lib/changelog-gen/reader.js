const
  https = require('https')
  , issueRegex = /(resolve[s|d]?|close[s|d]?|fixe?[s|d]?|fix?) (.*)\/?(.*)#([0-9]+)/g

const filterInfos = (id, infos) => {
  if (!infos) {
    return null
  }
  let labels = []

  if (infos.labels) {
    labels = infos.labels
      .map(e => e.name)
  }

  if (labels.length >= 0) {
    let m
      , issues = []

    while ((m = issueRegex.exec(infos.body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === issueRegex.lastIndex) {
        issueRegex.lastIndex++
      }

      issues.push({repo: m[2], id: m[4]})
    }

    return {
      labels
      , id
      , title: infos.title.charAt(0).toUpperCase() + infos.title.slice(1)
      , issues
      , url: infos.html_url
      , author: {
        login: infos.user.login
        , url: infos.user.html_url
      }
      , body: (labels.includes('changelog:complements') ? infos.body : null)
    }
  }
}


module.exports = {
  readFromGithub(owner, repo, id, ghToken) {
    return new Promise((resolve, reject) => {
      if (!id) {
        return resolve(null)
      }
      https.get({
        headers: {
          'user-agent': 'ci-changelog'
        }
        , host: 'api.github.com'
        , path: `/repos/${owner}/${repo}/issues/${id}?access_token=${ghToken}`
      }, response => {
        var str = ''

        response.on('data', chunk => {
          str += chunk
        })

        response.on('end', () => {
          const response = JSON.parse(str)

          if (response.message) {
            return reject(response.message)
          }
          resolve(filterInfos(id, response))
        })

      }).on('error', e => {
        reject(e)
      })
    })
  }
}
