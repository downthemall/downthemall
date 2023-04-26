/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
// License: MIT

const path = require("path");

module.exports = {
  mode: "production",
  resolve: {
    extensions: ["*", ".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  entry: {
    "background": "./lib/background.ts",
    "manager": "./windows/manager.ts",
    "select": "./windows/select.ts",
    "single": "./windows/single.ts",
    "prefs": "./windows/prefs.ts",
    "content-popup": "./windows/popup.ts",
    "content-gather": "./scripts/gather.ts",
  },
  externals(context, request, callback) {
    if (request === "crypto") {
      return callback(null, "crypto");
    }
    return callback();
  },
  output: {
    path: path.join(__dirname, "bundles"),
    filename: "[name].js"
  },
  devtool: "source-map",
  stats: {
    hash: true,
    timings: true,
  },
  watchOptions: {
    ignored: /node_modules|bundles/
  },
  node: false,
  performance: {
    hints: false
  },
  optimization: {
    minimize: false,
    moduleIds: "named",
    chunkIds: "named",
    mangleExports: false,
    splitChunks: {
      chunks: chunk => {
        return !chunk.name.startsWith("content-");
      },
      minChunks: 2,
      name: "common",
    }
  }
};
