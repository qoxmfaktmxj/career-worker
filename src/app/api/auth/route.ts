import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body as { password?: string };
  const { createSession, verifyPassword } = await import("@/lib/auth");

  if (!password || !verifyPassword(password)) {
    return NextResponse.json(
      { error: "비밀번호가 틀렸습니다" },
      { status: 401 }
    );
  }

  const sessionId = createSession();
  const response = NextResponse.json({ success: true });

  response.cookies.set("session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session_id");

  return response;
}
