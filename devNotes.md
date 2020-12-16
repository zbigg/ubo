# Portable / multitarget npm package

Readings:

    * https://nodejs.org/api/esm.html
    * https://2ality.com/2017/04/setting-up-multi-platform-packages.html
    * https://github.com/microsoft/TypeScript/issues/18442

    TS & MJS proposal for now
        https://github.com/Microsoft/TypeScript/issues/18442#issuecomment-616143727

## ubo initial

packages/@ubo/PACKAGE
    package.json
        main: lib/index.js
        types: lib/index.d.ts

    lib
        only compiled source!

    src/
        index.ts
        module.ts

    cons

        requires `yarn `workspaces & compiled TS src -> lib in each package to even work in VSCode

    pros
        easy multitarget

        lib-es6/  lib-cjs/ lib-amd/

        or dist-est or dist/umd

    how to approach multiplatform

        index.web ?
        index.node ?
        index.android ?

## Examples

harp.gl

    package/
        index.js
        index.d.ts
        index.ts (only in src)
            re-exports everything public from `lib/`

        lib/
            module.js
            module.d.ts
            module.ts (only in src)

    web content only

        index.web

    node content only
        index.node


    pros:
        clear structure
        clear way
        possibility to reference internal modules libs `@here/harp-mapview/lib/Theme`

    cons
        only one target, currently CommonJS with ES6 classes and await

