(function (exports) {
  'use strict';

  var CannedStorage;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

  function create(opts) {
    var myInstance = {};
    var conf = {
      prefix: opts.namespace + '.'
    };

    Object.keys(CannedStorage.api).forEach(function (key) {
      myInstance[key] = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(conf);
        return CannedStorage.api[key].apply(null, args);
      };
    });

    return myInstance;
  }

  var api = {
    init: function (/*conf*/) {
      // noop, reserved for future use
      return Oauth3.PromiseA.resolve();
    }
  , get: function (conf, key) {
      var val;

      try {
        val = JSON.parse(localStorage.getItem(conf.prefix + key) || null);
      } catch(e) {
        console.error("couldn't parse " + conf.prefix + key, localStorage.getItem(conf.prefix + key));
        localStorage.removeItem(conf.prefix + key);
        val = null;
      }

      // just because sometimes it happens...
      if ('undefined' === val || 'null' === val) {
        console.warn("got undefined for " + conf.prefix + key);
        val = null;
      }

      return val && Oauth3.PromiseA.resolve(val) || Oauth3.PromiseA.reject();
    }
  , set: function (conf, key, val) {
      try {
        localStorage.setItem(conf.prefix + key, JSON.stringify(val));
        return Oauth3.PromiseA.resolve();
      } catch(e) {
        console.error("couldn't stringify " + conf.prefix + key, val);
        return Oauth3.PromiseA.reject(e);
      }
    }
  , remove: function (conf, key) {
      localStorage.removeItem(conf.prefix + key);
      return Oauth3.PromiseA.resolve();
    }
  , clear: function (conf, account) {
      var re;
      var keys = [];
      var i;
      var key;

      re = new RegExp('^'
        // See http://stackoverflow.com/a/6969486/151312 for regexp escape explanation
        + conf.prefix.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
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

      return Oauth3.PromiseA.resolve();
    }
  };

  CannedStorage = {
    create: create
  , api: api
  };
  exports.CannedStorage = CannedStorage.CannedStorage = CannedStorage;

  if ('undefined' !== typeof module) {
    module.exports = CannedStorage;
  }
}('undefined' !== typeof exports ? exports : window));
(function (exports) {
  'use strict';

  var Oauth3Config;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

  function create(instanceOpts) {
    var me = {};
    var storage = instanceOpts.storage;

    me.defaults = instanceOpts.defaults;
    me.libPrefix = instanceOpts.libPrefix;

    me.init = function (opts) {
      // TODO get multiple keys at once
      return Oauth3.PromiseA.all([
        storage.get('dev.providerUri').then(function (val) {
          me.developerMode = true;
          me.providerUri = val;
          me.providerUriSet = true;

        }, function () {
          // ignore
        })
      , storage.get('dev.apiBaseUri').then(function (val2) {
          me.apiBaseUri = val2;
          me.apiBaseUriSet = true;

        }, function () {
          // ignore
        })
      ]).then(function () {
        Object.keys(opts).forEach(function (key) {
          if ('appSecret' === key) {
            window.alert("[ERROR] appSecret must never be used in a client (browser, mobile, or desktop)");
            return;
          }
          me[key] = opts[key];
        });

        Object.keys(me.defaults).forEach(function (key) {
          if ('undefined' === typeof me[key]) {
            me[key] = me.defaults[key];
          }
        });

        if (!me.appId) {
          // TODO auto-register oauth3
          console.error("Please set `LdsApiConfig.appId`, try this:");
          console.log("    TEST_ID_9e78b54c44a8746a5727c972");
          window.alert("[ERROR] `LdsApiConfig.appId` not set.\nTest with 'TEST_ID_9e78b54c44a8746a5727c972'");
        }

        console.log('');
        if (!me.providerUriSet) {
          console.info("Why, hello there Latter-Day Developer! Would you like to test against the beta server?");
          console.log("    " + me.libPrefix + "LdsIo.storage.set('dev.providerUri', 'https://beta.ldsconnect.org')");
          console.log("    " + me.libPrefix + "LdsIo.storage.set('dev.apiBaseUri', 'https://beta.lds.io')");
          console.log('');
        }
        if (me.providerUriSet || me.apiBaseUriSet) {
          console.info("You're in Developer Mode! :-)");
          console.log("    UI:  " + me.providerUri);
          console.log("    API: " + me.apiBaseUri);
          console.log('');

          console.log("Want to switch back to production mode?");
          console.log("    " + me.libPrefix + "LdsIo.storage.remove('dev.providerUri'); "
            + me.libPrefix + "LdsIo.storage.remove('dev.apiBaseUri');");
          console.log('');
        }
      }).then(function () {
        // Note: it is possible for this to fail (i.e. when offline or providerUri is bad).
        // Note: for development you can pass in opts.directives (in the format of oauth3.json)
        return Oauth3.discover(me.providerUri, opts).then(function () {
          return me;
        });
      });
    };

    return me;
  }

  Oauth3Config = {
    create: create
  };
  exports.Oauth3Config = Oauth3Config.Oauth3Config = Oauth3Config;

  if ('undefined' !== typeof module) {
    module.exports = Oauth3Config;
  }
}('undefined' !== typeof exports ? exports : window));
(function (exports) {
  'use strict';

    var JohnnyCache;
    var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

    /*
    function batchApiCall(ids, url, handler) {
      // freshIds, staleIds = ids.filter()
      // get url but don't cache
      handler(result, function (id, data) {
        // put id into result set
      });
    }
    */

    function create(opts) {
      var myInstance = {};
      var conf = {
        config: opts.config
      , storage: opts.storage
      //, caches: {}
      };

      Object.keys(JohnnyCache.api).forEach(function (key) {
        myInstance[key] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(conf);
          return JohnnyCache.api[key].apply(null, args);
        };
      });

      return myInstance;
    }

    function init(conf) {
      return conf.storage.get('caches').then(function (result) {
        conf.caches = result;
      }, function () {
        conf.caches = {};
      });
    }

    function read(conf, id, realFetch, opts) {
      var refreshWait = conf.config.refreshWait;
      var uselessWait = conf.config.uselessWait;
      var fresh;
      var usable;
      var now;
      var promise;

      function fetch() {
        return realFetch().then(function (result) {
          if ('string' === typeof result) {
            // TODO explicit option for strings
            return Oauth3.PromiseA.reject("expected json, but got a string, which is probably an error");
          }
          return fin(result);
        });
      }

      function fin(value) {
        promise = null;
        conf.caches[id] = Date.now();
        return conf.storage.set(id, value).then(function () {
          return conf.storage.set('caches', conf.caches).then(function () {
            return { updated: conf.caches[id], value: value, stale: false };
          });
        });
      }

      if (conf.caches[id] && !(opts && opts.expire)) {
        now = Date.now();
        usable = now - conf.caches[id] < uselessWait;
        fresh = now - conf.caches[id] < refreshWait;
        if (!fresh) {
          promise = fetch();
        }
      }

      return conf.storage.get(id).then(function (result) {
        if ('string' === typeof result) {
          // TODO explicit option
          return (promise || fetch());
        }
        if (usable) {
          return Oauth3.PromiseA.resolve({ updated: conf.caches[id], value: result, stale: !fresh });
        } else {
          return (promise || fetch());
        }
      }, function () {
        return (promise || fetch());
      });
    }

    function destroy(conf) {
      conf.caches = {};
      return conf.storage.clear();
    }

    JohnnyCache = {
      create: create
    , api: {
        init: init
      , read: read
      , destroy: destroy
      , clear: destroy
      }
    };
    exports.JohnnyCache = JohnnyCache.JohnnyCache = JohnnyCache;

    if ('undefined' !== typeof module) {
      module.exports = JohnnyCache;
    }
}('undefined' !== typeof exports ? exports : window));
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
(function (exports) {
  'use strict';

  var LdsIoApi;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

  function realGet(conf, account, id, url) {
    if (conf.promisesMap[id]) {
      return conf.promisesMap[id];
    }

    conf.promisesMap[id] = Oauth3.request({
      url: url
    , method: 'GET'
    , headers: { 'Authorization': 'Bearer ' + account.token }
    }).then(function (resp) {
      delete conf.promisesMap[id];

      if (!resp.data) {
        // This seems to happen on abort...
        return Oauth3.PromiseA.reject("no data returned, the request may have been aborted");
        //window.alert("[SANITY FAIL] '" + url + "' returned nothing (not even an error)");
        //return;
      }

      if (resp.data.error) {
        console.error('[ERROR]', url);
        console.error(resp.data);
        window.alert("[DEVELOPER ERROR] '" + url + "' returned an error (is the url correct? did you check login first?)");
        return;
      }


      return resp.data;
    }, function (err) {
      delete conf.promisesMap[id];

      return Oauth3.PromiseA.reject(err);
    });

    return conf.promisesMap[id];
  }

  function promiseApiCall(conf, account, id, url, opts) {
    opts = opts || {};
    return conf.cache.read(id, function () {
      return new Oauth3.PromiseA(function (resolve, reject) {
        var kotoken = setTimeout(function () {
          if (opts.tried) {
            reject(new Error("timed out (twice) when attempting to get data"));
            return;
          }

          opts.tried = true;
          return promiseApiCall(account, id, url, opts).then(resolve, reject);
        }, opts.tried && 16000 || 8000); 
        //opts.tried && 16000 || 8000 

        realGet(conf, account, id, url).then(function (data) {
          clearTimeout(kotoken);
          resolve(data);
        }, function (err) {
          clearTimeout(kotoken);
          reject(err);
        });
      });
    }, opts).then(function (data) {
      // TODO, just data.value (after bugfix)
      return data.value && data.value.value || data.value;
    });
  }

  function getLeadership(members) {
    var honchos = { membershipClerks: [] };

    members.forEach(function (member) {
      if (!Array.isArray(member.callings)) {
        // each member should have an array of callings, even if empty
        // so this is just a sanity check
        return;
      }

      member.callings.forEach(function (calling) {
        if ("Bishopric" === calling.name || 4 === calling.typeId) {
          honchos.bishop = member;
        }
        if ("Bishopric First Counselor" === calling.name || 54 === calling.typeId) {
          honchos.firstCounselor = member;
        }
        if ("Bishopric Second Counselor" === calling.name || 55 === calling.typeId) {
          honchos.secondCounselor = member;
        }
        if ("Ward Executive Secretary" === calling.name || 56 === calling.typeId) {
          honchos.executiveSecretary = member;
        }
        if ("Ward Clerk" === calling.name || 57 === calling.typeId) {
          honchos.clerk = member;
        }
        /*
        if ("Ward Assistant Clerk" === calling.name || 58 === calling.typeId) {
          honchos.assistant = member;
        }
        */
        if ("Ward Assistant Clerk--Membership" === calling.name || 787 === calling.typeId) {
          honchos.membershipClerks.push(member);
        }
      });
    });

    return honchos;
  }

  // TODO wrap with promises so that if a call is made before a prior call finishes,
  // it's just one call
  LdsIoApi = {
    create: function create(conf) {
      // conf = { config, cache, session }
      conf.promisesMap = {};
      var myInstance = {};

      myInstance.accountsWithProfiles = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(conf);
        return LdsIoApi.accountsWithProfiles.apply(null, args);
      };
      myInstance.guessGender = LdsIoApi.guessGender;

      Object.keys(LdsIoApi.api).forEach(function (key) {
        LdsIoApi[key] = LdsIoApi.api[key];
      });

      Object.keys(LdsIoApi.api).forEach(function (key) {
        myInstance[key] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(conf);
          return LdsIoApi.api[key].apply(null, args);
        };
      });

      return myInstance;
    }
  , accountsWithProfiles: function accountsWithProfiles(conf, accounts) {
      // TODO conf.session.get()
      var session = conf.session._conf.session;
      var promises = [];
      accounts = accounts || [];

      session.accounts.forEach(function (account) {
        account = conf.session.cloneAccount(account);

        promises.push(LdsIoApi.api.profile(conf, account).then(function (profile) {
          // TODO get a slim profile?
          account.profile = profile; 
          accounts.push(account);
        }));
      });

      return Oauth3.PromiseA.all(promises).then(function () {
        // get the most recently added account as the first in the list
        // (they should already be sorted this way)
        accounts.sort(function (a, b) {
          return new Date(b.addedAt).valueOf() - new Date(a.addedAt).valueOf();
        });

        return accounts;
      });
    }

    // XXX
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
  LdsIoApi.api = {
    create: function (conf, account) {
      var accountInstance = {};

      account = account || conf.session.selectAccount();

      accountInstance.guessGender = LdsIoApi.guessGender;

      Object.keys(LdsIoApi.api).forEach(function (key) {
        accountInstance[key] = LdsIoApi.api[key];
      });

      Object.keys(LdsIoApi.api).forEach(function (key) {
        accountInstance[key] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(account);
          args.unshift(conf);
          return LdsIoApi.api[key].apply(null, args);
        };
      });

      return accountInstance;
    }
  , profile: function mergeProfile(conf, account/*, opts*/) {
      return LdsIoApi.api.me(conf, account).then(function (me) {
        // TODO which ward has admin rights rather than home ward
        // if (opts.home) // if (opts.called)
        return LdsIoApi.api.ward(conf, account, me.homeStakeAppScopedId, me.homeWardAppScopedId).then(function (ward) {
          var membersMap = {};
          var member;
          var homesMap = {};
          var home;
          var leaders;

          ward.members.forEach(function (m) {
            membersMap[m.appScopedId] = m;
          });

          ward.homes.forEach(function (h) {
            homesMap[h.appScopedId] = h;
          });

          member = membersMap[me.appScopedId];
          home = homesMap[member.homeAppScopedId];

          leaders = getLeadership(ward.members);

          Object.keys(member).forEach(function (key) {
            me[key] = member[key];
          });

          return {
            me: me
          , home: home
          , leaders: leaders
          , ward: ward
            // TODO get stake for this ward
          , stake: {
              appScopedId: me.homeStakeAppScopedId
            , name: me.homeStakeName
            }
          , membersMap: membersMap
          , homesMap: homesMap
          };
        });
      });
    }
  , raw: function (conf, account, rawUrl, params, opts) {
      params = params || {};

      if (!rawUrl) {
        throw new Error("no rawUrl provided");
      }

      Object.keys(params).forEach(function (key) {
        var val = params[key];
        rawUrl = rawUrl.replace(':' + key, encodeURIComponent(val));
      });

      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + conf.session.getId(account) + '/debug/raw?url=' + encodeURIComponent(rawUrl);
      var id = url;

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , me: function (conf, account, opts) {
      // NOTE: account may also be a session object with an accountId and token
      var id = conf.session.getId(account) + '.me';
      var url = conf.config.apiBaseUri + conf.config.apiPrefix + '/' + conf.session.getId(account) + '/me';

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , stake: function (conf, account, stakeId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      var id = account.appScopedId + 'stake.' + stakeId;
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId;

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , stakePhotos: function (conf, account, stakeId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      var id = account.appScopedId + '.stake.' + stakeId;
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId + '/photos';

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , ward: function (conf, account, stakeId, wardId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      if (!wardId) {
        throw new Error("no ward id provided");
      }
      var id = account.appScopedId + '.stake.' + stakeId + '.ward.' + wardId;
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId + '/wards/' + wardId;

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , wardPhotos: function (conf, account, stakeId, wardId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      if (!wardId) {
        throw new Error("no ward id provided");
      }
      var id = account.appScopedId + '.stake.' + stakeId + '.ward.' + wardId + '.photos';
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId + '/wards/' + wardId + '/photos';

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , photoUrl: function (conf, account, photo, size, type) {
      if (!conf.session.getId(photo)) {
        console.warn(photo);
        throw new Error("photo doesn't have an id");
      }
      // https://lds.io/api/ldsio/<accountId>/photos/individual/<appScopedId>/<date>/medium/<whatever>.jpg
      return conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + conf.session.getId(account)
        + '/photos/' + (type || photo.type)
        + '/' + conf.session.getId(photo) + '/' + (photo.updated || photo.updated_at || photo.updatedAt || 'bad-updated-at')
        + '/' + (size || 'medium') + '/' + conf.session.getId(photo) + '.jpg'
        + '?access_token=' + account.token
        ;
    }
  };

  exports.LdsIoApi = LdsIoApi.LdsIoApi = LdsIoApi;
  if ('undefined' !== typeof module) {
    module.exports = LdsIoApi;
  }
}('undefined' !== typeof exports ? exports : window));
/*
(function (exports) {
  "use strict";

  var LdsIo           = exports.LdsIo = exports.LdsIo           || {};
  var LdsApiConfig    = LdsIo.config  = exports.LdsApiConfig    || require('./lds-io-config');
  var LdsApiStorage   = LdsIo.storage = exports.CannedStorage   || require('./canned-storage');
  var LdsApiCache     = LdsIo.cache   = exports.JohnnyCache     || require('./johnny-cache');
                        LdsIo.session = exports.TherapySession  || require('./therapy-session');
                        LdsIo.api     = exports.LdsApiRequests  || require('./lds-io-api');

  var LdsIo = {};

  LdsIo.init = function (conf, opts) {
    if ('object' !== typeof opts) {
      window.alert("[ERROR] you did not supply an options object to LdsApiConfig.init()");
    }

    // TODO delete stale sessions (i.e. on public computers)
    return conf.config.init(opts).then(function (config) {
      return conf.storage.get('appVersion').then(function (version) {
        if (version !== config.appVersion) {
          return conf.cache.destroy();
        }
      }, function () {
        if (!config.developerMode) {
          return conf.cache.destroy();
        }
      }).then(function () {
        return conf.storage.set('appVersion', opts.appVersion).then(function () {
          return conf.cache.init().then(function () {
            return config;
          });
        });
      });
    });
  };

  exports.LdsIo = LdsIo;

}('undefined' !== exports ? exports : window));
*/
'use strict';

// Note: we make sure that oauth3 loads first just so that we know the PromiseA
// implementation exists as an angular-style promise before any of the modules
// (all of which use promises) are instantiated


//
// LdsApiStorage / CannedStorage
//
angular
  .module('lds.io.storage', ['oauth3'])
  .service('LdsApiStorage', [function LdsApiStorage() {

    return window.CannedStorage.create({
      namespace: 'io.lds'
    });
  }]);


//
// LdsApiConfig / Oauth3Config
//
angular
  .module('lds.io.config', ['lds.io.storage'])
  .service('LdsApiConfig', [
    '$window'
  , 'LdsApiStorage'
  , function LdsApiConfig($window, LdsApiStorage) {

    return window.Oauth3Config.create({
      defaults: {
        libPrefix: 'ng'
        // TODO this should be grabbed from oauth3.html?action=directives
      , providerUri: 'https://ldsconnect.org'
      , apiBaseUri: 'https://lds.io'
      , appId: null
      , appUri: window.location.protocol + '//' + window.location.host + window.location.pathname
      , apiPrefix: '/api/ldsio'
      , refreshWait: (15 * 60 * 1000)
      , uselessWait: Infinity // (30 * 24 * 60 * 60 * 1000)
      // note: host includes 'port' when port is non-80 / non-443
      , invokeLogin: function () {
          window.alert("override `LdsApiConfig.invokeLogin` with a function that shows a login dialog,"
            + " calls LdsApiSession.login on click, and returns a promise in that chain."
            + " TODO document on website");
        }
      }
    , storage: LdsApiStorage
    });
  }]);


//
// LdsApiCache / JohnnyCache
//
angular
  .module('lds.io.cache', ['oauth3', 'lds.io.storage'])
  .service('LdsApiCache', [
    'LdsApiConfig'
  , 'LdsApiStorage'
  , function LdsApiCache(LdsApiConfig, LdsApiStorage) {

    // TODO maybe the refreshWait and uselessWait should be here directly
    return window.JohnnyCache.create({
      storage: LdsApiStorage
    , config: LdsApiConfig
    });
  }]);


//
// LdsApiSession / TherapySession
//
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
      , LdsApiConfig, LdsApiStorage, LdsApiCache/*, Oauth3*/) {

    return window.TherapySession.create({
      namespace: 'io.lds'
    , sessionKey: 'session'
    , cache: LdsApiCache
    , config: LdsApiConfig
    , usernameMinLength: 4
    , secretMinLength: 8
    });
  }]);


//
// LdsApiRequest
//
angular
  .module('lds.io.api', ['lds.io.cache', 'lds.io.config'])
  .service('LdsApiRequest', [
    '$window'
  , '$timeout'
  , '$q'
  , '$http'
  , 'LdsApiConfig'
  , 'LdsApiCache'
  , 'LdsApiSession'
  , function LdsApiRequest($window, $timeout, $q, $http, LdsApiConfig, LdsApiCache, LdsApiSession) {

    return window.LdsIoApi.create({
      config: LdsApiConfig
    , cache: LdsApiCache
    , session: LdsApiSession
    });
  }]);


//
// LdsIo
//
angular
  .module('lds.io', ['oauth3', 'lds.io.api', 'lds.io.session', 'lds.io.cache', 'lds.io.storage', 'lds.io.config'])
  .service('LdsApi', [
    '$window', 'LdsApiStorage', 'LdsApiCache', 'LdsApiSession', 'LdsApiRequest', 'LdsApiConfig'
  , function ($window, LdsApiStorage, LdsApiCache, LdsApiSession, LdsApiRequest, LdsApiConfig) {
    
    var ngLdsIo = $window.ngLdsIo = {};
    ngLdsIo.storage = LdsApiStorage;
    ngLdsIo.cache = LdsApiCache;
    ngLdsIo.session = LdsApiSession;
    ngLdsIo.request = LdsApiRequest;
    ngLdsIo.config = LdsApiConfig;
    //ngLdsIo.init = ngLdsIo.config.init;
    ngLdsIo.init = function (opts) {
      return ngLdsIo.config.init(opts).then(function (config) {
        return ngLdsIo.cache.init().then(function () {
          return config;
        });
      });
    };

    window.LdsIo = ngLdsIo;
    return ngLdsIo;
  }]);
