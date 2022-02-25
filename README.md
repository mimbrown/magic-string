# Magic String

This is a port of [Rich Haris'](https://github.com/Rich-Harris) [magic-string](https://github.com/Rich-Harris/magic-string) module, written for the Deno/Browser environment.

## Differences from the original

* This repo was written in Typescript instead of Javascript. Because of this, I removed some explicit type validation in the original code; the user is responsible to use the API in conformance with the Typescript typings.
* Deprecated APIs (`insertLeft`, `insertRight`, `locate`, and `locateOrigin`) were not ported.
* In keeping with Deno style, the entry point is `mod.ts` instead of `index.ts`.
