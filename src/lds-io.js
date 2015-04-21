/*
(function (exports) {
  "use strict";

  var LdsIo           = exports.LdsIo = exports.LdsIo           || {};
  var LdsApiConfig    = LdsIo.config  = exports.LdsApiConfig    || require('./lds-io-config');
  var LdsApiStorage   = LdsIo.storage = exports.CannedStorage   || require('./canned-storage');
  var LdsApiCache     = LdsIo.cache   = exports.JohnnyCache     || require('./johnny-cache');
                        LdsIo.session = exports.TherapySession  || require('./therapy-session');
                        LdsIo.api     = exports.LdsApiRequests  || require('./lds-io-api');

  LdsIo.init = function (opts) {
    if ('object' !== typeof opts) {
      window.alert("[ERROR] you did not supply an options object to LdsApiConfig.init()");
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
  };

  exports.LdsIo = LdsIo;

}('undefined' !== exports ? exports : window));
*/
