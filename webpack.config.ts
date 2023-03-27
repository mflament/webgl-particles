import * as path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import 'webpack-dev-server';

const mode =  process.env.NODE_ENV === "production" ? "production" : "development"
const config = {
    mode,
    entry: ['./src/index.ts'],
    plugins: [
        new HtmlWebpackPlugin({
            title: "Boids"
        })
    ],
    module: {
        rules: [
            {
                test: /\.([cm]?ts|tsx)$/,
                exclude: /node_modules/,
                loader: 'ts-loader'
            },
            {
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false
                },
                loader: 'source-map-loader'
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                    // Compiles Sass to CSS
                    "sass-loader",
                ],
            },
            {
                test: /\.css$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader"
                ],
            }
        ]
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: [".ts", ".tsx", ".js"],
        // Add support for TypeScripts fully qualified ESM imports.
        extensionAlias: {
            ".js": [".js", ".ts"],
            ".cjs": [".cjs", ".cts"],
            ".mjs": [".mjs", ".mts"]
        }
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(process.cwd(), 'dist'),
        clean: true
    },
    optimization: {
        splitChunks: {
            chunks: 'all',
        }
    },
    watchOptions: {
        ignored: ['**/node_modules'],
    },
    devtool: mode === "development" ? 'inline-source-map' : false,
    devServer: mode === "development" ? {
        static: [{
            directory: path.join(__dirname, 'public'),
        }, {
            directory: path.join(__dirname, './public/effects'),
            publicPath: '/effects',
            serveIndex: true
        }],
        compress: true,
        host: "localhost",
        open: false
    } : undefined
};

export default config;
