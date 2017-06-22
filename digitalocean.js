const
  args = process.argv.slice(2),
  token = args.includes('--token') ? args[args.indexOf('--token') + 1] : null,
  version = args.includes('--version') ? args[args.indexOf('--version') + 1] : null,
  digitalocean = require('digitalocean'),
  async = require('async'),
  regionSlug = args.includes('--region') ? args[args.indexOf('--region') + 1] : 'ams2',
  request = require('request-promise')

let
  dropletId = '52227345'

const help = () => {
  console.log('usage:')
  console.log('       --token        Your own DigitalOcean access token')
  console.log('       --version      Last Kuzzle version')
  console.log('       --region       Region slug. Like "ams2", "lon1" (default "ams2")')
}

if (args.includes('--help')) {
  help()
  process.exit(1)
}

if (!token || !version) {
  help()
  process.exit(1)
}

const client = digitalocean.client(token);

function createDroplet () {
  let dropletStatus = null
  const attributes = {
    name: 'automatic-snapshot',
    region: regionSlug,
    size: '4gb',
    image: '25615166',
    user_data: `
#cloud-config

runcmd:
  - sudo echo "vm.max_map_count=262144" >> /etc/sysctl.conf
  - wget -O /root/docker-compose.yml http://kuzzle.io/docker-compose.yml
  - sudo wget -O /root/kuzzle.service https://gist.githubusercontent.com/AnthonySendra/8a816ae7b7a79b20d470422f4dfa7c29/raw/31e2666f6c5a7d7bc69850ff8bd8563a5288dbe9/kuzzle.service
  - sudo mv /root/kuzzle.service /lib/systemd/system/kuzzle.service
  - systemctl enable kuzzle
`
  }

  return new Promise((resolve, reject) => {
    console.log('CREATING DROPLET')
    client.droplets.create(attributes)
      .then(droplet => {
        dropletId = droplet.id
        dropletStatus = droplet.status

        async.whilst(
          () => dropletStatus === 'new',
          (callback) => {
            client.droplets.get(dropletId)
              .then(newDroplet => {
                dropletStatus = newDroplet.status
                callback(null, dropletStatus)
              })
          },
          (err, status) => {
            if (!err && status === 'active') {
              resolve()
            } else {
              reject(err)
            }
          }
        )
      })
  })
}

function waitingInstall() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, 120000)
  })
}

function createSnapshot () {
  let snapshotCount = 0
  console.log('CREATING SNAPSHOT')

  return new Promise((resolve, reject) => {
    client.droplets.snapshot(dropletId, {type: 'snapshot', name: `kuzzle-${version}-${regionSlug}`})
      .then(() => {
        async.whilst(
          () => snapshotCount === 0,
          (callback) => {
            console.log('WAITING FOR SNAPSHOT CREATION')
            client.droplets.snapshots(dropletId, 1 , 1)
              .then(response => {
                setTimeout(() => {
                  snapshotCount = response._digitalOcean.body.meta.total
                  callback(null, snapshotCount)
                }, 5000)
              })
          },
          err => err ? reject(err) : resolve()
        )
      })
  })
}

function deleteDroplet() {
  console.log('DESTROYING DROPLET')
  return client.droplets.delete(dropletId)
}

createDroplet()
  .then(() => waitingInstall())
  .then(() => createSnapshot())
  .then(() => deleteDroplet())
  .catch(e => console.error(e))
