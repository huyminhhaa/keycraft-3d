import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { createChatSession, listChatSessions } from '@/lib/ai/chatHistoryService';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return NextResponse.json(
      { error: 'Vui lòng đăng nhập để xem lịch sử đoạn chat.' },
      { status: 401 }
    );
  }

  const sessions = await listChatSessions(session.user.id);
  const res = NextResponse.json({ sessions });
  if (session.refreshedAccessCookie) {
    res.headers.append('Set-Cookie', session.refreshedAccessCookie);
  }
  return res;
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return NextResponse.json(
      { error: 'Vui lòng đăng nhập để tạo đoạn chat lưu trên đám mây.' },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const created = await createChatSession(session.user.id, body.title || 'Đoạn chat mới');
  const res = NextResponse.json({ session: created }, { status: 201 });
  if (session.refreshedAccessCookie) {
    res.headers.append('Set-Cookie', session.refreshedAccessCookie);
  }
  return res;
}
