/**
 * NextAuth.js 配置
 * 独立文件，供 API Route 和 lib/auth.ts 共享
 */

import NextAuth from "next-auth";
import StravaProvider from "next-auth/providers/strava";
import { saveStravaToken, saveStravaConnection } from "./strava/store";

export const authOptions = {
  providers: [
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }: any) {
      // Strava 登录时，自动保存 token 到 Redis 供后续 API 调用
      if (account?.provider === "strava" && account.access_token) {
        const userId = String(profile?.id);
        try {
          await saveStravaToken(
            {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at,
              athleteId: Number(profile?.id),
              athleteName: `${profile?.firstname || ""} ${profile?.lastname || ""}`.trim(),
              profileImage: profile?.profile,
            },
            userId
          );
          await saveStravaConnection(
            {
              athleteId: Number(profile?.id),
              athleteName: `${profile?.firstname || ""} ${profile?.lastname || ""}`.trim(),
              profileImage: profile?.profile,
            },
            userId
          );
        } catch (err) {
          console.error("保存 Strava token 失败:", err);
          // 不阻断登录流程
        }
      }
      return true;
    },
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
