import path from "node:path";

// Scripts and Remotion commands run from the video/ directory.
const nm = path.resolve(process.cwd(), "node_modules");

/**
 * Alias React and Remotion to video/node_modules so the Next app's own copies are never bundled twice.
 * Site files (src/studio/video) import `remotion`; without the alias webpack would resolve the root copy
 * and the composition would read a different Remotion context than the renderer.
 */
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
      remotion: path.join(nm, "remotion"),
    },
  },
});
