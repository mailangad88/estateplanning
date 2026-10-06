import path from "node:path";

// Scripts and Remotion commands run from the video/ directory.
const nm = path.resolve(process.cwd(), "node_modules");

/** Alias React to video/node_modules so the Next app's own copy is never bundled twice. */
export const webpackOverride = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      react: path.join(nm, "react"),
      "react-dom": path.join(nm, "react-dom"),
      "react/jsx-runtime": path.join(nm, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.join(nm, "react/jsx-dev-runtime.js"),
    },
  },
});
