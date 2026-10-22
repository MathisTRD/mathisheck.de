import { defineMiddleware } from 'astro:middleware';
import { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD, ADMIN_EMAILS, R2_PUBLIC_URL } from 'astro:env/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// /admin and /api/admin sit behind Cloudflare Access. Cloudflare only lets a request
// through after login and attaches a signed JWT; we verify that JWT here as well, so
// requests that reach the server without going through Cloudflare are rejected too.

const teamDomain = CF_ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const issuer = teamDomain ? `https://${teamDomain}` : null;
const jwks = issuer ? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)) : null;
const allowedEmails = new Set(
	(ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)
);
const adminConfigured = Boolean(jwks && CF_ACCESS_AUD && allowedEmails.size);

const isAdminPath = (pathname: string) =>
	pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');

const cookie = (header: string | null, name: string) =>
	header
		?.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`))
		?.slice(name.length + 1);

async function verifyAccess(request: Request): Promise<string | null> {
	const token =
		request.headers.get('cf-access-jwt-assertion') ?? cookie(request.headers.get('cookie'), 'CF_Authorization');
	if (!token || !jwks || !issuer || !CF_ACCESS_AUD) return null;
	try {
		const { payload } = await jwtVerify(token, jwks, { issuer, audience: CF_ACCESS_AUD, algorithms: ['RS256'] });
		const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
		return allowedEmails.has(email) ? email : null;
	} catch {
		return null;
	}
}

const imageOrigin = (() => {
	try {
		return R2_PUBLIC_URL ? new URL(R2_PUBLIC_URL).origin : '';
	} catch {
		return '';
	}
})();

const SECURITY_HEADERS: Record<string, string> = {
	'Content-Security-Policy': [
		"default-src 'self'",
		`img-src 'self' data: ${imageOrigin}`.trim(),
		"style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
		"font-src 'self' https://cdn.fontshare.com https://api.fontshare.com https://fonts.gstatic.com",
		"script-src 'self' 'unsafe-inline'",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join('; '),
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
	'Strict-Transport-Security': 'max-age=31536000',
};

const withHeaders = (response: Response, extra: Record<string, string> = {}) => {
	const headers = { ...SECURITY_HEADERS, ...extra };
	try {
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
		return response;
	} catch {
		// Some responses (e.g. redirects) have immutable headers; copy them into a new response.
		const copy = new Response(response.body, response);
		for (const [name, value] of Object.entries(headers)) copy.headers.set(name, value);
		return copy;
	}
};

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	if (!isAdminPath(pathname)) return withHeaders(await next());

	const adminHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
	const deny = (status: number, body: string) => withHeaders(new Response(body, { status }), adminHeaders);

	if (!adminConfigured) return deny(503, 'Admin is disabled: Cloudflare Access is not configured on the server.');

	const email = await verifyAccess(context.request);
	if (!email) return deny(403, 'Forbidden');

	// Browsers only send custom headers cross-origin after a CORS preflight, which this site never allows.
	if (pathname.startsWith('/api/admin/') && context.request.headers.get('x-admin') !== '1') {
		return deny(403, 'Forbidden');
	}

	context.locals.adminEmail = email;
	return withHeaders(await next(), adminHeaders);
});
