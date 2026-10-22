import { defineMiddleware } from 'astro:middleware';
import { ADMIN_PASSWORD } from 'astro:env/server';
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

const isAuthorized = (header: string | null) => {
	if (!ADMIN_PASSWORD || !header?.startsWith('Basic ')) return false;
	const decoded = Buffer.from(header.slice(6), 'base64').toString();
	const password = decoded.slice(decoded.indexOf(':') + 1);
	return timingSafeEqual(digest(password), digest(ADMIN_PASSWORD));
};

// HTTP Basic Auth for the admin page and its API. The user name is ignored.
export const onRequest = defineMiddleware((context, next) => {
	const { pathname } = context.url;
	if (!(pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/'))) return next();

	if (!ADMIN_PASSWORD) return new Response('Admin is disabled: ADMIN_PASSWORD is not set.', { status: 503 });
	if (!isAuthorized(context.request.headers.get('authorization'))) {
		return new Response('Login required', {
			status: 401,
			headers: { 'WWW-Authenticate': 'Basic realm="mathisheck admin", charset="UTF-8"' },
		});
	}
	// Browsers only send custom headers cross-origin after a CORS preflight, which this site never allows.
	if (pathname.startsWith('/api/admin/') && context.request.headers.get('x-admin') !== '1') {
		return new Response('Forbidden', { status: 403 });
	}
	return next();
});
