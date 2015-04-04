#!/bin/bash

echo "cat src/*.js > lds-io.js"
cat src/lds-io-storage.js \
    src/lds-io-config.js \
    src/lds-io-cache.js \
    src/lds-io-session.js \
    src/lds-io-api.js \
    src/lds-io.js \
  > lds-io.js

echo "uglifyjs lds-io.js > lds-io.min.js"
uglifyjs lds-io.js > lds-io.min.js 2>/dev/null || echo "uglifyjs failed"
