import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

// Re-verify session against DB at most once per minute to avoid a DB hit on every request
const SESSION_VERIFY_INTERVAL = 60_000;

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await connectDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user) throw new Error('No user found');
        if (user.status === 'blocked') throw new Error('Account blocked');
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) throw new Error('Invalid password');

        // Rotate sessionToken — invalidates all other active sessions
        const sessionToken = randomUUID();
        await User.findByIdAndUpdate(user._id, { sessionToken });

        return {
          id:           user._id.toString(),
          name:         user.name,
          email:        user.email,
          role:         user.role,
          referralCode: user.referralCode,
          sessionToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First login — embed session token in JWT
        token.id           = user.id;
        token.role         = user.role;
        token.referralCode = user.referralCode;
        token.sessionToken = user.sessionToken;
        token.sessionCheckedAt = Date.now();
        return token;
      }

      // Subsequent requests — re-verify against DB every 60 seconds
      const now = Date.now();
      if (now - (token.sessionCheckedAt || 0) > SESSION_VERIFY_INTERVAL) {
        await connectDB();
        const dbUser = await User.findById(token.id).select('sessionToken status');
        if (!dbUser || dbUser.sessionToken !== token.sessionToken || dbUser.status === 'blocked') {
          // Session was superseded by a newer login (or user was blocked)
          return { ...token, error: 'SessionInvalidated' };
        }
        token.sessionCheckedAt = now;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id           = token.id;
      session.user.role         = token.role;
      session.user.referralCode = token.referralCode;
      if (token.error) session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
