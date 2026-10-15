const { websiteUrl, revalidateSecret } = require('../config/env');

let timer = null;

/** Tells the website to drop its cached content. Several quick edits are sent as one refresh. */
function notifyWebsite() {
  if (!websiteUrl || !revalidateSecret) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    fetch(`${websiteUrl}/api/revalidate`, { method: 'POST', headers: { 'x-revalidate-secret': revalidateSecret } })
      .then((r) => !r.ok && console.warn(`[revalidate] website answered ${r.status}`))
      .catch((err) => console.warn(`[revalidate] could not reach the website: ${err.message}`));
  }, 500);
}

/** After a successful change to website content (not a read), refresh the website. */
function revalidateWebsite(req, res, next) {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) notifyWebsite();
    });
  }
  next();
}

module.exports = { revalidateWebsite, notifyWebsite };
