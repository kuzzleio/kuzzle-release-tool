* [Create the release PR](#create-the-release-pr)
* [Publish a release on github](#publish-a-release-on-github)
* [Create snapshot on DigitalOcean](#create-snapshot-on-digitalocean)

# Create the release PR

Tool to auto generate a changelog from 2 branches of any repository and auto release it on github

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
| --no-cleanup   | Do not delete created branches if error
| --project-path | Specify where is the project to release

## Usage example

```
    $ npm i
    $ node release.js --from 2.X --to master --tag 2.1.0 --output ../CHANGELOG.md --gh-token <Your github token> --project-path ~/Projects/kuzzle
    $ cat CHANGELOG.md
```

### [2.1.0](https://github.com/kuzzleio/kuzzle-backoffice/releases/tag/2.1.0) (2017-03-17)

[Full Changelog](https://github.com/kuzzleio/kuzzle-backoffice/compare/2.0.1...2.1.0)

#### Enhancements

- [ [#234](https://github.com/kuzzleio/kuzzle-backoffice/pull/234) ] Modified update documents page, now replace document if exist, create it if not   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#227](https://github.com/kuzzleio/kuzzle-backoffice/pull/227) ] Allows ssl connections to Kuzzle   ([benoitvidis](https://github.com/benoitvidis))

#### Bug fixes

- [ [#231](https://github.com/kuzzleio/kuzzle-backoffice/pull/231) ] Fix delete environment button on login form  resolve [#222](https://github.com/repos/kuzzleio/kuzzle-backoffice/issues/222) ([jenow](https://github.com/jenow))
- [ [#224](https://github.com/kuzzleio/kuzzle-backoffice/pull/224) ] Fixes the testing toolchain   ([xbill82](https://github.com/xbill82))
- [ [#229](https://github.com/kuzzleio/kuzzle-backoffice/pull/229) ] Fix item order in index tree   ([AnthonySendra](https://github.com/AnthonySendra))
- [ [#226](https://github.com/kuzzleio/kuzzle-backoffice/pull/226) ] Fix "reset" parameter format sent to Kuzzle on createFirstAdmin page  resolve [#225](https://github.com/repos/kuzzleio/kuzzle-backoffice/issues/225) ([ballinette](https://github.com/ballinette))
- [ [#221](https://github.com/kuzzleio/kuzzle-backoffice/pull/221) ] Enable backoffice connection to a backend with port < 1000  resolve [#220](https://github.com/repos/kuzzleio/kuzzle-backoffice/issues/220) ([ballinette](https://github.com/ballinette))

#### Others

- [ [#233](https://github.com/kuzzleio/kuzzle-backoffice/pull/233) ] Add end to end tests with testim   ([jenow](https://github.com/jenow))
- [ [#232](https://github.com/kuzzleio/kuzzle-backoffice/pull/232) ] Added unit tests   ([jenow](https://github.com/jenow))
- [ [#215](https://github.com/kuzzleio/kuzzle-backoffice/pull/215) ] Fix exposed port for Kuzzle backend in dev env: only 7512 is now used   ([ballinette](https://github.com/ballinette))
---

## Release process

This script follows the following steps to make a release:

- Check if you cloned the kuzzle-test-environment submodule
- Ask you for a review of the branch to release and compat.json
- Ask you for a review of the .travis.yml
- Create a new branch on the kuzzle-test-environment (x.y.z-proposal)
- Rewrite the .travis.yml according to the version configuration in compat.json
- Push the test branch
- Create proposal branch on the project to release
- Write the CHANGELOG
- Update version on package.json
- Commit and push the branch
- Create release request (PR)
- Add "release" label on the release request
- Add custom status of the kuzzle-test-environment travis job on the release request
- Stream travis log of kuzzle-test-environment
- Update custom status of the kuzzle-test-environment travis job on the release request

You must fill the compat.json to specify which version of kuzzle and proxy you want to test

# Publish a release on github

To publish a release on github run the publish.js script

```
    $ node publish.js --tag <the tag to release> --gh-token <your github token> --project-path ~/Projects/kuzzle
```

It will create a tag on github with the last changelog as body.

# Create snapshot on DigitalOcean

```
$ node digitalocean.js --token <your person digitalocean token> --version <kuzzle version>

```