const nodemailer = require('nodemailer');
const { mail, websiteUrl } = require('../config/env');
const Setting = require('../models/Setting');
const Suite = require('../models/Suite');

/** True once the Gmail address and app password are set. */
const enabled = () => Boolean(mail.user && mail.pass);

let transport;
const transporter = () => (transport ||= nodemailer.createTransport({ service: 'gmail', auth: { user: mail.user, pass: mail.pass } }));

const SITE = (websiteUrl && !/localhost/.test(websiteUrl) ? websiteUrl : 'https://casasagawebsite.vercel.app').replace(/\/$/, '');
const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// "Tulum" → "Tulum Suite"; "1 Bedroom Flat" stays as it is (same rule as the website)
const fullName = (name = '') => (/\s(Suite|Flat|Room|Villa|Apartment|Cottage|Studio|Penthouse)$/i.test(name) ? name : `${name} Suite`);

// Colours of the website's dark theme
const C = { bg: '#120a0d', card: '#1c1015', line: '#3a2a2c', ink: '#f5ebe2', muted: '#b8a49b', gold: '#d8b56a', gold2: '#f0d9a4', ok: '#6fcf97' };

function confirmationHtml(b, { location, policies, contact }) {
  const policy = (label) => (policies || []).find((p) => p.label.toLowerCase() === label)?.value;
  const stayTax = (b.taxAmount || 0) - (b.addonTaxAmount || 0);
  const paid = b.paymentStatus === 'paid' || (b.amountPaid || 0) >= (b.total || 0);
  const row = (label, value, strong) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:14px">${label}</td>` +
    `<td style="padding:10px 0;border-bottom:1px solid ${C.line};text-align:right;font-size:${strong ? 18 : 14}px;color:${strong ? C.gold2 : C.ink};${strong ? 'font-weight:600' : ''}">${value}</td></tr>`;
  const bill = [
    row(`Base fee · ${plural(b.nights, 'night')} × ${inr(b.rate)}`, inr(b.roomTotal)),
    b.extraGuestTotal > 0 && row(`Extra guest${b.extraGuests > 1 ? `s (${b.extraGuests})` : ''} · ${plural(b.nights, 'night')} × ${inr(b.extraGuestRate)}`, inr(b.extraGuestTotal)),
    ...(b.addonItems || []).map((a) => row(esc(a.title), a.price == null ? 'Price on request' : inr(a.price))),
    b.discount > 0 && row('Discount', `− ${inr(b.discount)}`),
    stayTax > 0 && row(`GST on stay (${b.taxRate}%)`, inr(stayTax)),
    b.addonTaxAmount > 0 && row('GST on add-ons', inr(b.addonTaxAmount)),
    b.convenienceFee > 0 && row('Convenience fee', inr(b.convenienceFee)),
    row('Total', inr(b.total), true),
    b.amountPaid > 0 && row(b.paymentStatus === 'paid' ? 'Paid online' : 'Paid', inr(b.amountPaid)),
    !paid && row('Balance due', inr(Math.max((b.total || 0) - (b.amountPaid || 0), 0))),
  ].filter(Boolean).join('');
  const link = (href, text) => `<a href="${href}" style="color:${C.gold};text-decoration:underline">${text}</a>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};font-family:Helvetica,Arial,sans-serif;color:${C.ink}">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td align="center" style="padding:8px 0 24px"><img src="${SITE}/images/logo.png" alt="CasaSaga" width="170" style="display:block;width:170px;height:auto"></td></tr>
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:34px 28px">
    <div style="text-align:center">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:50%;background:${C.gold};color:${C.bg};font-size:32px;font-weight:700">&#10003;</div>
      <p style="margin:18px 0 0"><span style="display:inline-block;padding:6px 14px;border:1px solid ${C.ok};border-radius:999px;color:${C.ok};font-size:11px;font-weight:700;letter-spacing:3px">BOOKING CONFIRMED${b.paymentStatus === 'paid' ? ' · PAID' : ''}</span></p>
      <h1 style="margin:18px 0 6px;font-family:Georgia,serif;font-weight:400;font-size:28px;color:${C.ink}">You're booked, ${esc(b.name.split(' ')[0])}!</h1>
      <p style="margin:0;color:${C.muted};font-size:15px;line-height:1.6">${b.paymentStatus === 'paid' ? "We've received your payment and your stay is confirmed." : 'Your stay is confirmed.'} We can't wait to welcome you.</p>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:22px auto 6px;border:1px dashed ${C.gold};border-radius:14px"><tr><td align="center" style="padding:12px 26px">
        <div style="font-size:10px;letter-spacing:3px;color:${C.muted}">BOOKING REFERENCE</div>
        <div style="font-size:24px;font-weight:700;letter-spacing:3px;color:${C.gold2};margin-top:4px">${esc(b.ref)}</div>
        <div style="font-size:12px;color:${C.muted};margin-top:2px">Please keep it handy for check-in</div>
      </td></tr></table>
    </div>
    <h2 style="margin:26px 0 4px;font-family:Georgia,serif;font-weight:400;font-size:20px;color:${C.gold}">Your stay</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Suite', esc(fullName(b.suiteName || b.suite)))}
      ${location ? row('Location', `${esc(location.name)}${location.mapUrl ? `<br>${link(location.mapUrl, 'Get directions')}` : ''}`) : ''}
      ${row('Check-in', `${day(b.checkIn)}${policy('check-in') ? `<br><span style="color:${C.muted}">${esc(policy('check-in'))}</span>` : ''}`)}
      ${row('Check-out', `${day(b.checkOut)}${policy('check-out') ? `<br><span style="color:${C.muted}">${esc(policy('check-out'))}</span>` : ''}`)}
      ${row('Guests', `${plural(b.guests, 'guest')} · ${plural(b.nights, 'night')}`)}
      ${b.occasion ? row('Occasion', esc(b.occasion)) : ''}
      ${b.notes ? row('Your requests', esc(b.notes)) : ''}
    </table>
    <h2 style="margin:26px 0 4px;font-family:Georgia,serif;font-weight:400;font-size:20px;color:${C.gold}">Bill</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bill}</table>
    <p style="margin:26px 0 0;color:${C.muted};font-size:13px;line-height:1.7">
      Before you arrive, please read our ${link(`${SITE}/house-rules`, 'house rules')} and ${link(`${SITE}/cancellation-policy`, 'cancellation &amp; refund policy')}${policy('cancellation') ? ` (cancellation: ${esc(policy('cancellation'))})` : ''}.
    </p>
    ${contact?.phone ? `<p style="margin:14px 0 0;color:${C.muted};font-size:13px">Questions? Call us on <a href="tel:${esc(contact.tel || contact.phone)}" style="color:${C.gold2};text-decoration:none">${esc(contact.phone)}</a> or reply to this email.</p>` : ''}
  </td></tr>
  <tr><td align="center" style="padding:22px 0 0;color:${C.muted};font-size:12px">CasaSaga · ${link(SITE, SITE.replace(/^https?:\/\//, ''))}</td></tr>
</table></td></tr></table></body></html>`;
}

