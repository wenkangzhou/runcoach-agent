/**
 * 认证工具
 * 基于 NextAuth.js + Strava Provider
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/** 从 session 获取当前用户 ID，未登录返回 "anonymous" */
export async function getCurrentUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return String(session.user.id);
  }
  return "anonymous";
}

/** 检查是否登录，未登录抛错 */
export async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId();
  if (userId === "anonymous") {
    throw new Error("未登录，请先通过 Strava 授权登录");
  }
  return userId;
}
