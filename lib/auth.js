import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { SiweMessage } from 'siwe';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import WalletNonce from '@/lib/models/WalletNonce';
import { generateReferralCode } from '@/lib/referral';

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
          id:                  user._id.toString(),
          name:                user.name,
          email:               user.email,
          role:                user.role,
          referralCode:        user.referralCode,
          canViewOverview:     user.canViewOverview ?? false,
          overviewPermissions: user.overviewPermissions ?? [],
          sessionToken,
        };
      },
    }),

    /* ── Sign-In with Ethereum (MetaMask / WalletConnect) ─────────────────
       The client fetches a nonce, has the wallet sign a SIWE message, and
       posts message+signature here. We verify the signature cryptographically
       and consume the nonce so it cannot be replayed. */
    CredentialsProvider({
      id: 'wallet',
      name: 'wallet',
      credentials: {
        message:   { label: 'Message',   type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials?.signature) {
          throw new Error('Missing signature');
        }

        await connectDB();

        let fields;
        try {
          const siwe = new SiweMessage(JSON.parse(credentials.message));
          // verify() checks the signature, domain, expiry and nonce shape.
          const result = await siwe.verify({ signature: credentials.signature });
          if (!result.success) throw new Error('Bad signature');
          fields = result.data;
        } catch {
          throw new Error('Signature verification failed');
        }

        const address = fields.address.toLowerCase();

        // The nonce must exist for THIS address and match — then burn it.
        const record = await WalletNonce.findOne({ address });
        if (!record || record.nonce !== fields.nonce) {
          throw new Error('Nonce expired — please try again');
        }
        await WalletNonce.deleteOne({ _id: record._id });

        let user = await User.findOne({ walletAddress: address });

        if (!user) {
          // First sign-in for this wallet — create the account now that the
          // signature proves ownership.
          const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
          user = await User.create({
            name:          short,
            walletAddress: address,
            referralCode:  generateReferralCode('WLT'),
          });
        }

        if (user.status === 'blocked') throw new Error('Account blocked');

        const sessionToken = randomUUID();
        await User.findByIdAndUpdate(user._id, { sessionToken });

        return {
          id:                  user._id.toString(),
          name:                user.name,
          email:               user.email ?? null,
          role:                user.role,
          referralCode:        user.referralCode,
          walletAddress:       user.walletAddress,
          canViewOverview:     user.canViewOverview ?? false,
          overviewPermissions: user.overviewPermissions ?? [],
          sessionToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First login — embed session token in JWT
        token.id                  = user.id;
        token.role                = user.role;
        token.referralCode        = user.referralCode;
        token.walletAddress       = user.walletAddress ?? null;
        token.canViewOverview     = user.canViewOverview ?? false;
        token.overviewPermissions = user.overviewPermissions ?? [];
        token.sessionToken        = user.sessionToken;
        token.sessionCheckedAt    = Date.now();
        return token;
      }

      // Subsequent requests — re-verify against DB every 60 seconds
      const now = Date.now();
      if (now - (token.sessionCheckedAt || 0) > SESSION_VERIFY_INTERVAL) {
        await connectDB();
        const dbUser = await User.findById(token.id).select('sessionToken status canViewOverview overviewPermissions walletAddress');
        if (!dbUser || dbUser.sessionToken !== token.sessionToken || dbUser.status === 'blocked') {
          // Session was superseded by a newer login (or user was blocked)
          return { ...token, error: 'SessionInvalidated' };
        }
        token.canViewOverview     = dbUser.canViewOverview ?? false;
        token.overviewPermissions = dbUser.overviewPermissions ?? [];
        token.walletAddress       = dbUser.walletAddress ?? null;
        token.sessionCheckedAt    = now;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id                  = token.id;
      session.user.role                = token.role;
      session.user.referralCode        = token.referralCode;
      session.user.walletAddress       = token.walletAddress ?? null;
      session.user.canViewOverview     = token.canViewOverview ?? false;
      session.user.overviewPermissions = token.overviewPermissions ?? [];
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
