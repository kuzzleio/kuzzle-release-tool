# Kuzzle Release Tools

Set of tools allowing to:

* Detect projects that can be released: [checkUpdate.js](#checkUpdatejs)
* Prepare a release pull request: [release.js](#releasejs)
* Creates a tag and its changelog on github: [publish.js](#publishjs)
* Deploying snapshot to the cloud: [via Docker](#deploying-to-the-cloud)

# checkUpdate.js

Prints the list of projects containing PRs that can be released.

Uses the projects description in the `repositories.json` configuration file.

## Usage

`node checkUpdate.js -t <token>`

| Options    | Alias | Required? | Description                                        |
|------------|-------|-----------|----------------------------------------------------|
| `--token`  | `-t`  | yes       | Your github token. Although no github operation require rights, this script needs to be authenticated because of [Github API rate limits](https://developer.github.com/v3/rate_limit/) |

## Example

```shell
$ node checkUpdate.js -t <TOKEN>
Scanning project boost-geospatial-index...
Scanning project documentation...
Scanning project dumpme...
Scanning project koncorde...
Scanning project kuzzle...
Scanning project kuzzle-admin-console...
Scanning project kuzzle-common-objects...
Scanning project kuzzle-plugin-auth-passport-local...
Scanning project kuzzle-plugin-auth-passport-oauth...
Scanning project kuzzle-core-plugin-boilerplate...
Scanning project sdk-php...
Scanning project sdk-javascript...
Scanning project sdk-go...
Scanning project sdk-android...
Scanning project protocol-mqtt...
Scanning project kuzzle-proxy...
Scanning project kuzzle-plugin-probe-listener...
Scanning project kuzzle-plugin-probe...
Scanning project kuzzle-plugin-logger...
Scanning project kuzzle-plugin-cluster...
Scanning project kuzzle-vault...
Scanning project kuzzle-cli...
The following repositories can be released:
    documentation                     => Versions: 1
    kuzzle                            => Versions: 1
    kuzzle-admin-console              => Versions: 2
    kuzzle-plugin-auth-passport-oauth => Versions: 4
    kuzzle-plugin-cluster             => Versions: 3
    kuzzle-plugin-logger              => Versions: 2
    kuzzle-plugin-probe               => Versions: 1
    kuzzle-plugin-probe-listener      => Versions: 1
    kuzzle-proxy                      => Versions: 1
    kuzzle-vault                      => Versions: 1
    kuzzle-cli                        => Versions: 1
    protocol-mqtt                     => Versions: 2
    sdk-android                       => Versions: 3
    sdk-javascript                    => Versions: 5
```

# release.js

This script prepares a release pull request for a project, complete with a new version tag and a normalized changelog.

The project and its available major versions must be defined in the `repositories.json` configuration file.

**Note:** The project's code is updated with the new version tag. Currently supported packagers:

  * NPM (`package.json` & `package-lock.json`)
  * Composer (`composer.json`)
  * Gradle

## Usage

`node release.js -m <major version> -t <token> <project directory>

| Options    | Alias | Required? | Description         |
|------------|-------|-----------|---------------------|
| `--major`  | `-m`  | yes       | Repository version to release (see repositories.json) |
| `--token`  | `-t`  | yes       | Github token. Must give sufficient privileges to create a new pull request |
| `--dry-run`|       | no | Calculates the new tag, writes the changelogs into a file, and exits without creating a pull request |
| `--no-cleanup` |     | no | Do not delete the new release branch when an error occurs |
| `--tag`    |       | no | Instead of calculating a new tag, use the provided one |

## Example

```
$ node release.js -m 2 -t <token> $HOME/git/kuzzle-plugin-logger
New repository tag: 2.0.11
CHANGELOG written in changelogs/kuzzleio.kuzzle-plugin-logger.2.CHANGELOG.md
Switched to branch '2.0.11-proposal'

To github.com:kuzzleio/kuzzle-plugin-logger.git
   f0f7a09..e174b14  2.0.11-proposal -> 2.0.11-proposal

```

# publish.js

Once a release pull request has been merged onto its target branch, a new tag can be created.

This script creates that new tag, using the release pull request to get the tag content (i.e. the release changelog).


## Usage

`node publish.js -t <token> -m <major> <project directory>`

| Options    | Alias | Required? | Description                                                       |
|------------|-------|-----------|-------------------------------------------------------------------|
| `--major`  | `-m`  | yes       | Repository version to release (see repositories.json)             |
| `--token`  | `-t`  | yes       | Github token. Must give sufficient privileges to create a new tag |


## Example

```
node publish.js -m 5 -t <token> $HOME/git/kuzzle-plugin-auth-passport-local
Detected tag: 5.1.4. Is that correct (Y|n)? y
Successfully published: https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local/releases/tag/5.1.4
```

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
