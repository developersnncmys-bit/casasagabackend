const { websiteUrl, revalidateSecret } = require('../config/env');

/** Tells the website to drop its cached content. Never throws; gives up after 3 seconds. */
async function notifyWebsite() {
  if (!websiteUrl || !revalidateSecret) return;
  try {
    const r = await fetch(`${websiteUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': revalidateSecret },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) console.warn(`[revalidate] website answered ${r.status}`);
  } catch (err) {
    console.warn(`[revalidate] could not reach the website at ${websiteUrl}: ${err.message}`);
  }
}

/**
 * After a successful change to website content, refresh the website before replying.
 * (On Vercel, work left running after the response is sent may never finish.)
 */
function revalidateWebsite(req, res, next) {
  if (req.method === 'GET') return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) return json(body);
    notifyWebsite().finally(() => json(body));
    return res;
  };
  next();
}

module.exports = { revalidateWebsite, notifyWebsite };
