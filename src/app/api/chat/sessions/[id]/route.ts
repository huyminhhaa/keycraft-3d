import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { deleteChatSession, getChatSessionDetail } from '@/lib/ai/chatHistoryService';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
  }

  const { id } = await context.params;
  const detail = await getChatSessionDetail(session.user.id, id);

  if (!detail) {
    return NextResponse.json({ error: 'Không tìm thấy đoạn chat.' }, { status: 404 });
  }

  const res = NextResponse.json({ session: detail });
  if (session.refreshedAccessCookie) {
    res.headers.append('Set-Cookie', session.refreshedAccessCookie);
  }
  return res;
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteChatSession(session.user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: 'Không tìm thấy đoạn chat hoặc bạn không có quyền xóa.' }, { status: 404 });
  }

  const res = NextResponse.json({ success: true });
  if (session.refreshedAccessCookie) {
    res.headers.append('Set-Cookie', session.refreshedAccessCookie);
  }
  return res;
}
