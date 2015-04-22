LDS API for JavaScript
======================

JavaScript libraries and wrappers for utilizing the LDS.org APIs through LDS I/O,
which is wrapped to provide proper encryption and security suitable for 3rd-party
libraries.

Install
=======

All browser modules are available as `lds-api`.

```bash
bower install --save recase
bower install --save oauth3
bower install --save lds-api
```

The modules `lds`, `angular-lds-io`, and `jquery-lds-io` are all aliases of `lds-api`.

Angular
=======

See https://github.com/ldsorg/angular-lds-io

jQuery
======

See https://github.com/ldsorg/jquery-lds-io

node
====

TODO

LDS IO
======

The raw JavaScript API is intended only for debugging.

If you would like to build a library for another framework, such as React or Ember,
just take a look at `src/angular-lds-api.js` and `src/lds-api.jquery.js`. They're very thin wrappers.

Note that you would also need to provide a promise and request implementation to `oauth3` as seen in
[`angular-oauth3.js`](https://github.com/OAuth3/bower-oauth3/blob/master/angular-oauth3.js)

**Development**:

```html
<script src="bower_components/recase/recase.js"></script>
<script src="bower_components/oauth3/oauth3.js"></script>
<script src="my-oauth3-polyfills.js"></script>

<script src="bower_components/angular-lds-io/src/lds-io-storage.js"></script>
<script src="bower_components/angular-lds-io/src/lds-io-config.js"></script>
<script src="bower_components/angular-lds-io/src/lds-io-cache.js"></script>
<script src="bower_components/angular-lds-io/src/lds-io-session.js"></script>
<script src="bower_components/angular-lds-io/src/lds-io-api.js"></script>
<script src="bower_components/angular-lds-io/src/lds-io.js"></script>
<script src="bower_components/angular-lds-io/src/angular-lds-api.js"></script>
```

**Production**:

```html
<script src="bower_components/recase/recase.min.js"></script>
<script src="bower_components/oauth3/oauth3.min.js"></script>
<script src="my-oauth3-polyfills.js"></script>

<script src="bower_components/angular-lds-io/lds-api.min.js"></script>
```

**my-oauth3-polyfills.js**:

```javascript
'use strict';

// Ensure a Promises/A+ implementation
OAUTH3.providePromise(window.Promise || window.ES6Promise || window.RSVP);

// Ensure a Promisable request implementation
OAUTH3.provideRequest(function (req) {
  // req = { url, method, data, headers }
  return new OAUTH3.PromiseA(function (resolve, reject) {
    var xhr = window.XMLHttpRequest();

    xhr.addEventListener('load', function () {
      var resp = { xhr: xhr };

      resp.status = xhr.status;
      resp.statusText = xhr.statusText;

      try {
        resp.data = JSON.parse(xhr.responseText);
        resolve(resp);
      } catch(e) {
        var err = new Error("bad response");

        err.code = "E_XHR_RESPONSE";
        err.xhr = xhr;
        err.data = xhr.responseText
        err.status = xhr.status
        err.statusText = statusText;

        reject(err);
      }
    })
    xhr.addEventListener('error', function () {
      var err = new Error("xhr failed (incomplete)");

      err.code = "E_XHR_INCOMPLETE";
      err.xhr = xhr;
      err.status = xhr.status;
      err.statusText = xhr.statusText;

      reject(err);
    });
  });
});
```
