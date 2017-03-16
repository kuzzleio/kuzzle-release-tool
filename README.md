Tool to auto generate a changelog from 2 branches of any repository and auto release it on github (todo)

:warning: Release is not implemented yet

## Usage

Clone this repository in the repository you want to release.

| Options    | Description
|------------|----------------------------------------------------------------
| --help     | Show help
| --from     | The git tag you want to start the release from
| --to       | The git tag you want to stop the release to
| --tag      | Tag to release
| --dry-run  | Generate changelog but do not release
| --gh-token | Your github token
| --output   | Changelog file (stdout will be used if this option is not set)

## Exemple

```
    $ npm i
    $ node release.js --from master --to 2.x --tag 2.1.0 --dry-run --output CHANGELOG.md
    $ cat CHANGELOG.md
```

### [2.0.2](https://github.com/kuzzleio/kuzzle-backoffice/releases/tag/2.0.2) (2017-03-16)
    
[Full Changelog](https://github.com/kuzzleio/kuzzle-backoffice/compare/2.0.1...2.0.2)

#### Merged pull request

- Added unit tests [#232](https://github.com/kuzzleio/kuzzle-backoffice/pull/232)  [https://github.com/jenow](jenow)
- Fix delete environment button on login form [#231](https://github.com/kuzzleio/kuzzle-backoffice/pull/231) resolve [#222](https://github.com/repos/kuzzleio/kuzzle-backoffice/issues/222) [https://github.com/jenow](jenow)
- Unit tests are back! [#224](https://github.com/kuzzleio/kuzzle-backoffice/pull/224)  [https://github.com/xbill82](xbill82)
- Fix index tree [#229](https://github.com/kuzzleio/kuzzle-backoffice/pull/229)  [https://github.com/AnthonySendra](AnthonySendra)
- Allows ssl connections to Kuzzle [#227](https://github.com/kuzzleio/kuzzle-backoffice/pull/227)  [https://github.com/benoitvidis](benoitvidis)
- CreateFirstAdmin:  fix "reset" parameter format sent to Kuzzle [#226](https://github.com/kuzzleio/kuzzle-backoffice/pull/226) resolve [#225](https://github.com/repos/kuzzleio/kuzzle-backoffice/issues/225) [https://github.com/ballinette](ballinette)
- Fix #220 : enable connection to a port < 1000 [#221](https://github.com/kuzzleio/kuzzle-backoffice/pull/221) resolve [#220](https://github.com/repos/kuzzleio/kuzzle-backoffice/issues/220) [https://github.com/ballinette](ballinette)
- Fix exposed port fort Kuzzle backend: only 7512 is now used [#215](https://github.com/kuzzleio/kuzzle-backoffice/pull/215)  [https://github.com/ballinette](ballinette)
