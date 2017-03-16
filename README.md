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
    $ node release.js --from master --to 2.x --tag 2.1.0 --dry-run --output CHANGELOG.md
```
