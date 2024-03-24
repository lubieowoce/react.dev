/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  pageExtensions: ['jsx', 'js', 'ts', 'tsx', 'mdx', 'md'],
  reactStrictMode: true,
  experimental: {
    // TODO: Remove after https://github.com/vercel/next.js/issues/49355 is fixed
    appDir: false,
    scrollRestoration: true,
    legacyBrowsers: false,
  },
  env: {},
  async redirects() {
    return [
      {
        source: '/reference/react/RSC',
        destination: '/learn/server-components',
        permanent: true,
      },
    ];
  },
  webpack: (config, {dev, isServer, ...options}) => {
    if (process.env.ANALYZE) {
      const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: options.isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
        })
      );
    }

    // Don't bundle the shim unnecessarily.
    config.resolve.alias['use-sync-external-store/shim'] = 'react';

    // For sandpack-rsc:
    // Allow importing the source code of a module to easily inject it into sandboxes
    config.module.rules.unshift({
      // NOTE: i tried using the modern solution:
      //   type: 'asset/source'
      // but i couldn't find a way to have that bypass other loaders
      test: /\.source\.js$/,
      enforce: 'pre', // run before all other loaders, to bypass JSX transformation and react-refresh
      use: [
        {
          loader: 'raw-loader',
          options: {
            // we load the files using require(), we don't want an extra `.default` wrapper
            esModule: false,
          },
        },
      ],
    });

    const {IgnorePlugin, NormalModuleReplacementPlugin} = require('webpack');
    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /^raf$/,
        require.resolve('./src/utils/rafShim.js')
      ),
      new NormalModuleReplacementPlugin(
        /^process$/,
        require.resolve('./src/utils/processShim.js')
      ),
      new IgnorePlugin({
        checkResource(resource, context) {
          if (
            /\/eslint\/lib\/rules$/.test(context) &&
            /\.\/[\w-]+(\.js)?$/.test(resource)
          ) {
            // Skips imports of built-in rules that ESLint
            // tries to carry into the bundle by default.
            // We only want the engine and the React rules.
            return true;
          }
          return false;
        },
      })
    );

    return config;
  },
};

module.exports = nextConfig;
