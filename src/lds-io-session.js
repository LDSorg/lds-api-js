(function (exports) {
  'use strict';

  var TherapySession;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

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

  var TLogins = {};
  var TAccounts = {};
  var InternalApi;
  var api;

  function create(opts) {
    var myInstance = {};
    var conf = {
      session: createSession()
    , sessionKey: opts.namespace + '.' + opts.sessionKey // 'session'
    , cache: opts.cache
    , config: opts.config
    , usernameMinLength: opts.usernameMinLength
    , secretMinLength: opts.secretMinLength
    };

    Object.keys(TherapySession.api).forEach(function (key) {
      myInstance[key] = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(conf);
        return TherapySession.api[key].apply(null, args);
      };
    });

    myInstance.getId = TherapySession.getId;
    myInstance.openAuthorizationDialog = opts.invokeLogin || opts.config.invokeLogin;
    myInstance.usernameMinLength = opts.usernameMinLength;
    myInstance.secretMinLength = opts.secretMinLength;
    myInstance.api = api;

    myInstance._conf = conf;

    return myInstance;
  }

  // TODO track and compare granted scopes locally
  function save(conf, updates) {
    // TODO make sure session.logins[0] is most recent
    api.updateSession(conf, updates.login, updates.accounts);

    // TODO should this be done by the LdsApiStorage?
    // TODO how to have different accounts selected in different tabs?
    localStorage.setItem(conf.sessionKey, JSON.stringify(conf.session));
    return Oauth3.PromiseA.resolve(conf.session);
  }

  function restore(conf) {
    // Being very careful not to trigger a false onLogin or onLogout via $watch
    var storedSession;

    if (conf.session.token) {
      return api.sanityCheckAccounts(conf);
      // return Oauth3.PromiseA.resolve(conf.session);
    }

    storedSession = JSON.parse(localStorage.getItem('io.lds.session') || null) || createSession();

    if (storedSession.token) {
      conf.session = storedSession;
      return api.sanityCheckAccounts(conf);
      //return Oauth3.PromiseA.resolve(conf.session);
    } else {
      return Oauth3.PromiseA.reject(new Error("No Session"));
    }
  }

  function destroy(conf) {
    conf.session = createSession();
    localStorage.removeItem(conf.sessionKey);
    return conf.cache.destroy(conf).then(function (session) {
      return session;
    });
  }

  function accounts(conf, login) {
    return Oauth3.request({
      url: conf.config.apiBaseUri + conf.config.apiPrefix + '/accounts'
    , method: 'GET'
    , headers: { 'Authorization': 'Bearer ' + login.token }
    }).then(function (resp) {
      var accounts = resp.data && (resp.data.accounts || resp.data.result || resp.data.results)
        || resp.data || { error: { message: "Unknown Error when retrieving accounts" } }
        ;

      if (accounts.error) { 
        console.error("[ERROR] couldn't fetch accounts", accounts);
        return Oauth3.PromiseA.reject(new Error("Could not verify login:" + accounts.error.message));
      }

      if (!Array.isArray(accounts)) {
        console.error("[Uknown ERROR] couldn't fetch accounts, no proper error", accounts);
        // TODO destroy(conf);
        return Oauth3.PromiseA.reject(new Error("could not verify login")); // destroy(conf);
      }

      return accounts;
    });
  }

  // TODO move to LdsApiLogin?
  function testLoginAccounts(conf, login) {
    // TODO cache this also, but with a shorter shelf life?
    return TherapySession.api.accounts(conf, login).then(function (accounts) {
      return { login: login, accounts: accounts };
    }, function (err) {
      console.error("[Error] couldn't get accounts (might not be linked)");
      console.warn(err);
      return { login: login, accounts: [] };
    });
  }

  function logout(conf) {
    return Oauth3.logout(conf.config.providerUri, {}).then(function () {
      return destroy(conf);
    }, function () {
      return destroy(conf);
    });
  }

  function backgroundLogin(conf, opts) {
    opts = opts || {};

    opts.background = true;
    return TherapySession.api.login(conf, opts);
  }

  function login(conf, opts) {
    var promise;
    var providerUri = conf.config.providerUri;

    opts = opts || {};
    //opts.redirectUri = conf.config.appUri + '/oauth3.html';

    // TODO note that this must be called on a click event
    // otherwise the browser will block the popup
    function forceLogin() {
      opts.appId = conf.config.appId;
      return Oauth3.login(providerUri, opts).then(function (params) {
        return TLogins.getLoginFromTokenParams(conf, providerUri, opts.username, params).then(function (login) {
          return testLoginAccounts(conf, login).then(function (updates) {
            return save(conf, updates);
          });
        });
      });
    }

    if (!opts.force) {
      promise = restore(conf, opts.scope);
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
          return testLoginAccounts(conf, login).then(function (updates) {
            return save(conf, updates);
          });
        });
      });

      return promise;
    }, forceLogin).then(function (session) {
      // testLoginAccounts().then(save);
      return session;
    });
  }

  function requireSession(conf, opts) {
    var promise = Oauth3.PromiseA.resolve(opts);

    // TODO create middleware stack
    return promise.then(function () {
      return TLogins.requireLogin(conf, opts);
    }).then(function () {
      return TAccounts.requireAccount(conf, opts);
    });
      // .then(selectAccount).then(verifyAccount)
  }

  function onLogin(conf, _scope, fn) {
    // This is better than using a promise.notify
    // because the watches will unwatch when the controller is destroyed
    _scope.__stsessionshared__ = conf;
    _scope.$watch('__stsessionshared__.session', function (newValue, oldValue) {
      if (newValue.accountId && oldValue.accountId !== newValue.accountId) {
        fn(conf.session);
      }
    }, true);
  }

  function onLogout(conf, _scope, fn) {
    _scope.__stsessionshared__ = conf;
    _scope.$watch('__stsessionshared__.session', function (newValue, oldValue) {
      if (!newValue.accountId && oldValue.accountId) {
        fn(null);
      }
    }, true);
  }

  
  function getToken(conf, accountId) {
    var session = conf.session;
    var logins = [];
    var login;
    accountId = TAccounts.getId(accountId) || accountId;

    // search logins first because we know we're actually
    // logged in with said login, y'know?
    session.logins.forEach(function (login) {
      login.accounts.forEach(function (account) {
        if (TAccounts.getId(account) === accountId) {
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
  function addAccountsToSession(conf, login, accounts) {
    var now = Date.now();

    login.accounts = accounts.map(function (account) {
      account.addedAt = account.addedAt || now;
      return {
        id: TAccounts.getId(account)
      , addedAt: now
      };
    });

    accounts.forEach(function (newAccount) {
      if (!conf.session.accounts.some(function (other, i) {
        if (TAccounts.getId(other) === TAccounts.getId(newAccount)) {
          conf.session.accounts[i] = newAccount;
          return true;
        }
      })) {
        conf.session.accounts.push(newAccount);
      }
    });

    conf.session.accounts.sort(function (a, b) {
      return b.addedAt - a.addedAt;
    });
  }

  // this should be done on login and logout
  // an old login may have lost or gained accounts
  function pruneAccountsFromSession(conf) {
    var session = conf.session;
    var accounts = session.accounts.slice(0);

    // remember, you can't modify an array while it's in-loop
    // well, you can... but it would be bad!
    accounts.forEach(function (account) {
      if (!session.logins.some(function (login) {
        return login.accounts.some(function (a) {
          return TAccounts.getId(a) === TAccounts.getId(account);
        });
      })) {
        removeItem(session.accounts, account);
      }
    });
  }

  function refreshCurrentAccount(conf) {
    var session = conf.session;

    // select a default session
    if (1 === session.accounts.length) {
      session.accountId = TAccounts.getId(session.accounts[0]);
      session.id = session.accountId;
      session.appScopedId = session.accountId;
      session.token = session.accountId && api.getToken(conf, session.accountId) || null;
      session.userVerifiedAt = session.accounts[0].userVerifiedAt;
      return;
    }

    if (!session.logins.some(function (account) {
      if (session.accountId === TAccounts.getId(account)) {
        session.accountId = TAccounts.getId(account);
        session.id = session.accountId;
        session.appScopedId = session.accountId;
        session.token = session.accountId && api.getToken(conf, session.accountId) || null;
        session.userVerifiedAt = account.userVerifiedAt;
      }
    })) {
      session.accountId = null;
      session.id = null;
      session.appScopedId = null;
      session.token = null;
      session.userVerifiedAt = null;
    }
  }

  function updateSession(conf, login, accounts) {
    var session = conf.session;

    login.addedAt = login.addedAt || Date.now();

    // sanity check login
    if (0 === accounts.length) {
      login.selectedAccountId = null;
    }
    else if (1 === accounts.length) {
      login.selectedAccountId = TAccounts.getId(accounts[0]);
    }
    else if (accounts.length >= 1) {
      login.selectedAccountId = null;
    }
    else {
      throw new Error("[SANITY CHECK FAILED] bad account length'");
    }

    api.addAccountsToSession(conf, login, accounts);

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

    api.pruneAccountsFromSession(conf);

    api.refreshCurrentAccount(conf);

    session.logins.sort(function (a, b) {
      return b.addedAt - a.addedAt;
    });
  }

  function sanityCheckAccounts(conf) {
    var promise;
    var session = conf.session;

    // XXX this is just a bugfix for previously deployed code
    // it probably only affects about 10 users and can be deleted
    // at some point in the future (or left as a sanity check)

    if (session.accounts.every(function (account) {
      if (account.appScopedId) {
        return true;
      }
    })) {
      return Oauth3.PromiseA.resolve(session);
    }

    promise = Oauth3.PromiseA.resolve();
    session.logins.forEach(function (login) {
      promise = promise.then(function () {
        return testLoginAccounts(conf, login).then(function (updates) {
          return save(conf, updates);
        });
      });
    });

    return promise.then(function (session) {
      return session;
    }, function () {
      // this is just bad news...
      return conf.cache.destroy(conf).then(function () {
        window.alert("Sorry, but an error occurred which can only be fixed by logging you out"
          + " and refreshing the page.\n\nThis will happen automatically.\n\nIf you get this"
          + " message even after the page refreshes, please contact support@ldsconnectorg."
        );
        window.location.reload();
        return Oauth3.PromiseA.reject(new Error("A session error occured. You must log out and log back in."));
      });
    });
  }

  // TODO is this more logins or accounts or session? session?
  function handleOrphanLogins(conf) {
    var promise;
    var session = conf.session;

    promise = Oauth3.PromiseA.resolve();

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
            return TAccounts.attachLoginToAccount(conf, session.accounts[0], login);
          });
        }
      });
    }

    return promise.then(function () {
      return session;
    });
  }

  TLogins.getLoginFromTokenParams = function (conf, providerUri, username, params) {
    var err;

    if (!params || !(params.access_token || params.accessToken || params.token)) {
      err = new Error(params.error_description || "no access token granted");
      err.code = params.error || "E_NO_GRANT";
      return Oauth3.PromiseA.reject();
    }

    return Oauth3.PromiseA.resolve({
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

  TLogins.requireLogin = function (conf, opts) {
    return restore(conf).then(function (session) {
      return session;
    }, function (/*err*/) {
      
      return conf.config.invokeLogin(opts);
    });
  };

  TLogins.softTestUsername = function (conf, username) {
    if ('string' !== typeof username) {
      throw new Error("[Developer Error] username should be a string");
    }

    if (!/^[0-9a-z\.\-_]+$/i.test(username)) {
      // TODO validate this is true on the server
      return new Error("Only alphanumeric characters, '-', '_', and '.' are allowed in usernames.");
    }

    if (username.length < conf.usernameMinLength) {
      // TODO validate this is true on the server
      return new Error('Username too short. Use at least '
        + conf.usernameMinLength + ' characters.');
    }

    return true;
  };

  TLogins.hardTestUsername = function (conf, username) {
    // TODO support username as type
    var type = null;

    // TODO update backend to /api/ldsio/username/:username?
    return Oauth3.request({
      url: conf.config.apiBaseUri + '/api' + '/logins/check/' + type + '/' + username + '?camel=true'
    , method: 'GET'
    }).then(function (result) {
      if (!result.data.exists) {
        return Oauth3.PromiseA.reject(new Error("username does not exist"));
      }
    }, function (err) {
      if (/does not exist/.test(err.message)) {
        return Oauth3.PromiseA.reject(err);
      }

      throw err;
    });
  };

  TAccounts.getId = function (o, p) {
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

  TAccounts.realCreateAccount = function (conf, login) {
    return Oauth3.request({
      url: conf.config.apiBaseUri + '/api' + '/accounts' + '?camel=true'
    , method: 'POST'
    , data: { account: {}
      , logins: [{
          // TODO make appScopedIds even for root app
          id: login.appScopedId || login.app_scoped_id || login.loginId || login.login_id || login.id 
        , token: login.token || login.accessToken || login.accessToken
        }]
      }
    , headers: {
        Authorization: 'Bearer ' + login.token
      }
    }).then(function (resp) {
      return resp.data;
    }, function (err) {
      return Oauth3.PromiseA.reject(err);
    });
  };

  // TODO move to LdsApiLogin ?
  TAccounts.attachLoginToAccount = function (conf, account, newLogin) {
    var url = conf.config.apiBaseUri + '/api' + '/accounts/' + account.appScopedId + '/logins' + '?camel=true';
    var token = TherapySession.api.getToken(conf, account);

    return Oauth3.request({
      url: url
    , method: 'POST'
    , data: { logins: [{
        id: newLogin.appScopedId || newLogin.app_scoped_id || newLogin.loginId || newLogin.login_id || newLogin.id 
      , token: newLogin.token || newLogin.accessToken || newLogin.access_token
      }] }
    , headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (resp) {
      if (!resp.data) {
        return Oauth3.PromiseA.reject(new Error("no response when linking login to account"));
      }
      if (resp.data.error) {
        return Oauth3.PromiseA.reject(resp.data.error);
      }

      // return nothing
    }, function (err) {
      console.error('[Error] failed to attach login to account');
      console.warn(err.message);
      console.warn(err.stack);
      return Oauth3.PromiseA.reject(err);
    });
  };

  TAccounts.requireAccountHelper = function (conf) {
    var session = conf.session;
    var promise;
    var ldslogins;
    var err;

    if (session.accounts.length) {
      return Oauth3.PromiseA.resolve(session);
    }

    if (!session.logins.length) {
      console.error("doesn't have any logins");
      return Oauth3.PromiseA.reject(new Error("[Developer Error] do not call requireAccount when you have not called requireLogin."));
    }

    ldslogins = session.logins.filter(function (login) {
      return 'ldsaccount' === login.loginType;
    });

    if (!ldslogins.length) {
      console.error("no lds accounts");
      err = new Error("Login with your LDS Account at least once before linking other accounts.");
      err.code = "E_NO_LDSACCOUNT";
      return Oauth3.PromiseA.reject(err);
    }

    // at this point we have a valid ldslogin, but still no ldsaccount
    promise = Oauth3.PromiseA.resolve();

    ldslogins.forEach(function (login) {
      promise = promise.then(function () {
        return TAccounts.realCreateAccount(conf, login).then(function (account) {
          login.accounts.push(account);
          return save({ login: login, accounts: login.accounts });
        });
      });
    });

    return promise.then(function (session) {
      return session;
    });
  };

  TAccounts.requireAccount = function (conf) {
    return TAccounts.requireAccountHelper(conf).then(function () {
      return api.handleOrphanLogins(conf);
    });
  };

  // TODO move to LdsApiAccount ?
  TAccounts.cloneAccount = function (conf, account) {
    // retrieve the most fresh token of all associated logins
    var token = TherapySession.api.getToken(conf, account);
    var id = TAccounts.getId(account);
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
  TAccounts.selectAccount = function (conf, accountId) {
    var session = conf.session;
    // needs to return the account with a valid login
    var account;
    if (!accountId) {
      accountId = session.accountId;
    }

    if (!session.accounts.some(function (a) {
      if (!accountId || accountId === TAccounts.getId(a)) {
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

    account = TAccounts.cloneAccount(conf, account);
    session.accountId = account.accountId;
    session.id = account.accountId;
    session.appScopedId = account.accountId;
    session.token = account.token;

    // XXX really?
    conf.account = account;
    return account;
  };

  InternalApi = {
    accounts: accounts
  , login: login
  , getToken: getToken
  };

  api = {
    save: save
  , restore: restore
  , checkSession: restore
  , destroy: destroy
  , require: requireSession
  , accounts: accounts
  , requireSession: requireSession
  , getToken: getToken
  , addAccountsToSession: addAccountsToSession
  , pruneAccountsFromSession: pruneAccountsFromSession
  , refreshCurrentAccount: refreshCurrentAccount
  , updateSession: updateSession
  , sanityCheckAccounts: sanityCheckAccounts
  , handleOrphanLogins: handleOrphanLogins
  , validateUsername: TLogins.softTestUsername
  , checkUsername: TLogins.hardTestUsername
  , login: login
      // this is intended for the resourceOwnerPassword strategy
  , backgroundLogin: backgroundLogin
  , logout: logout
  , onLogin: onLogin
  , onLogout: onLogout
  , requireAccount: TAccounts.requireAccount
  , selectAccount: TAccounts.selectAccount // TODO nix this 'un
  , account: TAccounts.selectAccount 
  , testLoginAccounts: testLoginAccounts
  , cloneAccount: TAccounts.cloneAccount
  //, getId: TAccounts.getId
  };

  TherapySession = {
    create: create
  , api: api
  , getId: TAccounts.getId
  };

  // XXX
  // These are underscore prefixed because they aren't official API yet
  // I need more time to figure out the proper separation
  TherapySession._logins = TLogins;
  TherapySession._accounts = TAccounts;

  exports.TherapySession = TherapySession.TherapySession = TherapySession;

  if ('undefined' !== typeof module) {
    module.exports = TherapySession;
  }
}('undefined' !== typeof exports ? exports : window));
