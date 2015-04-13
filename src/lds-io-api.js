'use strict';

angular
  .module('lds.io.api', ['lds.io.cache', 'lds.io.config'])
  .service('LdsApiRequest', [
    '$window'
  , '$timeout'
  , '$q'
  , '$http'
  , 'LdsApiConfig'
  , 'LdsApiCache'
  , 'LdsApiSession'
  , function LdsApiRequest($window, $timeout, $q, $http, LdsApiConfig, LdsApiCache, LdsApiSession) {
    var LdsIoApi;
    var promises = {};

    function getId(o, p) {
      // object
      if (!o) {
        return null;
      }
      // prefix
      if (!p) {
        return o.appScopedId || o.app_scoped_id || o.id || null;
      } else {
        return o[p + 'AppScopedId'] || o[p + '_app_scoped_id'] || o[p + 'Id'] || o[p + '_id'] || null;
      }
    }

    function realGet(session, id, url) {
      if (promises[id]) {
        return promises[id];
      }

      promises[id] = $http.get(
        url + '?camel=true'
      , { headers: { 'Authorization': 'Bearer ' + session.token } }
      ).then(function (resp) {
        delete promises[id];

        if (!resp.data) {
          // This seems to happen on abort...
          return $q.reject("no data returned, the request may have been aborted");
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
        delete promises[id];

        return $q.reject(err);
      });

      return promises[id];
    }

    function promiseApiCall(session, id, url, opts) {
      opts = opts || {};
      return LdsApiCache.read(id, function () {
        var d = $q.defer();

        var token = $timeout(function () {
          if (opts.tried) {
            d.reject(new Error("timed out (twice) when attempting to get data"));
            return;
          }

          opts.tried = true;
          return promiseApiCall(session, id, url, opts).then(d.resolve, d.reject);
        }, opts.tried && 16000 || 8000); 

        realGet(session, id, url).then(function (data) {
          $timeout.cancel(token);
          return d.resolve(data);
        }, function (err) {
          $timeout.cancel(token);
          return d.reject(err);
        });

        return d.promise;
      }, opts).then(function (data) {
        return data.value;
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

    function mergeProfile(session/*, opts*/) {
      return LdsIoApi.me(session).then(function (me) {
        // TODO which ward has admin rights rather than home ward
        // if (opts.home) // if (opts.called)
        return LdsIoApi.ward(session, me.homeStakeAppScopedId, me.homeWardAppScopedId).then(function (ward) {
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

    // TODO wrap with promises so that if a call is made before a prior call finishes,
    // it's just one call
    LdsIoApi = {
      init: function () {
      }
    , profile: mergeProfile
    , raw: function (account, rawUrl, params, opts) {
        params = params || {};

        if (!rawUrl) {
          throw new Error("no rawUrl provided");
        }

        Object.keys(params).forEach(function (key) {
          var val = params[key];
          rawUrl = rawUrl.replace(':' + key, encodeURIComponent(val));
        });

        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + getId(account) + '/debug/raw?url=' + encodeURIComponent(rawUrl);
        var id = url;

        return promiseApiCall(
          account
        , id
        , url
        , opts
        );
      }
    , me: function (account, opts) {
        // NOTE: account may also be a session object with an accountId and token
        var id = getId(account) + '.me';
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix + '/' + getId(account) + '/me';

        return promiseApiCall(
          account
        , id
        , url
        , opts
        );
      }
    , stake: function (session, stakeId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        var id = session.id + 'stake.' + stakeId;
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId;

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , stakePhotos: function (session, stakeId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        var id = session.id + '.stake.' + stakeId;
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId + '/photos';

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , ward: function (session, stakeId, wardId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        if (!wardId) {
          throw new Error("no ward id provided");
        }
        var id = session.id + '.stake.' + stakeId + '.ward.' + wardId;
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId + '/wards/' + wardId;

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , wardPhotos: function (session, stakeId, wardId, opts) {
        if (!stakeId) {
          throw new Error("no stake id provided");
        }
        if (!wardId) {
          throw new Error("no ward id provided");
        }
        var id = session.id + '.stake.' + stakeId + '.ward.' + wardId + '.photos';
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id + '/stakes/' + stakeId + '/wards/' + wardId + '/photos';

        return promiseApiCall(
          session
        , id
        , url
        , opts
        );
      }
    , photoUrl: function (session, photo, size, type) {
        if (!getId(photo)) {
          console.warn(photo);
          throw new Error("photo doesn't have an id");
        }
        // https://lds.io/api/ldsio/<accountId>/photos/individual/<appScopedId>/<date>/medium/<whatever>.jpg
        return LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + getId(session)
          + '/photos/' + (type || photo.type)
          + '/' + getId(photo) + '/' + (photo.updated || photo.updated_at || photo.updatedAt || 'bad-updated-at')
          + '/' + (size || 'medium') + '/' + getId(photo) + '.jpg'
          + '?access_token=' + session.token
          ;
      }
    , getAccountSummaries: function getAccountSummaries(session, accounts) {
        var promises = [];
        accounts = accounts || [];

        session.accounts.forEach(function (account) {
          account = LdsApiSession.cloneAccount(session, account);

          promises.push(LdsIoApi.profile(account).then(function (profile) {
            // TODO get a slim profile?
            account.profile = profile; 
            accounts.push(account);
          }));
        });

        return $q.all(promises).then(function () {
          // get the most recently added account as the first in the list
          // (they should already be sorted this way)
          accounts.sort(function (a, b) {
            return new Date(b.addedAt).valueOf() - new Date(a.addedAt).valueOf();
          });

          return accounts;
        });
      }
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

    // for easier debugging :)
    $window.LdsIo = $window.LdsIo || {};
    $window.LdsIo.api = LdsIoApi;

    return LdsIoApi;
  }])
  ;
