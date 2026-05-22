const path = require('path')
const fs = require('fs')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const Dotenv = require('dotenv-webpack')

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development'
  const isServe = process.env.WEBPACK_SERVE === 'true'
  
  // 根据 --env envFile 参数决定加载哪个配置文件
  // envFile=local      → .env.local      (npm run dev)
  // envFile=production → .env.production (npm run start / npm run build)
  const envFile = env?.envFile === 'local' ? './.env.local' : './.env.production'

  // 检查配置文件是否存在
  const envFilePath = path.resolve(__dirname, envFile)
  if (!fs.existsSync(envFilePath)) {
    const fileName = env?.envFile === 'local' ? '.env.local' : '.env.production'
    console.error(`\n\x1b[31m[Error] ${fileName} 文件不存在！\x1b[0m`)
    console.error('\x1b[33m请执行以下步骤创建配置：\x1b[0m')
    console.error(`  1. cp .env.example ${fileName}`)
    console.error(`  2. 编辑 ${fileName} 填入 NIM_APP_KEY\n`)
    process.exit(1)
  }

  return {
    mode: isDevelopment ? 'development' : 'production',
    entry: './src/index.tsx',
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDevelopment ? '[name].js' : '[name].[contenthash].js',
      chunkFilename: isDevelopment ? '[name].chunk.js' : '[name].[contenthash].chunk.js',
      clean: true,
      // devServer 使用 '/'，打包构建使用 './'
      publicPath: isServe ? '/' : './',
    },

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    module: {
      rules: [
        // TypeScript/JSX 编译
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: { esmodules: true } }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
            },
          },
        },

        // Less 文件处理
        {
          test: /\.less$/,
          use: [
            isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
            'css-loader',
            {
              loader: 'less-loader',
              options: {
                lessOptions: {
                  javascriptEnabled: true,
                },
              },
            },
          ],
        },

        // CSS 文件处理
        {
          test: /\.css$/,
          use: [
            isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
            'css-loader',
          ],
        },

        // 图片资源
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/images/[name].[contenthash][ext]',
          },
        },

        // 字体资源
        {
          test: /\.(woff|woff2|ttf|eot)$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/fonts/[name].[contenthash][ext]',
          },
        },
      ],
    },

    plugins: [
      // 环境变量配置
      // - npm run dev:   加载 .env.local (本地开发配置)
      // - npm run start: 加载 .env      (线上配置预览)
      // - npm run build: 加载 .env      (线上部署)
      new Dotenv({
        path: envFile,
        systemvars: true,
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        inject: 'body',
      }),
      !isDevelopment && new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[contenthash].chunk.css',
      }),
    ].filter(Boolean),

    optimization: {
      minimize: !isDevelopment,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: !isDevelopment,
            },
          },
        }),
        new CssMinimizerPlugin(),
      ],
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
        },
      },
      runtimeChunk: 'single',
    },

    devServer: {
      port: 8000,
      hot: true,
      historyApiFallback: true,
      open: true,
      compress: true,
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },

    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  }
}