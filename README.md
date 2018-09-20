Sets of tools allowing to:

* Detect projects needing to be release: [checkUpdate.js](#checkUpdatejs)
* Auto-generate changelog and prepare release pull request: [release.js](#releasejs)
* Creates a tag and its changelog on github: [publish.js](#publishjs)
* Deploying snapshot to the cloud: [via Docker](#deploying-to-the-cloud)

# checkUpdate.js

This script scans all the projects of a provided user and detects if the master branch is behind one or multiple development branches.

Development branches are branches whose names match the pattern set in the `devBranchPattern` property of the `config.json` file.

## Usage

| Options    | Required? | Description                                        |
|------------|----------------------------------------------------------------|
| --gh-token | yes | Your github token. Although no github operation require rights, this script needs to be authenticated because of [Github API rate limits](https://developer.github.com/v3/rate_limit/) |
| --user | yes | The name of the github repository |
| --help     | no | Show help |


# release.js

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

## Usage

| Options    | Required? | Description                                        |
|------------|----------------------------------------------------------------|
| --from     | yes | The git tag / branch you want to start the release from |
| --to       | yes | The git tag / branch you want to stop the release to |
| --tag      | yes | Tag to release |
| --gh-token | yes | Your github token |
| --project-path | yes | Specify where is the project to release |
| --dry-run  | no | Generate changelog but do not release |
| --help     | no | Show help |
| --no-cleanup   | no | Do not delete created branches if error |

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

# publish.js

This script creates a new tag from the changelog created locally by [release.js](#releasejs)

## Usage

| Options    | Required? | Description                                        |
|------------|----------------------------------------------------------------|
| --tag | yes | Tag to release |
| --gh-token | yes | Your github token |
| --project-path | yes |  Path of the project to release |
| --help     | no | Show help |
| --draft | no | Draft the tag in github instead of releasing it |
| --prerelease | no | Mark the tag as a prerelease version |


**Example:**

```
    $ node publish.js --tag <the tag to release> --gh-token <your github token> --project-path ~/Projects/kuzzle
```

It will create a tag on github with the last changelog as body.

# Deploying to the cloud

```
$ docker run -i -t -v $(pwd)/deploy-kuzzle-fullstack-cloud.json:/opt/deploy-kuzzle-fullstack-cloud.json \
                    hashicorp/packer:1.0.2 build \
                    -var 'api_token=<your digital ocean API token>' \
                    -var 'access_key=<your AWS access_key>' \
                    -var 'secret_key=<your AWS secret key>' \
                    -var 'version=1.0.0' \
                    /opt/deploy-kuzzle-fullstack-cloud.json
```

You can create your DigitalOcean `api_token` [here](https://cloud.digitalocean.com/settings/api/tokens?i=824828).  
You can create your AWS `access_key` and `secret_key` [here](https://console.aws.amazon.com/iam/home?region=us-west-1#/users).

Currently, the script will create snapshot in:
* AWS Ireland (eu-west-1) on Ubuntu 16.04 (ami-06d0f775)
* AWS N. California (us-west-1) on Ubuntu 16.04 (ami-1b1e4b7b)
* DigitalOcean Amsterdam (ams2) on Ubuntu 16.04 (25615166)
* DigitalOcean New-York (nyc1) on Ubuntu 16.04 (25615166)

# update-sdks-submodules.sh

Script to update every submodules of all sdk's. You will need to set the `GH_TOKEN` environment variable in order to automatically create a pull request if the submodule is updated.
