// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Opsi Next.js lainnya bisa ditambahkan di sini jika perlu
  
  webpack: (config, { isServer }) => {
    // --- INSTRUKSI KHUSUS UNTUK WEBPACK ---
    
    // Hanya berlaku untuk build sisi server (API Routes)
    if (isServer) {
      // Tandai modul-modul native sebagai 'external'
      // agar Webpack tidak mencoba membundelnya
      config.externals = [...config.externals, '@napi-rs/canvas']; 
    }

    // Tambahkan aturan agar Webpack mengabaikan file .node
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader', // Atau bisa coba 'raw-loader' jika 'node-loader' error
    });
    // ------------------------------------

    return config;
  },
};

export default nextConfig;