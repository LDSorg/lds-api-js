(function (exports) {
  'use strict';

  var LdsIoApi;
  var Oauth3 = (exports.OAUTH3 || require('./oauth3'));

  function realGet(conf, account, id, url) {
    if (conf.promisesMap[id]) {
      return conf.promisesMap[id];
    }

    conf.promisesMap[id] = Oauth3.request({
      url: url
    , method: 'GET'
    , headers: { 'Authorization': 'Bearer ' + account.token }
    }).then(function (resp) {
      delete conf.promisesMap[id];

      if (!resp.data) {
        // This seems to happen on abort...
        return Oauth3.PromiseA.reject("no data returned, the request may have been aborted");
        //window.alert("[SANITY FAIL] '" + url + "' returned nothing (not even an error)");
        //return;
      }

      if (resp.data.error) {
        console.error('[ERROR]', url);
        console.error(resp.data);
        window.alert("[DEVELOPER ERROR] '" + url + "' returned an error (is the url correct? did you check login first?)");
        return;
      }


      return resp.data;
    }, function (err) {
      delete conf.promisesMap[id];

      return Oauth3.PromiseA.reject(err);
    });

    return conf.promisesMap[id];
  }

  function promiseApiCall(conf, account, id, url, opts) {
    opts = opts || {};
    return conf.cache.read(id, function () {
      return new Oauth3.PromiseA(function (resolve, reject) {
        var kotoken = setTimeout(function () {
          if (opts.tried) {
            reject(new Error("timed out (twice) when attempting to get data"));
            return;
          }

          opts.tried = true;
          return promiseApiCall(account, id, url, opts).then(resolve, reject);
        }, opts.tried && 16000 || 8000); 
        //opts.tried && 16000 || 8000 

        realGet(conf, account, id, url).then(function (data) {
          clearTimeout(kotoken);
          resolve(data);
        }, function (err) {
          clearTimeout(kotoken);
          reject(err);
        });
      });
    }, opts).then(function (data) {
      // TODO, just data.value (after bugfix)
      return data.value && data.value.value || data.value;
    });
  }

  function getLeadership(members) {
    var honchos = { membershipClerks: [] };

    members.forEach(function (member) {
      if (!Array.isArray(member.callings)) {
        // each member should have an array of callings, even if empty
        // so this is just a sanity check
        return;
      }

      member.callings.forEach(function (calling) {
        if ("Bishopric" === calling.name || 4 === calling.typeId) {
          honchos.bishop = member;
        }
        if ("Bishopric First Counselor" === calling.name || 54 === calling.typeId) {
          honchos.firstCounselor = member;
        }
        if ("Bishopric Second Counselor" === calling.name || 55 === calling.typeId) {
          honchos.secondCounselor = member;
        }
        if ("Ward Executive Secretary" === calling.name || 56 === calling.typeId) {
          honchos.executiveSecretary = member;
        }
        if ("Ward Clerk" === calling.name || 57 === calling.typeId) {
          honchos.clerk = member;
        }
        /*
        if ("Ward Assistant Clerk" === calling.name || 58 === calling.typeId) {
          honchos.assistant = member;
        }
        */
        if ("Ward Assistant Clerk--Membership" === calling.name || 787 === calling.typeId) {
          honchos.membershipClerks.push(member);
        }
      });
    });

    return honchos;
  }

  // TODO wrap with promises so that if a call is made before a prior call finishes,
  // it's just one call
  LdsIoApi = {
    create: function create(conf) {
      // conf = { config, cache, session }
      conf.promisesMap = {};
      var myInstance = {};

      myInstance.accountsWithProfiles = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(conf);
        return LdsIoApi.accountsWithProfiles.apply(null, args);
      };
      myInstance.guessGender = LdsIoApi.guessGender;

      Object.keys(LdsIoApi.api).forEach(function (key) {
        LdsIoApi[key] = LdsIoApi.api[key];
      });

      Object.keys(LdsIoApi.api).forEach(function (key) {
        myInstance[key] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(conf);
          return LdsIoApi.api[key].apply(null, args);
        };
      });

      return myInstance;
    }
  , accountsWithProfiles: function accountsWithProfiles(conf, accounts) {
      // TODO conf.session.get()
      var session = conf.session._conf.session;
      var promises = [];
      accounts = accounts || [];

      session.accounts.forEach(function (account) {
        account = conf.session.cloneAccount(account);

        promises.push(LdsIoApi.api.profile(conf, account).then(function (profile) {
          // TODO get a slim profile?
          account.profile = profile; 
          accounts.push(account);
        }));
      });

      return Oauth3.PromiseA.all(promises).then(function () {
        // get the most recently added account as the first in the list
        // (they should already be sorted this way)
        accounts.sort(function (a, b) {
          return new Date(b.addedAt).valueOf() - new Date(a.addedAt).valueOf();
        });

        return accounts;
      });
    }

    // XXX
  , guessGender: function (m) {
      var men = [ 'highPriest', 'high_priest', 'highpriest', 'elder', 'priest', 'teacher', 'deacon' ];
      var women = [ 'reliefSociety', 'relief_society', 'reliefsociety', 'laurel', 'miamaid', 'beehive' ];

      if (men.some(function (thing) {
        return m[thing];
      })) {
        return 'male';
      }

      if (women.some(function (thing) {
        return m[thing];
      })) {
        return 'female';
      }
    }
  };
  LdsIoApi.api = {
    create: function (conf, account) {
      var accountInstance = {};

      account = account || conf.session.selectAccount();

      accountInstance.guessGender = LdsIoApi.guessGender;

      Object.keys(LdsIoApi.api).forEach(function (key) {
        accountInstance[key] = LdsIoApi.api[key];
      });

      Object.keys(LdsIoApi.api).forEach(function (key) {
        accountInstance[key] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(account);
          args.unshift(conf);
          return LdsIoApi.api[key].apply(null, args);
        };
      });

      return accountInstance;
    }
  , profile: function mergeProfile(conf, account/*, opts*/) {
      return LdsIoApi.api.me(conf, account).then(function (me) {
        // TODO which ward has admin rights rather than home ward
        // if (opts.home) // if (opts.called)
        return LdsIoApi.api.ward(conf, account, me.homeStakeAppScopedId, me.homeWardAppScopedId).then(function (ward) {
          var membersMap = {};
          var member;
          var homesMap = {};
          var home;
          var leaders;

          ward.members.forEach(function (m) {
            membersMap[m.appScopedId] = m;
          });

          ward.homes.forEach(function (h) {
            homesMap[h.appScopedId] = h;
          });

          member = membersMap[me.appScopedId];
          home = homesMap[member.homeAppScopedId];

          leaders = getLeadership(ward.members);

          Object.keys(member).forEach(function (key) {
            me[key] = member[key];
          });

          return {
            me: me
          , home: home
          , leaders: leaders
          , ward: ward
            // TODO get stake for this ward
          , stake: {
              appScopedId: me.homeStakeAppScopedId
            , name: me.homeStakeName
            }
          , membersMap: membersMap
          , homesMap: homesMap
          };
        });
      });
    }
  , raw: function (conf, account, rawUrl, params, opts) {
      params = params || {};

      if (!rawUrl) {
        throw new Error("no rawUrl provided");
      }

      Object.keys(params).forEach(function (key) {
        var val = params[key];
        rawUrl = rawUrl.replace(':' + key, encodeURIComponent(val));
      });

      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + conf.session.getId(account) + '/debug/raw?url=' + encodeURIComponent(rawUrl);
      var id = url;

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , me: function (conf, account, opts) {
      // NOTE: account may also be a session object with an accountId and token
      var id = conf.session.getId(account) + '.me';
      var url = conf.config.apiBaseUri + conf.config.apiPrefix + '/' + conf.session.getId(account) + '/me';

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , stake: function (conf, account, stakeId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      var id = account.appScopedId + 'stake.' + stakeId;
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId;

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , stakePhotos: function (conf, account, stakeId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      var id = account.appScopedId + '.stake.' + stakeId;
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId + '/photos';

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , ward: function (conf, account, stakeId, wardId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      if (!wardId) {
        throw new Error("no ward id provided");
      }
      var id = account.appScopedId + '.stake.' + stakeId + '.ward.' + wardId;
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId + '/wards/' + wardId;

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , wardPhotos: function (conf, account, stakeId, wardId, opts) {
      if (!stakeId) {
        throw new Error("no stake id provided");
      }
      if (!wardId) {
        throw new Error("no ward id provided");
      }
      var id = account.appScopedId + '.stake.' + stakeId + '.ward.' + wardId + '.photos';
      var url = conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + account.appScopedId + '/stakes/' + stakeId + '/wards/' + wardId + '/photos';

      return promiseApiCall(
        conf
      , account
      , id
      , url
      , opts
      );
    }
  , photoUrl: function (conf, account, photo, size, type) {
      if (!conf.session.getId(photo)) {
        console.warn(photo);
        throw new Error("photo doesn't have an id");
      }
      // https://lds.io/api/ldsio/<accountId>/photos/individual/<appScopedId>/<date>/medium/<whatever>.jpg
      return conf.config.apiBaseUri + conf.config.apiPrefix
        + '/' + conf.session.getId(account)
        + '/photos/' + (type || photo.type)
        + '/' + conf.session.getId(photo) + '/' + (photo.updated || photo.updated_at || photo.updatedAt || 'bad-updated-at')
        + '/' + (size || 'medium') + '/' + conf.session.getId(photo) + '.jpg'
        + '?access_token=' + account.token
        ;
    }
  };

  exports.LdsIoApi = LdsIoApi.LdsIoApi = LdsIoApi;
  if ('undefined' !== typeof module) {
    module.exports = LdsIoApi;
  }
}('undefined' !== typeof exports ? exports : window));
