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
        return LdsApiStorage.get('providerUri').then(function (val) {
          console.info("API set to " + val);
          console.log("set to custom provider with `LdsIo.storage.set('providerUri', 'https://example.com')`");
          console.log("or set to default with `LdsIo.storage.remove('providerUri')`");
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