function confirmationText(b, { location }) {
  return [
    `Booking confirmed — ${b.ref}`,
    '',
    `Hello ${b.name.split(' ')[0]}, your stay at CasaSaga is confirmed.`,
    `${fullName(b.suiteName || b.suite)}${location ? `, ${location.name}` : ''}`,
    `Check-in ${day(b.checkIn)} · Check-out ${day(b.checkOut)} · ${b.guests} guests`,
    `Total ${inr(b.total)}${b.amountPaid > 0 ? ` · Paid ${inr(b.amountPaid)}` : ''}`,
    '',
    `House rules: ${SITE}/house-rules`,
    `Cancellation & refund policy: ${SITE}/cancellation-policy`,
  ].join('\n');
}

/**
 * Emails the guest their booking confirmation (and a copy to MAIL_NOTIFY). Never throws —
 * a mail problem mustn't undo a booking. Resolves to true when sent.
 */
async function sendBookingConfirmation(booking) {
  if (!enabled() || !booking?.email) return false;
  try {
    const [settings, suite] = await Promise.all([Setting.get(), Suite.findById(booking.suite).select('location')]);
    const location = (settings.locations || []).find((l) => l.id === suite?.location);
    const ctx = { location, policies: settings.policies, contact: settings.contact };
    await transporter().sendMail({
      from: { name: 'CasaSaga', address: mail.user },
      to: booking.email,
      bcc: mail.notify && mail.notify !== booking.email ? mail.notify : undefined,
      replyTo: mail.notify || mail.user,
      subject: `Booking confirmed — ${fullName(booking.suiteName || booking.suite)}, ${day(booking.checkIn)} (${booking.ref})`,
      html: confirmationHtml(booking, ctx),
      text: confirmationText(booking, ctx),
    });
    booking.confirmationEmailAt = new Date();
    if (typeof booking.save === 'function') await booking.save();
    return true;
  } catch (err) {
    console.error('[mail] booking confirmation failed', booking.ref, err.message);
    return false;
  }
}

module.exports = { enabled, sendBookingConfirmation, confirmationHtml };
