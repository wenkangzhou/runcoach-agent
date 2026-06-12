/**
 * NextAuth.js API Route
 * GET /api/auth/[...nextauth]
 */

import { GET as getHandler, POST as postHandler } from "@/lib/auth-config";

export { getHandler as GET, postHandler as POST };
