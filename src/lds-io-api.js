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
  , function LdsApiRequest($window, $timeout, $q, $http, LdsApiConfig, LdsApiCache) {
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
          window.alert("[SANITY FAIL] '" + url + "' returned nothing (not even an error)");
          return;
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

    LdsIoApi = {
      init: function () {
      }
    , profile: function (session, opts) {
        var id = session.id + '.me';
        var url = LdsApiConfig.providerUri + LdsApiConfig.apiPrefix + '/' + session.id + '/me';

        return promiseApiCall(
          session
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
        var id = session.id + 'stake.' + stakeId;
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
        var id = session.id + 'stake.' + stakeId + '.ward.' + wardId;
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
        var id = session.id + 'stake.' + stakeId + '.ward.' + wardId + '.photos';
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
        // https://lds.io/api/ldsio/<accountId>/photos/individual/<appScopedId>/<date>/medium/<whatever>.jpg
        return LdsApiConfig.providerUri + LdsApiConfig.apiPrefix
          + '/' + session.id 
          + '/photos/' + (type || photo.type)
          + '/' + getId(photo) + '/' + (photo.updated || photo.updated_at || photo.updatedAt || 'bad-updated-at')
          + '/' + (size || 'medium') + '/' + getId(photo) + '.jpg'
          + '?access_token=' + session.token
          ;
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
