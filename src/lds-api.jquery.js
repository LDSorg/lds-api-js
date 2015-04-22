(function (exports) {
  'use strict';

  var jqLdsIo = {};
  //var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

// Note: we make sure that oauth3 loads first just so that we know the PromiseA
// implementation exists as an angular-style promise before any of the modules
// (all of which use promises) are instantiated


  jqLdsIo.storage = window.CannedStorage.create({
    namespace: 'io.lds'
  });

  jqLdsIo.config = window.Oauth3Config.create({
    defaults: {
      libPrefix: 'jq'
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
  , storage: jqLdsIo.storage
  });

    // TODO maybe the refreshWait and uselessWait should be here directly
  jqLdsIo.cache = window.JohnnyCache.create({
    storage: jqLdsIo.storage
  , config: jqLdsIo.config
  });

  jqLdsIo.session = window.TherapySession.create({
    namespace: 'io.lds'
  , sessionKey: 'session'
  , cache: jqLdsIo.cache
  , config: jqLdsIo.config
  , usernameMinLength: 4
  , secretMinLength: 8
  });

  jqLdsIo.request = window.LdsIoApi.create({
    config: jqLdsIo.config
  , cache: jqLdsIo.cache
  , session: jqLdsIo.session
  });

  jqLdsIo.init = function (opts) {
    return jqLdsIo.config.init(opts).then(function (config) {
      return jqLdsIo.cache.init().then(function () {
        return config;
      });
    });
  };

  exports.jqLdsIo = jqLdsIo.jqLdsIo = jqLdsIo;
  window.LdsIo = jqLdsIo;

  if ('undefined' !== typeof module) {
    module.exports = jqLdsIo;
  }
}('undefined' !== typeof exports ? exports : window));
