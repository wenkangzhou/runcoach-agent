/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  experimental: {
    esmExternals: 'loose',
    externalDir: true,
  },
  webpack: (config) => {
    // 添加 src 别名映射到上层目录
    config.resolve.alias = {
      ...config.resolve.alias,
      'src': path.resolve(__dirname, '../src'),
    };
    // 添加 .js 扩展名解析
    config.resolve.extensions.push('.js');
    return config;
  },
};

module.exports = nextConfig;
