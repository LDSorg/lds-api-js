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
