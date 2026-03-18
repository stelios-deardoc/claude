export { auth as middleware } from '@/lib/auth';

export const config = {
  // Protect everything except login page, auth API, health check, and static assets
  matcher: [
    '/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};
