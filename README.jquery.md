jQuery Library for lds-api-js
==============

This repo is primarily for bower and documentation.

See <https://github.com/LDSorg/lds-api-js> for issues and pull requests.

jquery-lds-io
==============

jQuery for working with LDS.org API data.

* Login
* API
* Caching

Install & Usage
===============

```bash
bower install --save oauth3
bower install --save lds-api
```

**Development**:

```html
<script src="bower_components/recase/recase.js"></script>
<script src="bower_components/oauth3/oauth3.js"></script>
<script src="bower_components/oauth3/oauth3.jquery.js"></script>

<script src="bower_components/lds-api/src/lds-io-storage.js"></script>
<script src="bower_components/lds-api/src/lds-io-config.js"></script>
<script src="bower_components/lds-api/src/lds-io-cache.js"></script>
<script src="bower_components/lds-api/src/lds-io-session.js"></script>
<script src="bower_components/lds-api/src/lds-io-api.js"></script>
<script src="bower_components/lds-api/src/lds-io.js"></script>
<script src="bower_components/lds-api/src/lds-api.jquery.js"></script>
```

**Production**:

```html
<script src="bower_components/recase/recase.min.js"></script>
<script src="bower_components/oauth3/oauth3.jquery.min.js"></script>
<script src="bower_components/lds-api/lds-api.jquery.min.js"></script>
```

```javascript
  window.jqLdsIo.init({
    appId: 'TEST_ID_9e78b54c44a8746a5727c972'
  , appVersion: '1.0.0'

    // some function to open your login dialog
    // and returns a promise when login is complete
  , invokeLogin: MyAppLogin.invokeLogin
  }).then(function (jqLdsIo.config) {
    return jqLdsIo.session.backgroundLogin().then(function () {

      // fade in your application (with bootstrap)
      // <body class="fade">
      $('body').addClass('id');

      // show a message if we're in developer mode (with bootstrap)
      // <div class="js-developer-mode alert alert-info">You're in Dev Mode!</div>
      if (jqLdsIo.config.developerMode) {
        $('.js-developer-mode').show();
      }
    });
  });
}]);
```

Example `MyAppLogin.invokeLogin`
```javascript
// poor man's login modal
function handleLoginComplete(resolve, reject) {
  $('.js-login-modal form').off('submit', 'body', window.__loginHandler); 

  window.__loginHandler = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();

    // this must be called from an event the synchronously originates from a true click

    function closeModal() {
      $('.js-login-modal').removeClass('in');
      $timeout(function () {
        $('.js-login-modal').show();
      });
    }

    jqLdsApi.session.login({ popup: true }).then(resolve, reject).then(closeModal, closeModal);
  }

  $('.js-login-modal form').on('submit', 'body', window.__loginHandler);
}
function invokeLogin() {
  // <div class="js-login-modal fade">...</div>
  $('.js-login-modal').show();
  $timeout(function () {
    $('.js-login-modal').addClass('in');
  }, 50);

  // Wrap our modal in a promise
  return new window.OAUTH3.PromiseA(function (resolve, reject) {
    createLoginHandler(resolve, reject);
  });

  return $rootScope.rootLoginDeferred.promise;
}
```

API
===

All APIs return a promise unless otherwise noted

jqLdsIo
------

* LdsApi.init(opts)                                       // typically just appId, appVersion, and invokeLogin

jqLdsIo.session
-------------

* `jqLdsIo.session.backgroundLogin(opts)`                         // attempts login via oauth3 iframe
* `jqLdsIo.session.login(opts)`                                   // opens Authorization Dialog, must be attached to a click handler
  * opts.scope // array or string
* `jqLdsIo.session.logout()`             // opens iframe with logout
* `jqLdsIo.session.onLogin($scope, fn)`  // fires when switching from logged out to logged in
* `jqLdsIo.session.onLogout($scope, fn)` // fires when switching from logged in to logged out
* `jqLdsIo.session.checkSession()`       // resolves session or rejects nothing
* `jqLdsIo.session.requireSession()`     // calls `invokeLogin()` if `checkSession()` is rejected
* `account = jqLdsIo.session.selectAccount(accountId|null)`     // Select the given account by id, or the default account

