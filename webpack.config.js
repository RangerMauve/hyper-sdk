/*
This is an example config file to bundle your hyper-sdk project with webpack 5.

Instructions:

install webpack and webpack-cli:
npm install webpack webpack-cli

Install all dependencies used as alias or fallback:
npm install webpack webpack-cli hyperswarm-web crypto-browserify path-browserify os-browserify/browser stream-browserify constants-browserify buffer process/browser

Run webpack:
webpack

=> The bundle is created at dist/bundle.js

Note that you might need to add additional aliases or fallbacks if they are used within your code. 
See https://webpack.js.org/configuration/resolve/#resolvefallback for the full list
of core Node.js modules which require a polyfill when used.

Note: for usage within a quasar project, see below
*/



const path = require('path')
var webpack = require('webpack');

module.exports = {
    'mode': 'development',
    entry: './index.js',
    target: 'web',
    resolve: {
        alias: {
            hyperswarm: 'hyperswarm-web',
            /*
                When using graceful-fs, there is an odd runtime issue because of types at a 
                line of Object.setProtoTypeOf
                See: https://github.com/isaacs/node-graceful-fs/issues/222
                It Can be resolved by manually removing that line from the bundle,
                which is a very clumsy solution (and it removes some functionality of graceful-fs)
                Or by not mapping fs on graceful-fs, and setting 'fs: false' in fallback, as is done now.
            */
            //fs: 'graceful-fs',
        },
        fallback: {
            crypto: require.resolve("crypto-browserify"),
            path: require.resolve("path-browserify"),
            os: require.resolve('os-browserify/browser'),
            stream: require.resolve('stream-browserify'),
            constants: require.resolve('constants-browserify'),

            /*
                The ones who follow cause errors which are only detected at runtime
                when they are not added
            */
            buffer: require.resolve('buffer/'),  // Note the trailing slash
            process: 'process/browser', // https://stackoverflow.com/questions/65018431/webpack-5-uncaught-referenceerror-process-is-not-defined
            fs: false
        },
    },
    plugins: [
        //SOURCE: https://viglucci.io/how-to-polyfill-buffer-with-webpack-5
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser',
        }),
    ],
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
}



/*
For usage with quasar, simply fill build.extendWebpack in your quasar.config.js file with the equivalent info. 
It should be something like:

      extendWebpack (cfg, {isServer, isClient}) {
        cfg.resolve.alias = {
          ...cfg.resolve.alias, // This adds the existing aliases
          hyperswarm: 'hyperswarm-web',
        },
        cfg.resolve.fallback = {
            crypto: require.resolve("crypto-browserify"),
            path: require.resolve("path-browserify"),
            os: require.resolve('os-browserify/browser'),
            stream: require.resolve('stream-browserify'),
            constants: require.resolve('constants-browserify'),
            // The ones who follow are only detected at runtime
            buffer: require.resolve('buffer/'), //Note the slash. Also needs entry in 'plugins'
            process: 'process/browser', // https://stackoverflow.com/questions/65018431/webpack-5-uncaught-referenceerror-process-is-not-defined
            fs: false, //Note: using the alternative package yielded a very odd error
            util: require.resolve('util'),
            assert: require.resolve('assert'),
        },
        cfg.plugins.push(
          new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser',
          }),
        )
      }
*/
