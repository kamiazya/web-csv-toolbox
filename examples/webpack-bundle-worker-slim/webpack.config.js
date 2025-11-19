const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { codecovWebpackPlugin } = require('@codecov/webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './index.ts',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditionNames: ['browser', 'import', 'module', 'default'],
    mainFields: ['browser', 'module', 'main'],
    fallback: {
      'node:worker_threads': false,
      'node:url': false,
      'node:path': false,
      'node:fs/promises': false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /worker.*\.bundle\.js$/,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    codecovWebpackPlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'example-webpack-bundle-worker-slim',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9001,
  },
};
