(function (exports) {
  'use strict';

  var Oauth3Config;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

  function create(instanceOpts) {
    var me = {};
    var storage = instanceOpts.storage;

    me.defaults = instanceOpts.defaults;
    me.libPrefix = instanceOpts.libPrefix;

    me.init = function (opts) {
      // TODO get multiple keys at once
      return Oauth3.PromiseA.all([
        storage.get('dev.providerUri').then(function (val) {
          me.developerMode = true;
          me.providerUri = val;
          me.providerUriSet = true;

        }, function () {
          // ignore
        })
      , storage.get('dev.apiBaseUri').then(function (val2) {
          me.apiBaseUri = val2;
          me.apiBaseUriSet = true;

        }, function () {
          // ignore
        })
      ]).then(function () {
        Object.keys(opts).forEach(function (key) {
          if ('appSecret' === key) {
            window.alert("[ERROR] appSecret must never be used in a client (browser, mobile, or desktop)");
            return;
          }
          me[key] = opts[key];
        });

        Object.keys(me.defaults).forEach(function (key) {
          if ('undefined' === typeof me[key]) {
            me[key] = me.defaults[key];
          }
        });

        if (!me.appId) {
          // TODO auto-register oauth3
          console.error("Please set `LdsApiConfig.appId`, try this:");
          console.log("    TEST_ID_9e78b54c44a8746a5727c972");
          window.alert("[ERROR] `LdsApiConfig.appId` not set.\nTest with 'TEST_ID_9e78b54c44a8746a5727c972'");
        }

        console.log('');
        if (!me.providerUriSet) {
          console.info("Why, hello there Latter-Day Developer! Would you like to test against the beta server?");
          console.log("    " + me.libPrefix + "LdsIo.storage.set('dev.providerUri', 'https://beta.ldsconnect.org')");
          console.log("    " + me.libPrefix + "LdsIo.storage.set('dev.apiBaseUri', 'https://beta.lds.io')");
          console.log('');
        }
        if (me.providerUriSet || me.apiBaseUriSet) {
          console.info("You're in Developer Mode! :-)");
          console.log("    UI:  " + me.providerUri);
          console.log("    API: " + me.apiBaseUri);
          console.log('');

          console.log("Want to switch back to production mode?");
          console.log("    " + me.libPrefix + "LdsIo.storage.remove('dev.providerUri'); "
            + me.libPrefix + "LdsIo.storage.remove('dev.apiBaseUri');");
          console.log('');
        }
      }).then(function () {
        // Note: it is possible for this to fail (i.e. when offline or providerUri is bad).
        // Note: for development you can pass in opts.directives (in the format of oauth3.json)
        return Oauth3.discover(me.providerUri, opts).then(function () {
          return me;
        });
      });
    };

    return me;
  }

  Oauth3Config = {
    create: create
  };
  exports.Oauth3Config = Oauth3Config.Oauth3Config = Oauth3Config;

  if ('undefined' !== typeof module) {
    module.exports = Oauth3Config;
  }
}('undefined' !== typeof exports ? exports : window));
