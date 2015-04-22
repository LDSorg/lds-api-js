LDS API for JavaScript
======================

JavaScript libraries and wrappers for utilizing the LDS.org APIs through LDS I/O,
which is wrapped to provide proper encryption and security suitable for 3rd-party
libraries.

Install
=======

All browser modules are available as `lds-api`.

```bash
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
