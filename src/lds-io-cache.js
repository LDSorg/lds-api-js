(function (exports) {
  'use strict';

    var JohnnyCache;
    var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

    /*
    function batchApiCall(ids, url, handler) {
      // freshIds, staleIds = ids.filter()
      // get url but don't cache
      handler(result, function (id, data) {
        // put id into result set
      });
    }
    */

    function create(opts) {
      var myInstance = {};
      var conf = {
        config: opts.config
      , storage: opts.storage
      //, caches: {}
      };

      Object.keys(JohnnyCache.api).forEach(function (key) {
        myInstance[key] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(conf);
          return JohnnyCache.api[key].apply(null, args);
        };
      });

      return myInstance;
    }

    function init(conf) {
      return conf.storage.get('caches').then(function (result) {
        conf.caches = result;
      }, function () {
        conf.caches = {};
      });
    }

    function read(conf, id, realFetch, opts) {
      var refreshWait = conf.config.refreshWait;
      var uselessWait = conf.config.uselessWait;
      var fresh;
      var usable;
      var now;
      var promise;

      function fetch() {
        return realFetch().then(function (result) {
          if ('string' === typeof result) {
            // TODO explicit option for strings
            return Oauth3.PromiseA.reject("expected json, but got a string, which is probably an error");
          }
          return fin(result);
        });
      }

      function fin(value) {
        promise = null;
        conf.caches[id] = Date.now();
        return conf.storage.set(id, value).then(function () {
          return conf.storage.set('caches', conf.caches).then(function () {
            return { updated: conf.caches[id], value: value, stale: false };
          });
        });
      }

      if (conf.caches[id] && !(opts && opts.expire)) {
        now = Date.now();
        usable = now - conf.caches[id] < uselessWait;
        fresh = now - conf.caches[id] < refreshWait;
        if (!fresh) {
          promise = fetch();
        }
      }

      return conf.storage.get(id).then(function (result) {
        if ('string' === typeof result) {
          // TODO explicit option
          return (promise || fetch());
        }
        if (usable) {
          return Oauth3.PromiseA.resolve({ updated: conf.caches[id], value: result, stale: !fresh });
        } else {
          return (promise || fetch());
        }
      }, function () {
        return (promise || fetch());
      });
    }

    function destroy(conf) {
      conf.caches = {};
      return conf.storage.clear();
    }

    JohnnyCache = {
      create: create
    , api: {
        init: init
      , read: read
      , destroy: destroy
      , clear: destroy
      }
    };
    exports.JohnnyCache = JohnnyCache.JohnnyCache = JohnnyCache;

    if ('undefined' !== typeof module) {
      module.exports = JohnnyCache;
    }
}('undefined' !== typeof exports ? exports : window));
