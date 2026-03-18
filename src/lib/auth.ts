import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Only allow Stelios to sign in
const ALLOWED_EMAIL = 'stelios@getdeardoc.com';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request extra scopes for Gmail/Calendar API access (Phase 2)
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/spreadsheets.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async authorized({ auth: session }) {
      // Middleware uses this to decide if request is allowed
      return !!session?.user;
    },
    async signIn({ user }) {
      // Only allow Stelios's email
      return user.email === ALLOWED_EMAIL;
    },
    async jwt({ token, account }) {
      // Store Google OAuth tokens for API access (Phase 2)
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // Make tokens available in session
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
