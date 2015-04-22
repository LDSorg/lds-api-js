#!/bin/bash

echo "Building > lds-api.js"
cat src/lds-io-storage.js \
    src/lds-io-config.js \
    src/lds-io-cache.js \
    src/lds-io-session.js \
    src/lds-io-api.js \
    src/lds-io.js \
  > lds-api.js
echo "Minifying > lds-api.min.js"
uglifyjs lds-api.js > lds-api.min.js 2>/dev/null || echo "uglifyjs failed"
echo ""

echo "Building > angular-lds-api.js"
cat lds-api.js src/angular-lds-api.js > angular-lds-api.js
echo "Minifying > angular-lds-api.min.js"
uglifyjs angular-lds-api.js > angular-lds-api.min.js 2>/dev/null || echo "uglifyjs failed"
echo ""

echo "Building lds-api.jquery.js"
cat lds-api.js src/lds-api.jquery.js > lds-api.jquery.js
echo "Minifying > lds-io.min.js"
echo ""
uglifyjs lds-api.jquery.js > lds-api.jquery.min.js 2>/dev/null || echo "uglifyjs failed"
