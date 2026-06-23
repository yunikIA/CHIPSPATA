const fs = require('fs');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

const content = `window.__SUPABASE_URL__ = ${JSON.stringify(url)};
window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(key)};
`;

try {
  fs.writeFileSync('config.js', content);
  console.log('config.js generated successfully');
  console.log(url ? 'SUPABASE_URL is set' : 'WARNING: SUPABASE_URL is not set');
  console.log(key ? 'SUPABASE_ANON_KEY is set' : 'WARNING: SUPABASE_ANON_KEY is not set');
} catch (err) {
  console.error('Error generating config.js:', err);
  process.exit(1);
}
