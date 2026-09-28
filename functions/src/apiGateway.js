import { authenticate, resolveSession, publicUser, limitRequests, fail, unlockAdmin } from './legacyAuth.js';
import { handleLegacyApi } from '../lib/legacyApi.js';

export async function dispatchApi(db, { url, method, body = {}, token = '', ip = '' }, mail) {
  const path = url.pathname;
  if (!['GET','POST','PUT','DELETE'].includes(method)) fail(405,'지원하지 않는 요청입니다.');
  if (JSON.stringify(body).length > 65536) fail(413,'입력 내용이 너무 큽니다.');
  if (['/api/auth/login','/api/auth/admin-login','/api/auth/register','/api/auth/guest-login','/api/auth/verify-2fa'].includes(path)) {
    if (method !== 'POST') fail(405,'지원하지 않는 요청입니다.');
    return Response.json(await authenticate(db,path,body,ip,mail));
  }
  if (path === '/api/auth/unlock') {
    if (!['GET','POST'].includes(method)) fail(405,'지원하지 않는 요청입니다.');
    await limitRequests(db,'auth-ip:' + ip,40);
    return unlockAdmin(db,method,method === 'GET' ? url.searchParams.get('t') : body.t);
  }
  const session = await resolveSession(db,token);
  if (path === '/api/auth/logout' && method === 'POST') {
    if (session) await session.ref.delete();
    return Response.json({success:true});
  }
  if (path === '/api/auth/me' && method === 'GET') {
    if (!session) fail(401,'다시 로그인해주세요.');
    return Response.json({user:publicUser(session.user)});
  }
  const publicLobby = path === '/api/lobby/data' && method === 'GET';
  if (!publicLobby && !session) fail(401,'로그인이 필요합니다.');
  await limitRequests(db,'api:' + (session?.user.username || ip),300,60000);
  if (path.startsWith('/api/auth/')) fail(404,'요청을 찾을 수 없습니다.');
  if (path === '/api/lobby/update-cell' && method !== 'POST') fail(405,'지원하지 않는 요청입니다.');
  if (session?.user.role === 'guest' || session?.user.is_guest) {
    if (!publicLobby && !(method === 'POST' && /^\/api\/clubs\/\d+\/schedules\/\d+\/attend$/.test(path))) fail(403,'게스트는 홈 일정 참석만 가능합니다.');
  }
  // Reports must carry the authenticated identity, never a claimed author.
  if (path === '/api/reports') body = { ...body, user_id:session.user.id, user_name:session.user.name, user_cell:session.user.cell_name };
  const result = await handleLegacyApi(db,url,method,body,session?.user.username || null);
  if (result.ok && (session?.user.role === 'guest' || session?.user.is_guest) && !publicLobby) {
    const data = await result.json();
    return Response.json({message:data.message,is_attending:data.is_attending,attendees_count:data.attendees?.length ?? 0});
  }
  if (publicLobby && result.ok) {
    const data = await result.json();
    const schedules = (data.schedules || data.highlightedSchedules || []).map(item => {
      const { attendees, votes, ...rest } = item;
      return { ...rest, attendee_count: item.attendee_count ?? attendees?.length ?? 0 };
    });
    const pick = (value, keys) => value ? Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key,value[key]])) : null;
    const clubs = (data.clubs || []).map(club => pick(club,['id','name','icon','description','member_count','manager_names']));
    const cells = (data.cells || []).map(cell => pick(cell,['id','name']));
    const notice = pick(data.notice,['id','title','content','is_pinned','created_at','author_name']);
    const popup = pick(data.popup,['id','title','content_text','image_url','end_date','is_active']);
    const welcome = pick(data.welcome || data.welcomeMessage,['welcome_tagline','welcome_message','group_name','is_targeted']);
    return Response.json({ clubs,cells,notice,notices:notice?[notice]:[],popup,welcome,welcomeMessage:welcome,
      schedules,highlightedSchedules:schedules,polls:[] });
  }
  return result;
}
