import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";
import { getAuthUxMessages } from "@/lib/binary2048/auth-ux";

export default async function PrivacyPage() {
  const session = await getServerSession(authOptions);
  const authState = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  const authUx = getAuthUxMessages(authState);
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Privacy</h1>
      <p>
        Binary-2048 supports authenticated user data export and deletion.
      </p>
      <p>{authUx.dataExportDelete}</p>
      <h2>Data Export</h2>
      <p>
        Authenticated users can export account-linked gameplay data via <code>GET /api/user/data/export</code>.
      </p>
      <h2>Data Deletion</h2>
      <p>
        Authenticated users can delete account-linked data via <code>DELETE /api/user/data</code>.
      </p>
      <h2>Scope</h2>
      <p>
        Current export/delete scope includes leaderboard entries, subscriptions, and store inventory/ledger data
        tied to the authenticated user id.
      </p>
    </main>
  );
}
