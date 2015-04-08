'use strict';

angular
  .module('lds.io.storage', [])
  .service('LdsApiStorage', [
    '$window'
  , '$q'
  , function LdsApiStorage($window, $q) {
    var prefix = 'io.lds.';
    var LdsIoStorage = {
      init: function (pre) {
        if (pre) {
          prefix = pre;
        }
      }
    , get: function (key) {
        var val;

        try {
          val = JSON.parse(localStorage.getItem(prefix + key) || null);
        } catch(e) {
          console.error("couldn't parse " + prefix + key, localStorage.getItem(prefix + key));
          localStorage.removeItem(prefix + key);
          val = null;
        }

        // just because sometimes it happens...
        if ('undefined' === val || 'null' === val) {
          console.warn("got undefined for " + prefix + key);
          val = null;
        }

        return val && $q.when(val) || $q.reject();
      }
    , set: function (key, val) {
        try {
          localStorage.setItem(prefix + key, JSON.stringify(val));
          return $q.when();
        } catch(e) {
          console.error("couldn't stringify " + prefix + key, val);
          return $q.reject(e);
        }
      }
    , remove: function (key) {
        localStorage.removeItem(prefix + key);
        return $q.when();
      }
    , clear: function (account) {
        var re;
        var keys = [];
        var i;
        var key;

        re = new RegExp('^'
          // See http://stackoverflow.com/a/6969486/151312 for regexp escape explanation
          + prefix.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
          + (account || '')
        );

        for (i = 0; i < localStorage.length; i += 1) {
          key = localStorage.key(i);
          if (re.test(key) && !/\.(dev|developer)\./.test(key)) {
            keys.push(key);
          }
        }

        keys.forEach(function (key) {
          localStorage.removeItem(key);
        });

        return $q.when();
      }
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.storage = LdsIoStorage;

    return LdsIoStorage;
  }])
  ;
'use strict';

angular
  .module('lds.io.config', ['lds.io.storage'])
  .service('LdsApiConfig', [
    '$window'
  , 'LdsApiStorage'
  , function LdsApiConfig($window, LdsApiStorage) {
    var defaults = {
      providerUri: 'https://lds.io'
    , appUri: $window.location.protocol + '//' + $window.location.host + $window.location.pathname
    , appId: null
    , apiPrefix: '/api/ldsio'
    , logoutIframe: '/logout.html'
    , refreshWait: 15 * 60 * 60 * 1000
    , uselessWait: Infinity
    // note: host includes 'port' when port is non-80 / non-443
    , invokeLogin: function () {
        $window.alert("override `LdsApiConfig.invokeLogin` with a function that shows a login dialog,"
          + " calls LdsApiSession.login on click, and returns a promise in that chain."
          + " TODO document on website");
      }
    };
    var LdsIoConfig = {
      init: function (opts) {
        var me = this;

        opts = opts || {};
        return LdsApiStorage.get('dev.providerUri').then(function (val) {
          console.info("API set to " + val);
          console.log("set to custom provider with `LdsIo.storage.set('dev.providerUri', 'https://example.com')`");
          console.log("or set to default with `LdsIo.storage.remove('dev.providerUri')`");
          me.providerUri = val;
          me.developerMode = true;
        }, function () {
          // ignore
        }).then(function () {
          Object.keys(opts).forEach(function (key) {
            if ('appSecret' === key) {
              $window.alert("[ERROR] appSecret must never be used in a client (browser, mobile, or desktop)");
              return;
            }
            me[key] = opts[key];
          });

          Object.keys(defaults).forEach(function (key) {
            if ('undefined' === typeof me[key]) {
              me[key] = defaults[key];
            }
          });

          if (!me.appId) {
            // TODO auto-register oauth3
            $window.alert("[ERROR] you did not supply `LdsApiConfig.appId`. Consider using 'TEST_ID_9e78b54c44a8746a5727c972'");
          }

          return me;
        });
      }
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.config = LdsIoConfig;

    return LdsIoConfig;
  }])
  ;
'use strict';

angular
  .module('lds.io.cache', ['lds.io.storage'])
  .service('LdsApiCache', [
    '$window'
  , '$q'
  , 'LdsApiStorage'
  , function LdsApiCache($window, $q, LdsApiStorage) {
    var LdsIoCache;
    var caches;
    var refreshIn = (15 * 60 * 1000);
    var uselessIn = Infinity; // (30 * 24 * 60 * 60 * 1000);

    /*
    function batchApiCall(ids, url, handler) {
      // freshIds, staleIds = ids.filter()
      // get url but don't cache
      handler(result, function (id, data) {
        // put id into result set
      });
    }
    */

    function init() {
      return LdsApiStorage.get('caches').then(function (result) {
        caches = result;
      }, function () {
        caches = {};
      });
    }

    function read(id, fetch, opts) {
      var refreshWait = refreshIn;
      var uselessWait = uselessIn;
      var fresh;
      var usable;
      var now;
      var promise;

      function fin(value) {
        promise = null;
        caches[id] = Date.now();
        return LdsApiStorage.set(id, value).then(function () {
          return LdsApiStorage.set('caches', caches).then(function () {
            return { updated: caches[id], value: value, stale: false };
          });
        });
      }

      if (caches[id] && !(opts && opts.expire)) {
        now = Date.now();
        usable = now - caches[id] < uselessWait;
        fresh = now - caches[id] < refreshWait;
        if (!fresh) {
          promise = fetch().then(fin);
        }
      }

      return LdsApiStorage.get(id).then(function (result) {
        if (usable) {
          return $q.when({ updated: caches[id], value: result, stale: !fresh });
        } else {
          return (promise || fetch()).then(fin);
        }
      }, function () {
        return (promise || fetch()).then(fin);
      });
    }

    function destroy() {
      caches = {};
      return LdsApiStorage.clear();
    }

    LdsIoCache = {
      init: init
    , read: read
    , destroy: destroy
    , clear: destroy
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.cache = LdsIoCache;

    return LdsIoCache;
  }])
  ;
'use strict';

angular
  .module('lds.io.session', ['oauth3', 'lds.io.cache', 'lds.io.storage', 'lds.io.config'])
  .service('LdsApiSession', [
    '$window'
  , '$timeout'
  , '$q'
  , '$http'
  , 'LdsApiConfig'
  , 'LdsApiStorage'
  , 'LdsApiCache'
  , 'Oauth3'
  , function LdsApiSession($window, $timeout, $q, $http
      , LdsApiConfig, LdsApiStorage, LdsApiCache, Oauth3) {

    function createSession() {
      return { logins: [], accounts: [] };
    }

    var shared = { session: createSession() };
    var logins = {};
    var loginPromises = {};
    var foregroundLoginPromises = {};
    var backgroundLoginPromises = {};
    var LdsIoSession;

    $window.completeLogin = function (_, __, params) {
      var state = params.browser_state || params.state;
      var stateParams = Oauth3.states[state];
      var d = loginPromises[state];

      function closeWindow() {
        if (d.winref) {
          d.winref.close(); 
        }
      }

      d.promise.then(closeWindow).catch(closeWindow);

      if (!state) {
        d.reject(new Error("could not parse state from login"));
        return;
      }

      if (!params.access_token) {
        d.reject(new Error("didn't get token")); // destroy();
        return;
      }

      if (!stateParams) {
        d.reject(new Error("didn't get matching state")); // could be an attack?
        return;
      }

      // TODO rid token on reject
      testLoginAccounts(getLoginFromTokenParams(null, params))
        .then(save).then(d.resolve, d.reject);
    };

    function getLoginFromTokenParams(ldsaccount, params) {
      if (!params || !(params.access_token || params.accessToken || params.token)) {
        return null;
      }

      return {
        token: params.access_token || params.accessToken || params.token
      , expiresAt: params.expires_at || params.expiresAt
          || Date.now() + (1 * 60 * 60 * 1000) // TODO
      , appScopedId: params.app_scoped_id || params.appScopedId
          || null
      , loginId: params.loginId || params.login_id
      , accountId: params.accountId || params.account_id
      , comment: ldsaccount && (ldsaccount + ' (via lds.org)') // TODO "AJ on Facebook"
      , loginType: ldsaccount && 'ldsaccount'
      };
    }

    function getId(o, p) {
      // object
      if (!o) {
        return null;
      }
      // prefix
      if (!p) {
        return o.appScopedId || o.app_scoped_id || o.id || null;
      } else {
        return o[p + 'AppScopedId'] || o[p + '_app_scoped_id'] || o[p + 'Id'] || o[p + '_id'] || null;
      }
    }

    function getToken(session, accountId) {
      var logins = [];
      var login;

      // search logins first because we know we're actually
      // logged in with said login, y'know?
      session.logins.forEach(function (login) {
        login.accounts.forEach(function (account) {
          if (getId(account) === accountId) {
            logins.push(login);
          }
        });
      });

      login = logins.sort(function (a, b) {
        // b - a // most recent first
        return (new Date(b.expiresAt).value || 0) - (new Date(a.expiresAt).value || 0);
      })[0];

      return login && login.token;
    }

    // this should be done at every login
    // even an existing login may gain new accounts
    function addAccountsToSession(session, login, accounts) {
      var now = Date.now();

      login.accounts = accounts.map(function (account) {
        account.addedAt = account.addedAt || now;
        return {
          id: getId(account)
        , addedAt: now
        };
      });

      accounts.forEach(function (newAccount) {
        if (!session.accounts.some(function (other, i) {
          if (getId(other) === getId(newAccount)) {
            session.accounts[i] = newAccount;
            return true;
          }
        })) {
          session.accounts.push(newAccount);
        }
      });

      session.accounts.sort(function (a, b) {
        return b.addedAt - a.addedAt;
      });
    }

    function removeItem(array, item) {
      var i = array.indexOf(item);

      if (-1 !== i) {
        array.splice(i, 1);
      }
    }

    // this should be done on login and logout
    // an old login may have lost or gained accounts
    function pruneAccountsFromSession(session) {
      var accounts = session.accounts.slice(0);

      // remember, you can't modify an array while it's in-loop
      // well, you can... but it would be bad!
      accounts.forEach(function (account) {
        if (!session.logins.some(function (login) {
          return login.accounts.some(function (a) {
            return getId(a) === getId(account);
          });
        })) {
          removeItem(session.accounts, account);
        }
      });
    }

    function refreshCurrentAccount(session) {
      // select a default session
      if (1 === session.accounts.length) {
        session.accountId = getId(session.accounts[0]);
        session.id = session.accountId;
        session.token = session.accountId && getToken(session, session.accountId) || null;
        return;
      }

      if (!session.logins.some(function (account) {
        if (session.accountId === getId(account)) {
          session.accountId = getId(account);
          session.id = session.accountId;
          session.token = session.accountId && getToken(session, session.accountId) || null;
        }
      })) {
        session.accountId = null;
        session.id = null;
        session.token = null;
      }
    }

    /*
    function selectAccount(session, id) {
      var token = getToken(session, id);
      if (token) {
        session.token = token;
        session.accountId = id;
        session.id = id;
      } else {
        throw new Error('[Developer Error] it should not be possible to select a logged out account');
      }
    }
    */
    
    function updateSession(session, login, accounts) {
      login.addedAt = login.addedAt || Date.now();

      // sanity check login
      if (0 === accounts.length) {
        login.selectedAccountId = null;
      }
      else if (1 === accounts.length) {
        login.selectedAccountId = getId(accounts[0]);
      }
      else if (accounts.length >= 1) {
        login.selectedAccountId = null;
      }
      else {
        throw new Error("[SANITY CHECK FAILED] bad account length'");
      }

      addAccountsToSession(session, login, accounts);

      // update login if it exists
      // (or add it if it doesn't)
      if (!session.logins.some(function (other, i) {
        if ((login.loginId && other.loginId === login.loginId) || (other.token === login.token)) {
          session.logins[i] = login;
          return true;
        }
      })) {
        session.logins.push(login);
      }

      pruneAccountsFromSession(session);

      refreshCurrentAccount(session);

      session.logins.sort(function (a, b) {
        return b.addedAt - a.addedAt;
      });
    }

    // TODO track granted scopes locally
    function save(updates) {
      // TODO make sure session.logins[0] is most recent
      updateSession(shared.session, updates.login, updates.accounts);

      // TODO should this be done by the LdsApiStorage?
      // TODO how to have different accounts selected in different tabs?
      localStorage.setItem('io.lds.session', JSON.stringify(shared.session));
      return $q.when(shared.session);
    }

    function restore() {
      // Being very careful not to trigger a false onLogin or onLogout via $watch
      var storedSession;

      if (shared.session.token) {
        return $q.when(shared.session);
      }

      storedSession = JSON.parse(localStorage.getItem('io.lds.session') || null) || createSession();

      if (storedSession.token) {
        shared.session = storedSession;
        return $q.when(shared.session);
      } else {
        return $q.reject(new Error("No Session"));
      }
    }

    function destroy() {
      if (!shared.session.token) {
        return $q.when(shared.session);
      }

      shared.session = createSession();
      localStorage.removeItem('io.lds.session');
      return LdsApiCache.destroy().then(function (session) {
        return session;
      });
    }

    function testLoginAccounts(login) {
      // TODO cache this also, but with a shorter shelf life?
      return $http.get(
        LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/accounts' + '?camel=true'
      , { headers: { 'Authorization': 'Bearer ' + login.token } }
      ).then(function (resp) {
        var accounts = resp.data && (resp.data.accounts || resp.data.result || resp.data.results)
          || resp.data || { error: { message: "Unknown Error when retrieving accounts" } }
          ;

        if (accounts.error) { 
          console.error("[ERROR] couldn't fetch accounts", accounts);
          return $q.reject(new Error("Could not verify login:" + accounts.error.message));
        }

        if (!Array.isArray(accounts)) {
          console.error("[Uknown ERROR] couldn't fetch accounts, no proper error", accounts);
          // TODO destroy();
          return $q.reject(new Error("could not verify login")); // destroy();
        }

        return { login: login, accounts: accounts };
      });
    }

    function logout() {
      // TODO also logout of lds.io
      /*
      return $http.delete(
        apiPrefix + '/session'
      , { headers: { 'Authorization': 'Bearer ' + shared.session.token } }
      ).then(function () {
        return destroy();
      });
      */

      var url = LdsApiConfig.providerUri + LdsApiConfig.logoutIframe;
      var $iframe = $('<iframe src="' + url + '" width="1px" height="1px" style="opacity: 0.01;" frameborder="0"></iframe>');
      $('body').append($iframe);
      
      return $timeout(function () {
        $iframe.remove();
      }, 500).then(function () {
        return destroy();
      });
    }

    function framedLogin(providerUri, url, state, background) {
      var progressPromises;

      // TODO scope to providerUri
      if (background) {
        progressPromises = backgroundLoginPromises;
      } else {
        progressPromises = foregroundLoginPromises;
      }

      if (progressPromises[providerUri]) {
        return progressPromises[providerUri];
      }

      var d = $q.defer();
      loginPromises[state] = d;

      progressPromises[providerUri] = d.promise.then(function (data) {
        progressPromises[providerUri] = null;
        return data;
      }, function (err) {
        progressPromises[providerUri] = null;
        return $q.reject(err);
      });

      return progressPromises[providerUri];
    }

    function popupLogin(providerUri, url, state) {
      var promise = framedLogin(providerUri, url, state, false);
      var winref;

      // This is for client-side (implicit grant) oauth2
      winref = $window.open(url, 'ldsioLogin', 'height=720,width=620');
      loginPromises[state].winref = winref;

      return promise;
    }

    function backgroundLogin(providerUri, url, state) {
      var promise = framedLogin(providerUri, url, state, true);
      var $iframe = $(
        '<iframe'
      + ' src="' + url + '"'
      + ' width="1px" height="1px" style="opacity: 0.01;"'
      + ' frameborder="0"></iframe>'
      );  

      $('body').append($iframe);

      return promise.then(function (data) {
        $iframe.remove();
        return data;
      }, function (err) {
        $iframe.remove();
        return $q.reject(err);
      });
    }

    function login(oauthscope, opts) {
      // TODO note that this must be called on a click event
      // otherwise the browser will block the popup
      function forceLogin() {
        return logins.implicitGrant({ popup: true, scope: oauthscope });
      }

      // TODO check for scope in session
      return checkSession(oauthscope).then(function (session) {
        if (!session.id || opts && opts.force) {
          return forceLogin();
        }

        return session;
      }, forceLogin);
    }

    function requireLogin(opts) {
      return restore().then(function (session) {
        return session;
      }, function (/*err*/) {
        
        return LdsApiConfig.invokeLogin(opts);
      });
    }

    function realCreateAccount(login) {
      return $http.post(LdsApiConfig.providerUri + '/api' + '/accounts', {
        account: {}
      , logins: [{
          // TODO make appScopedIds even for root app
          id: login.appScopedId || login.app_scoped_id || login.loginId || login.login_id || login.id 
        }]
      }, { 
        headers: {
          authorization: 'Bearer: ' + login.token
        }
      }).then(function (resp) {
        return resp.data;
      }, function (err) {
        return $q.reject(err);
      });
    }

    function attachLoginToAccount(account, login) {
      var url = LdsApiConfig.providerUri + '/api' + '/accounts/' + account.id + '/logins';

      return $http.post(
        url
      , { logins: [{ id: login.id }] }
      ).then(function (resp) {
        if (!resp.data) {
          return $q.reject(new Error("no response when linking login to account"));
        }
        if (resp.data.error) {
          return $q.reject(resp.data.error);
        }

        // return nothing
      });
    }

    function handleOrphanLogins(session) {
      var promise;

      if (session.logins.some(function (login) {
        return !login.accounts.length;
      })) {
        if (session.accounts.length > 1) {
          throw new Error("[Not Implemented] can't yet attach logins to an account when more than one account exists."
            + " Please logout and sign back in with your LDS.org Account only. Then attach the other login.");
        }
        promise = $q.when();
        session.logins.forEach(function (login) {
          if (!login.accounts.length) {
            promise = promise.then(function () {
              return attachLoginToAccount(session.accounts[0], login);
            });
          }
        });
      }

      return promise.then(function () {
        return session;
      });
    }

    function requireAccount(session) {
      var promise;
      var ldslogins;

      if (session.accounts.length) {
        return $q.when(session);
      }

      if (!session.logins.length) {
        return $q.reject(new Error("[Developer Error] do not call requireAccount when you have not called requireLogin."));
      }

      ldslogins = session.logins.filter(function (login) {
        return 'ldsaccount' === login.loginType;
      });

      if (!ldslogins.length) {
        return LdsApiConfig.invokeLogin({
          hideSocial: true
        , flashMessage: "Login with your LDS Account at least once before linking other accounts."
        , flashMessageClass: "alert-warning"
        }).then(function () {
          // need to recheck accounts status
          return requireAccount(session);
        });
      }

      // at this point we have a valid ldslogin, but still no ldsaccount
      promise = $q.when();

      ldslogins.forEach(function (login) {
        promise = promise.then(function () {
          return realCreateAccount(login).then(function (account) {
            login.accounts.push(account);
            return save({ login: login, accounts: login.accounts });
          });
        });
      });

      return promise.then(handleOrphanLogins);
    }

    function requireSession(opts) {
      var promise = $q.when(opts);

      // TODO create middleware stack
      return promise.then(requireLogin).then(requireAccount);
        // .then(selectAccount).then(verifyAccount)
    }

    function checkSession() {
      return restore();
    }

    function onLogin(_scope, fn) {
      // This is better than using a promise.notify
      // because the watches will unwatch when the controller is destroyed
      _scope.__stsessionshared__ = shared;
      _scope.$watch('__stsessionshared__.session', function (newValue, oldValue) {
        if (newValue.accountId && oldValue.accountId !== newValue.accountId) {
          fn(shared.session);
        }
      }, true);
    }

    function onLogout(_scope, fn) {
      _scope.__stsessionshared__ = shared;
      _scope.$watch('__stsessionshared__.session', function (newValue, oldValue) {
        if (!newValue.accountId && oldValue.accountId) {
          fn(null);
        }
      }, true);
    }

    logins.authorizationRedirect = function (opts) {
      return Oauth3.authorizationRedirect(
        opts.providerUri
      , opts.scope // default to directive from this provider
      , opts.apiHost || LdsApiConfig.providerUri
      , opts.redirectUri
      ).then(function (prequest) {
        if (!prequest.state) {
          throw new Error("[Devolper Error] [authorization redirect] prequest.state is empty");
        }

        if (opts.background) {
          // TODO foreground iframe
          return backgroundLogin(LdsApiConfig.providerUri, prequest.url, prequest.state);
        } else if (opts.popup) {
          // TODO same for new window
          return popupLogin(LdsApiConfig.providerUri, prequest.url, prequest.state);
        } else {
          throw new Error("login framing method not specified");
        }
      });
    };
    logins.implicitGrant = function (opts) {
      opts = opts || {};
      // TODO OAuth3 provider should use the redirect URI as the appId?
      return Oauth3.implicitGrant(
        LdsApiConfig.providerUri
        // TODO OAuth3 provider should referer / origin as the appId?
      , opts.scope
      , opts.redirectUri
      , LdsApiConfig.appId || LdsApiConfig.appUri // (this location)
      ).then(function (prequest) {
        if (!prequest.state) {
          throw new Error("[Devolper Error] [implicit grant] prequest.state is empty");
        }
        if (opts.background) {
          // TODO foreground iframe
          return backgroundLogin(LdsApiConfig.providerUri, prequest.url, prequest.state);
        } else if (opts.popup) {
          // TODO same for new window
          return popupLogin(LdsApiConfig.providerUri, prequest.url, prequest.state);
        }
      });
    };
    logins.resourceOwnerPassword = function (ldsaccount, passphrase, scope) {
      return Oauth3.resourceOwnerPassword(
        LdsApiConfig.providerUri
      , ldsaccount
      , passphrase
      , scope
      , LdsApiConfig.appId || LdsApiConfig.appUri // (this location)
      ).then(function (request) {
        return $http({
          url: request.url + '?camel=true'
        , method: request.method
        , data: request.data
        }).then(function (result) {
          var login = getLoginFromTokenParams(ldsaccount, result.data);

          if (login) {
            return testLoginAccounts(login).then(save);
          }

          if (result.data.error) {
            return $q.reject(result.data.error); 
          }

          if ('string' === typeof result.data){
            return $q.reject(new Error("[Uknown Error] Message: " + result.data)); 
          } 

          console.error("[ERROR] could not retrieve resource owner password token");
          console.warn(result.data);
          return $q.reject(new Error("[Uknown Error] see developer console for details")); 
        });
      });
    };

    LdsIoSession = {
      usernameMinLength: 4
    , secretMinLength: 8
    , validateUsername: function (ldsaccount) {
        if ('string' !== typeof ldsaccount) {
          throw new Error("[Developer Error] ldsaccount should be a string");
        }

        if (!/^[0-9a-z\.\-_]+$/i.test(ldsaccount)) {
          // TODO validate this is true on the server
          return new Error("Only alphanumeric characters, '-', '_', and '.' are allowed in usernames.");
        }

        if (ldsaccount.length < LdsIoSession.usernameMinLength) {
          // TODO validate this is true on the server
          return new Error('Username too short. Use at least '
            + LdsIoSession.usernameMinLength + ' characters.');
        }

        return true;
      }
    , checkUsername: function (ldsaccount) {
        // TODO support ldsaccount as type
        var type = null;

        // TODO update backend to /api/ldsio/username/:ldsaccount?
        return $http.get(
          LdsApiConfig.providerUri + '/api'
            + '/logins/check/' + type + '/' + ldsaccount + '?camel=true'
        ).then(function (result) {
          if (!result.data.exists) {
            return $q.reject(new Error("username does not exist"));
          }
        }, function (err) {
          if (/does not exist/.test(err.message)) {
            return $q.reject(err);
          }

          throw err;
        });
      }
    , restore: restore
    , destroy: destroy
    , login: login
    , logins: logins
    , logout: logout
    , onLogin: onLogin
    , onLogout: onLogout
    , account: function (session) {
        return session.accounts.filter(function (account) {
          return getId(account) && session.accountId === getId(account);
        })[0] || null;
      }
    , checkSession: checkSession
    , requireSession: requireSession
    , openAuthorizationDialog: function () {
        // this is intended for the resourceOwnerPassword strategy
        return LdsApiConfig.invokeLogin();
      }
    , implicitGrantLogin: function (opts) {
        var promise;
        opts = opts || {};

        if (!opts.force) {
          promise = $q.when();
        } else {
          promise = $q.reject();
        }

        promise.then(function () {
          return restore().then(function (session) {
            var promise = $q.when();

            // TODO check expirey
            session.logins.forEach(function (login) {
              promise = promise.then(function () {
                return testLoginAccounts(login).then(save);
              });
            });
            return promise;
          });
        }, function () {
          return logins.implicitGrant({
            background: opts.background // iframe in background
          , popup: opts.popup           // presented in popup
          , window: opts.window         // presented in new tab / new window
          , iframe: opts.iframe         // presented in same window with security code
                                        // linked to bower_components/oauth3/oauth3.html
          , redirectUri: LdsApiConfig.appUri + '/oauth3.html'
          });
        });
      }
    , backgroundLogin: function (opts) {
        opts = opts || {};

        opts.background = true;
        return LdsIoSession.implicitGrantLogin(opts);
      }
    , debug: {
        refreshCurrentAccount: refreshCurrentAccount
      , updateSession: updateSession
      , testLoginAccounts: testLoginAccounts
      , save: save
      , shared: shared
      }
    };

    window.LdsIo = window.LdsIo || {};
    window.LdsIo.session = LdsIoSession;

    return LdsIoSession;
  }])
  ;
'use strict';

angular
  .module('lds.io.api', ['lds.io.cache', 'lds.io.config'])
  .service('LdsApiRequest', [
    '$window'
  , '$timeout'
  , '$q'
  , '$http'
  , 'LdsApiConfig'
  , 'LdsApiCache'
  , function LdsApiRequest($window, $timeout, $q, $http, LdsApiConfig, LdsApiCache) {
    var LdsIoApi;
    var promises = {};

    function getId(o, p) {
      // object
      if (!o) {
        return null;
      }
      // prefix
      if (!p) {
        return o.appScopedId || o.app_scoped_id || o.id || null;
      } else {
        return o[p + 'AppScopedId'] || o[p + '_app_scoped_id'] || o[p + 'Id'] || o[p + '_id'] || null;
      }
    }

    function realGet(session, id, url) {
      if (promises[id]) {
        return promises[id];
      }

      promises[id] = $http.get(
        url + '?camel=true'
      , { headers: { 'Authorization': 'Bearer ' + session.token } }
      ).then(function (resp) {
        delete promises[id];

        if (!resp.data) {
          window.alert("[SANITY FAIL] '" + url + "' returned nothing (not even an error)");
          return;
        }

        if (resp.data.error) {
          console.error('[ERROR]', url);
          console.error(resp.data);
          window.alert("[DEVELOPER ERROR] '" + url + "' returned an error (is the url correct? did you check login first?)");
          return;
        }


        return resp.data;
      }, function (err) {
        delete promises[id];

        return $q.reject(err);
      });

      return promises[id];
    }

    function promiseApiCall(session, id, url, opts) {
      opts = opts || {};
      return LdsApiCache.read(id, function () {
        var d = $q.defer();

        var token = $timeout(function () {
          if (opts.tried) {
            d.reject(new Error("timed out (twice) when attempting to get data"));
            return;
          }

          opts.tried = true;
          return promiseApiCall(session, id, url, opts).then(d.resolve, d.reject);
        }, opts.tried && 16000 || 8000); 

        realGet(session, id, url).then(function (data) {
          $timeout.cancel(token);
          return d.resolve(data);
        }, function (err) {
          $timeout.cancel(token);
          return d.reject(err);
        });

        return d.promise;
      }, opts).then(function (data) {
        return data.value;
      });
    }

    LdsIoApi = {
      init: function () {
      }
    , profile: function (session, opts) {
        var id = session.id + '.me';
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix + '/' + session.id + '/me';

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , stake: function (session, stakeId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        var id = session.id + 'stake.' + stakeId;
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId;

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , stakePhotos: function (session, stakeId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        var id = session.id + 'stake.' + stakeId;
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId + '/photos';

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , ward: function (session, stakeId, wardId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        if (!wardId) {
          throw new Error("no ward id provided");
        }
        var id = session.id + 'stake.' + stakeId + '.ward.' + wardId;
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId + '/wards/' + wardId;

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , wardPhotos: function (session, stakeId, wardId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        if (!wardId) {
          throw new Error("no ward id provided");
        }
        var id = session.id + 'stake.' + stakeId + '.ward.' + wardId + '.photos';
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId + '/wards/' + wardId + '/photos';

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , photoUrl: function (session, photo, size, type) {
        // https://lds.io/api/ldsio/<accountId>/photos/individual/<appScopedId>/<date>/medium/<whatever>.jpg
        return LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id 
          + '/photos/' + (type || photo.type)
          + '/' + getId(photo) + '/' + (photo.updated || photo.updated_at || photo.updatedAt || 'bad-updated-at')
          + '/' + (size || 'medium') + '/' + getId(photo) + '.jpg'
          + '?access_token=' + session.token
          ;
      }
    , guessGender: function (m) {
        var men = [ 'highPriest', 'high_priest', 'highpriest', 'elder', 'priest', 'teacher', 'deacon' ];
        var women = [ 'reliefSociety', 'relief_society', 'reliefsociety', 'laurel', 'miamaid', 'beehive' ];

        if (men.some(function (thing) {
          return m[thing];
        })) {
          return 'male';
        }

        if (women.some(function (thing) {
          return m[thing];
        })) {
          return 'female';
        }
      }
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.api = LdsIoApi;

    return LdsIoApi;
  }])
  ;
'use strict';

angular
  .module('lds.io', ['lds.io.api', 'lds.io.session', 'lds.io.cache', 'lds.io.storage'])
  .service('LdsApi', [
    '$window'
  , 'LdsApiConfig'
  , 'LdsApiStorage'
  , 'LdsApiCache'
  , function ($window, LdsApiConfig, LdsApiStorage, LdsApiCache) {
    var LdsIo = {
      init: function (opts) {
        if ('object' !== typeof opts) {
          $window.alert("[ERROR] you did not supply an options object to LdsApiConfig.init()");
        }

        // TODO delete stale sessions (i.e. on public computers)
        return LdsApiConfig.init(opts).then(function (LdsApiConfig) {
          return LdsApiStorage.get('appVersion').then(function (version) {
            if (version !== LdsApiConfig.appVersion) {
              return LdsApiCache.destroy();
            }
          }, function () {
            if (!LdsApiConfig.developerMode) {
              return LdsApiCache.destroy();
            }
          }).then(function () {
            return LdsApiStorage.set('appVersion', opts.appVersion).then(function () {
              return LdsApiCache.init().then(function () {
                return LdsApiConfig;
              });
            });
          });
        });
      }
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.init = LdsIo.init;

    return LdsIo;
  }])
  ;
