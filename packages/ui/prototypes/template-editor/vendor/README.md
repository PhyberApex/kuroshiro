# vendor

PROTOTYPE. `editor.bundle.js` is CodeMirror 6 and liquidjs in one file, so `index.html` opens from disk without a build.

Built outside the workspace, in an empty folder, from `entry.js`:

```sh
npm install codemirror @codemirror/lang-liquid @codemirror/lang-html @codemirror/lang-json @codemirror/lang-javascript \
  @codemirror/language @codemirror/state @codemirror/view @codemirror/commands @codemirror/autocomplete \
  @codemirror/lint @codemirror/search @lezer/highlight liquidjs esbuild
npx esbuild entry.js --bundle --minify --format=iife --global-name=KuroEditor --platform=browser --outfile=editor.bundle.js
```

Versions bundled: `@codemirror/view` 6.43.13, `@codemirror/state` 6.7.6, `@codemirror/language` 6.12.4,
`@codemirror/commands` 6.11.1, `@codemirror/autocomplete` 6.20.3, `@codemirror/lint` 6.9.7, `@codemirror/search` 6.7.2,
`@codemirror/lang-liquid` 6.3.3, `@codemirror/lang-html` 6.4.12, `@codemirror/lang-json` 6.0.2,
`@codemirror/lang-javascript` 6.2.5, `@lezer/highlight` 1.2.5, `liquidjs` 10.30.0.

The whole bundle is 649 kB minified (about 224 kB gzipped). The real UI loads it lazily, with the first code editor.
