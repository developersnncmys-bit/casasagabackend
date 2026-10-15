require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')} — copy .env.example to .env`);
  process.exit(1);
}

module.exports = {
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  // The public website, refreshed whenever content changes
  websiteUrl: (process.env.WEBSITE_URL || '').replace(/\/$/, ''),
  revalidateSecret: process.env.REVALIDATE_SECRET || '',
};
