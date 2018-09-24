#!/bin/bash

set -e

R=$RANDOM
SDKS=(sdk-c sdk-cpp sdk-java sdk-android)
declare -A SUBMODULES
SUBMODULES=(
  [${SDKS[0]}]="./go"
  [${SDKS[1]}]="./test/features/sdk-features ./sdk-c ./sdk-c/go"
  [${SDKS[2]}]="./features/sdk-features ./sdk-cpp ./sdk-cpp/sdk-c ./sdk-cpp/sdk-c/go ./sdk-cpp/test/features/sdk-features"
  [${SDKS[3]}]="./sdk-java ./sdk-java/sdk-cpp ./sdk-java/sdk-cpp/sdk-c ./sdk-java/sdk-cpp/sdk-c/go ./sdk-java/sdk-cpp/test/features/sdk-features ./sdk-java/features/sdk-features"
)

OWNER=kuzzleio

for SDK in ${SDKS[@]};
do
  echo "---------------------"
  echo "        $SDK         " 
  echo "---------------------"

  cd /tmp
  git clone git@github.com:$OWNER/$SDK.git
  cd $SDK
  git submodule update --init --recursive

  for SUBMODULE in $(echo ${SUBMODULES[$SDK]} | tr " " "\n");
  do
    cd $SUBMODULE
    git checkout master
    RES=$(git pull)
    echo $RES
    cd -
    if [ "$RES" != "Already up-to-date." ]; then
      git add $SUBMODULE
    fi
  done

  if [ "$RES" != "Already up-to-date." ]; then
    git checkout -b update-submodules-$R
    git commit -am "Update submodules"
    git push origin update-submodules-$R
    curl -X POST https://github.com/$OWNER/$SDK/pulls?access_token=$GH_TOKEN -H "Content-Type: application/json" --data '{"title":"Update submodules","body":"Automatically update submodules.","head":"update-submodules-$R","base":"master"}'
  fi
  echo
done