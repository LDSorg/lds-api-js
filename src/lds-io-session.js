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
    var shared = { session: {} };
    var logins = {};
    var loginPromises = {};
    var foregroundLoginPromises = {};
    var backgroundLoginPromises = {};
    var LdsIoSession;

    $window.completeLogin = function (name, url) {
      var params = parseLogin(name, url);
      var d = loginPromises[params.state || params.id];

      if (!params.id) {
        throw new Error("could not parse id from login");
      }

      if (!params.token) {
        return $q.reject(new Error("didn't get token")); // destroy();
      }

      shared.session.token = params.token;
      // TODO rid token on reject
      return testToken(shared.session).then(save).then(d.resolve, d.reject);
    };
    
    // TODO track granted scopes locally
    function save(session) {
      localStorage.setItem('io.lds.session', JSON.stringify(session));
      return $q.when(session);
    }

    function restore() {
      // Being very careful not to trigger a false onLogin or onLogout via $watch
      var storedSession;

      if (shared.session.token) {
        return $q.when(shared.session);
      }

      storedSession = JSON.parse(localStorage.getItem('io.lds.session') || null) || {};

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

      shared.session = {};
      localStorage.removeItem('io.lds.session');
      return LdsApiCache.destroy().then(function (session) {
        return session;
      });
    }

    function testToken(session) {
      // TODO cache this also, but with a shorter shelf life?
      return $http.get(
        LdsApiConfig.providerUri + LdsApiConfig.apiPrefix + '/accounts'
      , { headers: { 'Authorization': 'Bearer ' + session.token } }
      ).then(function (resp) {
        var accounts = resp.data && resp.data.accounts || resp.data;
        var id;

        // TODO accounts should be an object
        // (so that the type doesn't change on error)
        if (!Array.isArray(accounts) || accounts.error) { 
          console.error("ERR acc", accounts);
          return $q.reject(new Error("could not verify session")); // destroy();
        }

        if (1 !== accounts.length) {
          console.error("SCF acc.length", accounts.length);
          return $q.reject(new Error("[SANITY CHECK FAILED] number of accounts: '" + accounts.length + "'"));
        }

        id = accounts[0].app_scoped_id || accounts[0].id;

        if (!id) {
          console.error("SCF acc[0].id", accounts);
          return $q.reject(new Error("[SANITY CHECK FAILED] could not get account id"));
        }

        session.id = id;
        session.ts = Date.now();

        return session;
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

    function parseLogin(name, url) {
      // TODO return granted_scope and expires_at
      // TODO move into oauth3.html

      var tokenMatch = url.match(/(^|\#|\?|\&)access_token=([^\&]+)(\&|$)/);
      var idMatch = url.match(/(^|\#|\?|\&)id=([^\&]+)(\&|$)/);
      var stateMatch = url.match(/(^|\#|\?|\&)state=([^\&]+)(\&|$)/);
      var results = {};

      if (tokenMatch) {
        results.token = tokenMatch[2];
      }

      if (idMatch) {
        restults.id = idMatch[2];
      }

      if (stateMatch) {
        results.state = stateMatch[2];
      }

      return results;
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

      // This is for client-side (implicit grant) oauth2
      $window.open(url, 'ldsioLogin', 'height=720,width=620');

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

    function requireSession() {
      return restore().then(function (session) {
        return session;
      }, function (/*err*/) {
        
        return LdsApiConfig.invokeLogin();
      });
    }

    function checkSession() {
      return restore();
    }

    function onLogin(_scope, fn) {
      // This is better than using a promise.notify
      // because the watches will unwatch when the controller is destroyed
      _scope.__stsessionshared__ = shared;
      _scope.$watch('__stsessionshared__.session', function (newValue, oldValue) {
        if (!oldValue.id && newValue.id) {
          fn(shared.session);
        }
      }, true);
    }

    function onLogout(_scope, fn) {
      _scope.__stsessionshared__ = shared;
      _scope.$watch('__stsessionshared__.session', function (newValue, oldValue) {
        if (oldValue.token && !newValue.token) {
          fn(null);
        }
      }, true);
    }

    logins.authorizationCode = function (opts) {
      // TODO OAuth3 provider should use the redirect URI as the appId?
      return Oauth3.authorizationCode(
        LdsApiConfig.providerUri
        // TODO OAuth3 provider should referer / origin as the appId?
      , opts.scope
      , opts.redirect_uri
      , LdsApiConfig.appId || LdsApiConfig.appUri // (this location)
      );
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
          return backgroundLogin(LdsApiConfig.providerUri, request.url, request.state);
        } else if (opts.popup) {
          // TODO same for new window
          return popupLogin(LdsApiConfig.providerUri, request.url, request.state);
        }
      });
    };
    logins.resourceOwnerPassword = function (username, password, scope) {
      return Oauth3.resourceOwnerPassword(
        LdsApiConfig.providerUri
        // TODO OAuth3 provider should referer / origin as the appId?
      , username
      , password
      , scope
      , LdsApiConfig.appId || LdsApiConfig.appUri // (this location)
      ).then(function (request) {
        return $http({
          url: request.url
        , method: request.method
        , data: request.data
        }).then(function (result) {
          if (result.data.token) {
            return save(result.data);
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
          LdsApiConfig.providerUri + '/api' + '/logins/check/' + type + '/' + ldsaccount
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
            // TODO check expirey
            return testToken(session);
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
    };

    return LdsIoSession;
  }])
  ;
