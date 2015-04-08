'use strict';

angular
  .module('lds.io.storage', [])
  .service('LdsApiStorage', [
    '$window'
  , '$q'
  , function LdsApiStorage($window, $q) {
    var prefix = 'io.lds.';
    var LdsIoStorage = {
      init: function (pre) {
        if (pre) {
          prefix = pre;
        }
      }
    , get: function (key) {
        var val;

        try {
          val = JSON.parse(localStorage.getItem(prefix + key) || null);
        } catch(e) {
          console.error("couldn't parse " + prefix + key, localStorage.getItem(prefix + key));
          localStorage.removeItem(prefix + key);
          val = null;
        }

        // just because sometimes it happens...
        if ('undefined' === val || 'null' === val) {
          console.warn("got undefined for " + prefix + key);
          val = null;
        }

        return val && $q.when(val) || $q.reject();
      }
    , set: function (key, val) {
        try {
          localStorage.setItem(prefix + key, JSON.stringify(val));
          return $q.when();
        } catch(e) {
          console.error("couldn't stringify " + prefix + key, val);
          return $q.reject(e);
        }
      }
    , remove: function (key) {
        localStorage.removeItem(prefix + key);
        return $q.when();
      }
    , clear: function (account) {
        var re;
        var keys = [];
        var i;
        var key;

        re = new RegExp('^'
          // See http://stackoverflow.com/a/6969486/151312 for regexp escape explanation
          + prefix.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
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

        return $q.when();
      }
    };

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.storage = LdsIoStorage;

    return LdsIoStorage;
  }])
  ;
