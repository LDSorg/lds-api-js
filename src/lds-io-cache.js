'use strict';

angular
  .module('lds.io.cache', ['lds.io.storage'])
  .service('LdsApiCache', [
    '$window'
  , '$q'
  , 'LdsApiStorage'
  , function LdsApiCache($window, $q, LdsApiStorage) {
    var LdsIoCache;
    var caches;
    var refreshIn = (15 * 60 * 1000);
    var uselessIn = Infinity; // (30 * 24 * 60 * 60 * 1000);

    /*
    function batchApiCall(ids, url, handler) {
      // freshIds, staleIds = ids.filter()
      // get url but don't cache
      handler(result, function (id, data) {
        // put id into result set
      });
    }
    */

    function init() {
      return LdsApiStorage.get('caches').then(function (result) {
        caches = result;
      }, function () {
        caches = {};
      });
    }

    function read(id, realFetch, opts) {
      var refreshWait = refreshIn;
      var uselessWait = uselessIn;
      var fresh;
      var usable;
      var now;
      var promise;

      function fetch() {
        return realFetch().then(function (result) {
          if ('string' === typeof result) {
            // TODO explicit option for strings
            return $q.reject("expected json, but got a string, which is probably an error");
          }
          return fin(result);
        });
      }

      function fin(value) {
        promise = null;
        caches[id] = Date.now();
        return LdsApiStorage.set(id, value).then(function () {
          return LdsApiStorage.set('caches', caches).then(function () {
            return { updated: caches[id], value: value, stale: false };
          });
        });
      }

      if (caches[id] && !(opts && opts.expire)) {
        now = Date.now();
        usable = now - caches[id] < uselessWait;
        fresh = now - caches[id] < refreshWait;
        if (!fresh) {
          promise = fetch();
        }
      }

      return LdsApiStorage.get(id).then(function (result) {
        if ('string' === typeof result) {
          // TODO explicit option
          return (promise || fetch());
        }
        if (usable) {
          return $q.when({ updated: caches[id], value: result, stale: !fresh });
        } else {
          return (promise || fetch());
        }
      }, function () {
        return (promise || fetch());
      });
    }

    function destroy() {
      caches = {};
      return LdsApiStorage.clear();
    }

    LdsIoCache = {
      init: init
    , read: read
    , destroy: destroy
    , clear: destroy
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.cache = LdsIoCache;

    return LdsIoCache;
  }])
  ;
