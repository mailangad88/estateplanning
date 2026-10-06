import { Config } from "@remotion/cli/config";
// @ts-ignore plain JS helper shared with scripts/render-all.mjs
import { webpackOverride } from "./scripts/webpack-override.mjs";

Config.setVideoImageFormat("jpeg");
Config.overrideWebpackConfig(webpackOverride);
