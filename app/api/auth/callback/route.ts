import { createClient } from "@/lib/supabase/server";
import { UsersRepository } from "@/lib/db/index";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  console.log("Callback origin:", origin);
  console.log("Code present:", !!code);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log("Exchange error:", error);
    console.log("User:", data?.user?.email);

    if (!error && data.user) {
      try {
        await UsersRepository.upsert(supabase, {
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.user_metadata?.full_name ?? null,
          avatar_url: data.user.user_metadata?.avatar_url ?? null,
        });
      } catch (err) {
        console.error("Failed to upsert user:", err);
      }

      return NextResponse.redirect(`${origin}/library`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
