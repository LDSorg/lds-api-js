(function (exports) {
  'use strict';

  var CannedStorage;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

  function create(opts) {
    var myInstance = {};
    var conf = {
      prefix: opts.namespace + '.'
    };

    Object.keys(CannedStorage.api).forEach(function (key) {
      myInstance[key] = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(conf);
        return CannedStorage.api[key].apply(null, args);
      };
    });

    return myInstance;
  }

  var api = {
    init: function (/*conf*/) {
      // noop, reserved for future use
      return Oauth3.PromiseA.resolve();
    }
  , get: function (conf, key) {
      var val;

      try {
        val = JSON.parse(localStorage.getItem(conf.prefix + key) || null);
      } catch(e) {
        console.error("couldn't parse " + conf.prefix + key, localStorage.getItem(conf.prefix + key));
        localStorage.removeItem(conf.prefix + key);
        val = null;
      }

      // just because sometimes it happens...
      if ('undefined' === val || 'null' === val) {
        console.warn("got undefined for " + conf.prefix + key);
        val = null;
      }

      return val && Oauth3.PromiseA.resolve(val) || Oauth3.PromiseA.reject();
    }
  , set: function (conf, key, val) {
      try {
        localStorage.setItem(conf.prefix + key, JSON.stringify(val));
        return Oauth3.PromiseA.resolve();
      } catch(e) {
        console.error("couldn't stringify " + conf.prefix + key, val);
        return Oauth3.PromiseA.reject(e);
      }
    }
  , remove: function (conf, key) {
      localStorage.removeItem(conf.prefix + key);
      return Oauth3.PromiseA.resolve();
    }
  , clear: function (conf, account) {
      var re;
      var keys = [];
      var i;
      var key;

      re = new RegExp('^'
        // See http://stackoverflow.com/a/6969486/151312 for regexp escape explanation
        + conf.prefix.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
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

      return Oauth3.PromiseA.resolve();
    }
  };

  CannedStorage = {
    create: create
  , api: api
  };
  exports.CannedStorage = CannedStorage.CannedStorage = CannedStorage;

  if ('undefined' !== typeof module) {
    module.exports = CannedStorage;
  }
}('undefined' !== typeof exports ? exports : window));
