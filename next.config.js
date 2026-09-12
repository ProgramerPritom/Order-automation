/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'pino', 'qrcode'],
  },
};

module.exports = nextConfig;

