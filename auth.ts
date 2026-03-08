import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

const providers: NextAuthOptions["providers"] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET
    })
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token }) {
      if (!("tier" in token)) {
        (token as Record<string, unknown>).tier = "authed";
      }
      if (!("entitlements" in token) || !Array.isArray((token as Record<string, unknown>).entitlements)) {
        (token as Record<string, unknown>).entitlements = [];
      }
      return token;
    },
    async session({ session, token }) {
      const sessionRecord = session as unknown as Record<string, unknown>;
      const tokenRecord = token as Record<string, unknown>;
      sessionRecord.tier = tokenRecord.tier ?? "authed";
      sessionRecord.entitlements = Array.isArray(
        tokenRecord.entitlements
      )
        ? tokenRecord.entitlements
        : [];
      return session;
    }
  }
};
