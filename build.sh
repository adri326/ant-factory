#!/bin/sh

# Remove any build.zip to produce a clean zip
[ -f build.zip ] && rm build.zip

# If the `convert` command is available, run it to convert `icon.png` to `favicon.ico`
# if ! command -v convert > /dev/null; then convert resources/icon.png resources/favicon.ico; fi

# Bundle everything in the zip file
zip -r9 build.zip src/ levels/ index.html LICENSE \
    resources/sprites.png resources/favicon.ico \
    noisejs/perlin.js noisejs/LICENSE
