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
      authorization: {
        params: {
          scope: "read,activity:read",
          approval_prompt: "auto",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      // Strava 登录时，自动保存 token 到 Redis 供后续 API 调用
      if (account?.provider === "strava" && account.access_token) {
        try {
          const athleteId = Number(profile?.id || user?.id);
          const firstname = profile?.firstname || profile?.name?.split(" ")[0] || "";
          const lastname = profile?.lastname || profile?.name?.split(" ").slice(1).join(" ") || "";
          const athleteName = `${firstname} ${lastname}`.trim() || user?.name || "Strava 用户";
          const profileImage = profile?.profile || profile?.image || user?.image;

          await saveStravaToken({
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
            athleteId,
            athleteName,
            profileImage,
          });
          await saveStravaConnection({
            athleteId,
            athleteName,
            profileImage,
          });
          console.log("✅ Strava token 已保存到 Redis, athlete:", athleteId);
        } catch (err) {
          console.error("保存 Strava token 失败:", err);
          // 不阻断登录流程
        }
      }
      return true;
    },
    async jwt({ token, account, profile }: any) {
      if (account && profile) {
        token.sub = String(profile.id || profile.sub);
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.provider = token.provider;
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
