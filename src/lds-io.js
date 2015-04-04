'use strict';

angular
  .module('lds.io', ['lds.io.api', 'lds.io.session', 'lds.io.cache', 'lds.io.storage'])
  .service('LdsApi', [
    '$window'
  , 'LdsApiConfig'
  , 'LdsApiCache'
  , function ($window, LdsApiConfig, LdsApiCache) {
    var LdsIo = {
      init: function (opts) {
        if ('object' !== typeof opts) {
          $window.alert("[ERROR] you did not supply an options object to LdsApiConfig.init()");
        }

        // TODO delete stale sessions (i.e. on public computers)
        return LdsApiConfig.init(opts).then(function (LdsApiConfig) {
          return LdsApiCache.init().then(function () {
            return LdsApiConfig;
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
