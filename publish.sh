set -e
set -u

TYPE=$1

bash build.sh

git add *.js
git commit -m "bump"

mversion -m "${TYPE}"

git checkout angular
git merge master
git push angular-lds-io angular:master

git checkout jquery
git merge master
git push jquery-lds-io jquery:master
