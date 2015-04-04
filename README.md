angular-lds-io
==============

Angular services for working with LDS.org API data.

* Login
* API
* Caching

Install & Usage
===============

```bash
bower install --save angular-lds-io
```

```html
<script src="bower_components/angular-lds-io/lds-io.min.js"></script>
```

```javascript
angular.module('myApp', [
  'ngRoute',
  'lds.io',
  'myApp.login'
]).run([
    '$rootScope'
  , 'MyAppLogin'
  , 'LdsApi'
  , 'LdsApiSession'
  , function ($rootScope, MyAppLogin, LdsApi, LdsApiSession) {

  return LdsApi.init({
    appId: 'TEST_ID_9e78b54c44a8746a5727c972'
  , appVersion: '1.0.0'
  , invokeLogin: MyAppLogin.invokeLogin
  }).then(function (LdsApiConfig) {
    return LdsApiSession.backgroundLogin().then(function () {

      // <body class="fade" ng-class="{ in: rootReady }">
      $rootScope.rootReady = true;

      // <div ng-if="rootDeveloperMode" class="alert alert-info">...</div>
      $rootScope.rootDeveloperMode = LdsApiConfig.developerMode;

    });
  });
}]);
```

Example `MyAppLogin.invokeLogin`
```javascript
// poor man's login modal
function invokeLogin() {
  // <div ng-if="rootShowLoginModal" ng-controller="LoginController as L"
  //   class="fade" ng-class="{ in: rootShowLoginModalFull }">...</div>
  $rootScope.rootShowLoginModal = true;
  $rootScope.rootLoginDeferred = $q.defer();
  $timeout(function () {
    $rootScope.rootShowLoginModalFull = true;
  }, 50);

  // 

  return $rootScope.rootLoginDeferred.promise;
}
```

API
===

LdsApi

* LdsApi.init(opts)                                       // typically just appId and invokeLogin

LdsApiSession

* LdsApiSession.backgroundLogin()                         // attempts login via oauth3 iframe
* LdsApiSession.login()                                   // must be attached to a click handler

LdsApiRequest

* LdsApiRequest.profile()                                 // logged-in user's info
* LdsApiRequest.stake(p.homeStakeId)                      // returns ward member data
* LdsApiRequest.stakePhotos(p.homeStakeId)                // returns photo metadata
* LdsApiRequest.ward(p.homeStakeId, p.homeWardId)         // returns ward member data
* LdsApiRequest.wardPhotos(p.homeStakeId, p.homeWardId)   // returns photo metadata
* LdsApiRequest.photoUrl(metadata)                        // constructs ward member photo url
* LdsApiRequest.guessGender(member)                       // returns a guess based on organizations (priest, laural, etc)
* TODO .leadership(ward) // pluck important leadership callings from ward data
* TODO .stakeLeadership(stake) // pluck important leadership callings from stake data

Internal

* LdsApiStorage
* LdsApiCache
* LdsApiConfig
