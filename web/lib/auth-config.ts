/**
 * NextAuth.js 配置
 * 独立文件，供 API Route 和 lib/auth.ts 共享
 */

import NextAuth from "next-auth";
import StravaProvider from "next-auth/providers/strava";

export const authOptions = {
  providers: [
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }: any) {
      if (account && profile) {
        token.sub = String(profile.id);
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
