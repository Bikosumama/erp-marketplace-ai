/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Uyarıları derleme sırasında görmezden gel ve Vercel'in siteyi yayınlamasına izin ver
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig; // Eğer dosyan mjs ise "export default nextConfig;" yazar
