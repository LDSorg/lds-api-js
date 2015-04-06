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
