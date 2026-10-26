import { createProfileHandlers } from "@profullstack/profile";
import { getCurrentUser } from "@/lib/session";
import { profileStore } from "@/lib/user-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET/PUT/PATCH the signed-in user's own profile (@profullstack/profile). */
let handlers: ReturnType<typeof createProfileHandlers> | null = null;
function profileHandlers() {
  handlers ??= createProfileHandlers({
    store: profileStore(),
    getUser: async () => {
      const user = await getCurrentUser();
      return user ? { id: user.id, email: user.email } : null;
    },
  });
  return handlers;
}

export const GET = (req: Request) => profileHandlers().GET(req);
export const PUT = (req: Request) => profileHandlers().PUT(req);
export const PATCH = (req: Request) => profileHandlers().PATCH(req);