jqLdsIo.request
-------------

As long as data is not older than `jqLdsIo.config.uselessWait`, it will be presented immediately.
However, if it is older than `jqLdsIo.config.refreshWait` it will refresh in the background. 

Account Specific

* `jqLdsIo.request.create(account)`             // creates wrapper that uses this account
  * `ldsApiRequest.profile()`                                 // logged-in user's info
  * `ldsApiRequest.stake(p.homeStakeId)`                      // returns ward member data
  * `ldsApiRequest.stakePhotos(p.homeStakeId)`                // returns photo metadata
  * `ldsApiRequest.ward(p.homeStakeId, p.homeWardId)`         // returns ward member data
  * `ldsApiRequest.wardPhotos(p.homeStakeId, p.homeWardId)`   // returns photo metadata

NOTE: These also all exist statelessly as `jqLdsIo.request.api.<<foo>>`
* example: jqLdsIo.request.api.profile(account)

Helpers

* `jqLdsIo.request.photoUrl(metadata)` (non-promise)          // constructs ward member photo url
* `jqLdsIo.request.guessGender(member)` (non-promise)         // returns a guess based on organizations (priest, laural, etc)

TODO

* TODO `.leadership(ward)` (non-promise)              // pluck important leadership callings from ward data
* TODO `.stakeLeadership(stake)` (non-promise)        // pluck important leadership callings from stake data

Note: all api requests can accept `{ expire: true }` to force them to ignore the cache

jqLdsIo.storage
-------------

These use `localStorage`, but all return promises. It would be extremely easy to swap this out for an indexeddb version. Please pull-request with a new file `lds-io-storage-indexeddb.js` if you do so.

All keys are prefixed with `io.lds.`.

* `jqLdsIo.storage.get(key)` // Done't JSON.parse(), this is done for you
* `jqLdsIo.storage.set(key, obj)` // Don't JSON.stringify(), this is done for you
* `jqLdsIo.storage.remove(key)`
* `jqLdsIo.storage.clear(key)` // this will only remove `io.lds.` prefixed keys, it DOES NOT `localStorage.clear()`

Note: If a `get` retrieves `undefined`, `"undefined"`, `null` or `"null"`, or if the parse fails, the promise will be rejected.

jqLdsIo.cache
--------

This is a layer atop `jqLdsIo.storage`, and used by `jqLdsIo.request`. You may find it useful for your own applications as it guarantees that any existing data will be returned and stale data will be refreshed in the background.

* `jqLdsIo.cache.read(id, fetch, opts)`
  * `id` is the id that should be used
  * `fetch()` must be a promise. It will be called if the data is not in cache or needs to be refreshed
    * (this was abstracted out so that the code can easily be shared between node, jQuery, angular, etc)
  * `opts` such as `{ expire: true }`
* `jqLdsIo.cache.destroy()` // expires all caches and calls `jqLdsIo.storage.clear()`

Note: there is also an internal `init()`

jqLdsIo.config
------------

This is just helper class. It is called by `LdsApi.init(opts)`

* `jqLdsIo.config.init(opts)` // Called by `LdsApi.init(opts)`
  * `invokeLogin()`         // shows UI for login and returns a promise of when login has completed
  * `providerUri`           //  ('https://ldsconnect.org'), but currently points to 'https://lds.io' because that part isn't implemented
  * `appBaseUri` // $window.location.protocol + '//' + $window.location.host + $window.location.pathname
  * `appId`
  * `appVersion` // might be used to clear cache on version change
  * `apiPrefix` // defaults to `/api/ldsio`
  * `refreshWait` // (in milliseconds) defaults to 15 minutes
    * will not attempt to check for new data for 15 minutes
  * `uselessWait` // (in milliseconds) defaults to Inifinity
    * if data is this old, it will not be retrieved from cache

Playground
==========

`window.LdsIo` is set so that you can play with the API from the console (normally the one great failing of Angular APIs).
