const
  args = process.argv.slice(2),
  token = args.includes('--token') ? args[args.indexOf('--token') + 1] : null,
  version = args.includes('--version') ? args[args.indexOf('--version') + 1] : null,
  digitalocean = require('digitalocean'),
  async = require('async');

let
  dropletId = null,
  snapshotId = null;

const help = () => {
  console.log('usage:')
  console.log('       --token        Your own DigitalOcean access token')
  console.log('       --version      Last Kuzzle version')
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
    region: 'ams2',
    size: '4gb',
    image: '25615166',
    user_data: `
#cloud-config

runcmd:
  - sudo sysctl -w vm.max_map_count=262144
  - cd ~
  - wget http://kuzzle.io/docker-compose.yml
  - sudo wget https://gist.githubusercontent.com/AnthonySendra/8a816ae7b7a79b20d470422f4dfa7c29/raw/a43caa243c7950b150436145b8444cc351131a4b/kuzzle.service
  - sudo mv /kuzzle.service /lib/systemd/system/kuzzle.service
  - systemctl start kuzzle
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

function createSnapshot () {
  let snapshotStatus = null
  console.log('CREATING SNAPSHOT')

  return new Promise((resolve, reject) => {
    client.droplets.snapshot(dropletId, {type: 'snapshot', name: `kuzzle-${version}`})
      .then((snapshot) => {
        console.log(snapshot)
        snapshotId = snapshot.id
        snapshotStatus = snapshot.status

        async.whilst(
          () => snapshotStatus === 'in-progress',
          (callback) => {
            client.snapshots.get(snapshotId)
              .then(newSnapshot => {
                snapshotStatus = newSnapshot.status
                callback(null, snapshotStatus)
              })
          },
          (err, status) => {
            if (!err && status === 'completed') {
              resolve()
            } else {
              reject(err)
            }
          }
        )
      })
  })
}

function destroyDroplet() {
  console.log('DESTROYING DROPLET')
  let dropletStatus = null
  return new Promise((resolve, reject) => {
    client.droplets.shutdown(dropletId)
      .then(info => {
        dropletStatus = info.status

        async.whilst(
          () => dropletStatus === 'in-progress',
          (callback) => {
            client.snapshots.get(snapshotId)
              .then(newSnapshot => {
                dropletStatus = newSnapshot.status
                callback(null, dropletStatus)
              })
          },
          (err, status) => {
            if (!err && status === 'completed') {
              resolve()
            } else {
              reject(err)
            }
          }
        )
      })
  })
}

createDroplet()
  .then(() => createSnapshot())
  .then(() => destroyDroplet())
