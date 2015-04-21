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
