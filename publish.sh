set -e
set -u

TYPE=$1

bash build.sh

git add *.js
git commit -m "bump"

mversion -m "${TYPE}"

git checkout angular
git merge master
git checkout master -- README.md
git checkout master -- README.angular.md
rm README.generic.md
mv README.md README.generic.md
mv README.angular.md README.md
git reset -- README.angular.md
git add README.* && git commit -m "merge updates" || true
git push angular-lds-io angular:master

git checkout jquery
git merge master
git checkout master -- README.md
git checkout master -- README.jquery.md
rm README.generic.md
mv README.md README.generic.md
mv README.jquery.md README.md
git reset -- README.jquery.md
git add README.* && git commit -m "merge updates" || true
git push jquery-lds-io jquery:master
