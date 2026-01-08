const path = require('path');
const globEntries = require('webpack-glob-entries');

module.exports = {
  mode: 'production',
  entry: globEntries('./src/*/*.ts'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: {
    k6: 'commonjs k6',
    'k6/http': 'commonjs k6/http',
    'k6/metrics': 'commonjs k6/metrics',
    'k6/execution': 'commonjs k6/execution',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};
