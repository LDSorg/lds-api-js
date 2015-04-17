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

    //
    // Pure convenience / utility funcs
    //
    function createSession() {
      return { logins: [], accounts: [] };
    }
    function removeItem(array, item) {
      var i = array.indexOf(item);

      if (-1 !== i) {
        array.splice(i, 1);
      }
    }

    var shared = { session: createSession() };
    var LdsIoSession;
    var LdsIoLogins = {};
    var LdsIoAccounts = {};
    var api = {};

    // TODO track and compare granted scopes locally
    function save(updates) {
      // TODO make sure session.logins[0] is most recent
      api.updateSession(shared.session, updates.login, updates.accounts);

      // TODO should this be done by the LdsApiStorage?
      // TODO how to have different accounts selected in different tabs?
      localStorage.setItem('io.lds.session', JSON.stringify(shared.session));
      return $q.when(shared.session);
    }

    function restore() {
      // Being very careful not to trigger a false onLogin or onLogout via $watch
      var storedSession;

      if (shared.session.token) {
        return api.sanityCheckAccounts(shared.session);
        // return $q.when(shared.session);
      }

      storedSession = JSON.parse(localStorage.getItem('io.lds.session') || null) || createSession();

      if (storedSession.token) {
        shared.session = storedSession;
        return api.sanityCheckAccounts(shared.session);
        //return $q.when(shared.session);
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

    function accounts(login) {
      return $http.get(
        LdsApiConfig.apiBaseUri + LdsApiConfig.apiPrefix + '/accounts' + '?camel=true'
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

        return accounts;
      });
    }

    // TODO move to LdsApiLogin?
    function testLoginAccounts(login) {
      // TODO cache this also, but with a shorter shelf life?
      return LdsIoSession.accounts(login).then(function (accounts) {
        return { login: login, accounts: accounts };
      }, function (err) {
        console.error("[Error] couldn't get accounts (might not be linked)");
        console.warn(err);
        return { login: login, accounts: [] };
      });
    }

    function logout() {
      return Oauth3.logout(LdsApiConfig.providerUri, {}).then(function () {
        return destroy();
      }, function () {
        return destroy();
      });
    }

    function backgroundLogin(opts) {
      opts = opts || {};

      opts.background = true;
      return LdsIoSession.login(opts);
    }

    function login(opts) {
      var promise;
      var providerUri = LdsApiConfig.providerUri;

      opts = opts || {};
      //opts.redirectUri = LdsApiConfig.appUri + '/oauth3.html';

      // TODO note that this must be called on a click event
      // otherwise the browser will block the popup
      function forceLogin() {
        opts.appId = LdsApiConfig.appId;
        return Oauth3.login(providerUri, opts).then(function (params) {
          return LdsIoLogins.getLoginFromTokenParams(providerUri, opts.username, params).then(function (login) {
            return testLoginAccounts(login).then(save);
          });
        });
      }

      if (!opts.force) {
        promise = restore(opts.scope);
      } else {
        promise = Oauth3.PromiseA.reject();
      }

      // TODO check for scope in session
      return promise.then(function (session) {
        if (!session.appScopedId || opts && opts.force) {
          return forceLogin();
        }

        var promise = Oauth3.PromiseA.resolve();

        // TODO check expirey
        session.logins.forEach(function (login) {
          promise = promise.then(function () {
            return testLoginAccounts(login).then(save);
          });
        });

        return promise;
      }, forceLogin).then(function (session) {
        // testLoginAccounts().then(save);
        return session;
      });
    }

    function requireSession(opts) {
      var promise = $q.when(opts);

      // TODO create middleware stack
      return promise.then(LdsIoLogins.requireLogin).then(LdsIoAccounts.requireAccount);
        // .then(selectAccount).then(verifyAccount)
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

    api.getToken = function (session, accountId) {
      var logins = [];
      var login;
      accountId = LdsIoAccounts.getId(accountId) || accountId;

      // search logins first because we know we're actually
      // logged in with said login, y'know?
      session.logins.forEach(function (login) {
        login.accounts.forEach(function (account) {
          if (LdsIoAccounts.getId(account) === accountId) {
            logins.push(login);
          }
        });
      });

      login = logins.sort(function (a, b) {
        // b - a // most recent first
        return (new Date(b.expiresAt).value || 0) - (new Date(a.expiresAt).value || 0);
      })[0];

      return login && login.token;
    };

    // this should be done at every login
    // even an existing login may gain new accounts
    api.addAccountsToSession = function (session, login, accounts) {
      var now = Date.now();

      login.accounts = accounts.map(function (account) {
        account.addedAt = account.addedAt || now;
        return {
          id: LdsIoAccounts.getId(account)
        , addedAt: now
        };
      });

      accounts.forEach(function (newAccount) {
        if (!session.accounts.some(function (other, i) {
          if (LdsIoAccounts.getId(other) === LdsIoAccounts.getId(newAccount)) {
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
    };

    // this should be done on login and logout
    // an old login may have lost or gained accounts
    api.pruneAccountsFromSession = function (session) {
      var accounts = session.accounts.slice(0);

      // remember, you can't modify an array while it's in-loop
      // well, you can... but it would be bad!
      accounts.forEach(function (account) {
        if (!session.logins.some(function (login) {
          return login.accounts.some(function (a) {
            return LdsIoAccounts.getId(a) === LdsIoAccounts.getId(account);
          });
        })) {
          removeItem(session.accounts, account);
        }
      });
    };

    api.refreshCurrentAccount = function(session) {
      // select a default session
      if (1 === session.accounts.length) {
        session.accountId = LdsIoAccounts.getId(session.accounts[0]);
        session.id = session.accountId;
        session.appScopedId = session.accountId;
        session.token = session.accountId && api.getToken(session, session.accountId) || null;
        session.userVerifiedAt = session.accounts[0].userVerifiedAt;
        return;
      }

      if (!session.logins.some(function (account) {
        if (session.accountId === LdsIoAccounts.getId(account)) {
          session.accountId = LdsIoAccounts.getId(account);
          session.id = session.accountId;
          session.appScopedId = session.accountId;
          session.token = session.accountId && api.getToken(session, session.accountId) || null;
          session.userVerifiedAt = account.userVerifiedAt;
        }
      })) {
        session.accountId = null;
        session.id = null;
        session.appScopedId = null;
        session.token = null;
        session.userVerifiedAt = null;
      }
    };

    api.updateSession = function (session, login, accounts) {
      login.addedAt = login.addedAt || Date.now();

      // sanity check login
      if (0 === accounts.length) {
        login.selectedAccountId = null;
      }
      else if (1 === accounts.length) {
        login.selectedAccountId = LdsIoAccounts.getId(accounts[0]);
      }
      else if (accounts.length >= 1) {
        login.selectedAccountId = null;
      }
      else {
        throw new Error("[SANITY CHECK FAILED] bad account length'");
      }

      api.addAccountsToSession(session, login, accounts);

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

      api.pruneAccountsFromSession(session);

      api.refreshCurrentAccount(session);

      session.logins.sort(function (a, b) {
        return b.addedAt - a.addedAt;
      });
    };

    api.sanityCheckAccounts = function (session) {
      var promise;

      // XXX this is just a bugfix for previously deployed code
      // it probably only affects about 10 users and can be deleted
      // at some point in the future (or left as a sanity check)

      if (session.accounts.every(function (account) {
        if (account.appScopedId) {
          return true;
        }
      })) {
        return $q.when(session);
      }

      promise = $q.when();
      session.logins.forEach(function (login) {
        promise = promise.then(function () {
          return testLoginAccounts(login).then(save);
        });
      });

      return promise.then(function (session) {
        return session;
      }, function () {
        // this is just bad news...
        return LdsApiCache.destroy().then(function () {
          $window.alert("Sorry, but an error occurred which can only be fixed by logging you out"
            + " and refreshing the page.\n\nThis will happen automatically.\n\nIf you get this"
            + " message even after the page refreshes, please contact support@ldsconnectorg."
          );
          $window.location.reload();
          return $q.reject(new Error("A session error occured. You must log out and log back in."));
        });
      });
    };

    // TODO is this more logins or accounts or session? session?
    api.handleOrphanLogins = function (session) {
      var promise;

      promise = $q.when();

      if (session.logins.some(function (login) {
        return !login.accounts.length;
      })) {
        if (session.accounts.length > 1) {
          throw new Error("[Not Implemented] can't yet attach new social logins when more than one lds account is in the session."
            + " Please logout and sign back in with your LDS.org Account only. Then attach the other login.");
        }
        session.logins.forEach(function (login) {
          if (!login.accounts.length) {
            promise = promise.then(function () {
              return LdsIoAccounts.attachLoginToAccount(session.accounts[0], login);
            });
          }
        });
      }

      return promise.then(function () {
        return session;
      });
    };

    LdsIoLogins.usernameMinLength = 4;
    LdsIoLogins.usernameMinLength = 8;

    LdsIoLogins.getLoginFromTokenParams = function (providerUri, username, params) {
      var err;

      if (!params || !(params.access_token || params.accessToken || params.token)) {
        err = new Error(params.error_description || "no access token granted");
        err.code = params.error || "E_NO_GRANT";
        return $q.reject();
      }

      return $q.when({
        token: params.access_token || params.accessToken || params.token
      , expiresAt: params.expires_at || params.expiresAt
          || Date.now() + (1 * 60 * 60 * 1000) // TODO
      , appScopedId: params.app_scoped_id || params.appScopedId
          || null
      , loginId: params.loginId || params.login_id
      , accountId: params.accountId || params.account_id
          // TODO app_name in oauth3.json "AJ on Facebook"
      , comment: (username && (username + ' via ') || '')
          + (providerUri.replace(/^(https?:\/\/)?(www\.)?/, ''))
      , loginType: username && 'username'
      , providerUri: providerUri.replace(/^(https?:\/\/)?(www\.)?/, 'https://')
      });
    };

    LdsIoLogins.requireLogin = function (opts) {
      return restore().then(function (session) {
        return session;
      }, function (/*err*/) {
        
        return LdsApiConfig.invokeLogin(opts);
      });
    };

    LdsIoLogins.softTestUsername = function (ldsaccount) {
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
    };

    LdsIoLogins.hardTestUsername = function (ldsaccount) {
      // TODO support ldsaccount as type
      var type = null;

      // TODO update backend to /api/ldsio/username/:ldsaccount?
      return $http.get(
        LdsApiConfig.apiBaseUri + '/api' + '/logins/check/' + type + '/' + ldsaccount + '?camel=true'
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
    };

    LdsIoLogins.loginWithResourceOwnerPassword = function (username, passphrase, opts) {
      return Oauth3.requests.resourcePasswordOwner(
        LdsApiConfig.providerUri
      , username
      , passphrase
      , opts.scope
      , LdsApiConfig.appId || LdsApiConfig.appUri // (this location)
      ).then(function (result) {
        // TODO recase
        var login = LdsIoLogins.getLoginFromTokenParams(LdsApiConfig.providerUri, username, result.data);

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
    };

    LdsIoAccounts.getId = function (o, p) {
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
    };

    LdsIoAccounts.realCreateAccount = function (login) {
      return $http.post(
        LdsApiConfig.apiBaseUri + '/api' + '/accounts' + '?camel=true'
      , { account: {}
        , logins: [{
            // TODO make appScopedIds even for root app
            id: login.appScopedId || login.app_scoped_id || login.loginId || login.login_id || login.id 
          , token: login.token || login.accessToken || login.accessToken
          }]
        }
      , { headers: {
            Authorization: 'Bearer ' + login.token
          }
        }
      ).then(function (resp) {
        return resp.data;
      }, function (err) {
        return $q.reject(err);
      });
    };

    // TODO move to LdsApiLogin ?
    LdsIoAccounts.attachLoginToAccount = function (account, newLogin, oldApi) {
      if (oldApi) {
        console.warn("Deprecated API. New function signature is fn(login, account)");
        account = newLogin;
        newLogin = oldApi;
      }

      var url = LdsApiConfig.apiBaseUri + '/api' + '/accounts/' + account.appScopedId + '/logins' + '?camel=true';
      var token = LdsIoSession.getToken(account);

      return $http.post(
        url
      , { logins: [{
          id: newLogin.appScopedId || newLogin.app_scoped_id || newLogin.loginId || newLogin.login_id || newLogin.id 
        , token: newLogin.token || newLogin.accessToken || newLogin.access_token
        }] }
      , { headers: { 'Authorization': 'Bearer ' + token } }
      ).then(function (resp) {
        if (!resp.data) {
          return $q.reject(new Error("no response when linking login to account"));
        }
        if (resp.data.error) {
          return $q.reject(resp.data.error);
        }

        // return nothing
      }, function (err) {
        console.error('[Error] failed to attach login to account');
        console.warn(err.message);
        console.warn(err.stack);
        return $q.reject(err);
      });
    };

    LdsIoAccounts.requireAccountHelper = function () {
      var session = LdsIoSession.singletons.shared.session;
      var promise;
      var ldslogins;
      var err;

      if (session.accounts.length) {
        return $q.when(session);
      }

      if (!session.logins.length) {
        console.error("doesn't have any logins");
        return $q.reject(new Error("[Developer Error] do not call requireAccount when you have not called requireLogin."));
      }

      ldslogins = session.logins.filter(function (login) {
        return 'ldsaccount' === login.loginType;
      });

      if (!ldslogins.length) {
        console.error("no lds accounts");
        err = new Error("Login with your LDS Account at least once before linking other accounts.");
        err.code = "E_NO_LDSACCOUNT";
        return $q.reject(err);
      }

      // at this point we have a valid ldslogin, but still no ldsaccount
      promise = $q.when();

      ldslogins.forEach(function (login) {
        promise = promise.then(function () {
          return LdsIoAccounts.realCreateAccount(login).then(function (account) {
            login.accounts.push(account);
            return save({ login: login, accounts: login.accounts });
          });
        });
      });

      return promise.then(function (session) {
        return session;
      });
    };

    LdsIoAccounts.requireAccount = function () {
      return LdsIoAccounts.requireAccountHelper().then(api.handleOrphanLogins);
    };

    // TODO move to LdsApiAccount ?
    LdsIoAccounts.cloneAccount = function (account) {
      // retrieve the most fresh token of all associated logins
      var token = LdsIoSession.getToken(account);
      var id = LdsIoAccounts.getId(account);
      // We don't want to modify the original object and end up
      // with potentially whole stakes in the local storage session key
      account = JSON.parse(JSON.stringify(account));

      account.token = token;
      account.accountId = account.accountId || account.appScopedId || id;
      account.appScopedId = account.appScopedId || id;

      return account;
    };

    // TODO check for account and account create if not exists in requireSession
    // TODO move to LdsApiAccount ?
    LdsIoAccounts.selectAccount = function (accountId) {
      var session = LdsIoSession.singletons.shared.session;
      // needs to return the account with a valid login
      var account;
      if (!accountId) {
        accountId = session.accountId;
      }

      if (!session.accounts.some(function (a) {
        if (!accountId || accountId === LdsIoAccounts.getId(a)) {
          account = a;
          return true;
        }
      })) {
        account = session.accounts[0];
      }

      if (!account) {
        console.error("Developer Error: require session before selecting an account");
        console.error(session);
        throw new Error("Developer Error: require session before selecting an account");
      }

      account = LdsIoAccounts.cloneAccount(account);
      session.accountId = account.accountId;
      session.id = account.accountId;
      session.appScopedId = account.accountId;
      session.token = account.token;

      shared.account = account;
      return account;
    };

    LdsIoSession = {
      usernameMinLength: LdsIoLogins.usernameMinLength
    , secretMinLength: LdsIoLogins.usernameMinLength
    , validateUsername: LdsIoLogins.softTestUsername
    , checkUsername: LdsIoLogins.hardTestUsername

    , accounts: accounts
    , restore: restore
    , checkSession: restore
    , destroy: destroy
    , login: login

        // this is intended for the resourceOwnerPassword strategy
    , openAuthorizationDialog: LdsApiConfig.invokeLogin
    , backgroundLogin: backgroundLogin
    , logout: logout
    , onLogin: onLogin
    , onLogout: onLogout
    , requireSession: requireSession

    , requireAccount: LdsIoAccounts.requireAccount
    , selectAccount: LdsIoAccounts.selectAccount // TODO nix this 'un
    , account: LdsIoAccounts.selectAccount 
    , getId: LdsIoAccounts.getId
    , cloneAccount: LdsIoAccounts.cloneAccount

    , singletons: {
        save: save
      , restore: restore
      //, checkSession: restore
      , destroy: destroy
      , require: requireSession
      //, requireSession: requireSession
      , shared: shared
      }
    , debug: {
        testLoginAccounts: testLoginAccounts
      , save: save
      , shared: shared
      }
    };

    // Wrap API
    //
    // All of these functions take the session as the first param because
    // that makes it easier to drop down and test from the commandline,
    // however, it's a better user experience to treat them as singletons
    Object.keys(api).forEach(function (key) {
      LdsIoSession[key] = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(shared.session);
        return api[key].apply(null, args);
      };
    });

    window.LdsIo = window.LdsIo || {};

    // XXX
    // These are underscore prefixed because they aren't official API yet
    // I need more time to figure out the proper separation
    window.LdsIo._logins = LdsIoLogins;
    window.LdsIo._accounts = LdsIoAccounts;
    window.LdsIo.session = LdsIoSession;

    return LdsIoSession;
  }]);
