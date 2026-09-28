import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { dispatchApi } from './apiGateway.js';
const mailConfig = defineSecret('MOYOUNG_MAIL_CONFIG');
const PUBLIC_ORIGIN = 'https://moyoung-abd47.web.app';
const config = () => JSON.parse(mailConfig.value() || '{}');
async function sendMail(templateId, params) {
  const { serviceId, publicKey, privateKey } = config();
  if (!templateId || !privateKey) throw Object.assign(new Error('관리자 인증 이메일 설정이 필요합니다.'),{status:503});
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(10000),
    body:JSON.stringify({ service_id:serviceId, template_id:templateId, user_id:publicKey, accessToken:privateKey, template_params:params }),
  });
  if (!response.ok) throw Object.assign(new Error('인증 메일 발송에 실패했습니다.'),{status:503});
}
const mail = {
  async sendCode(username, code) {
    const recipient = config().recipients?.[username];
    if (!recipient) throw Object.assign(new Error('관리자 인증 이메일 설정이 필요합니다.'),{status:503});
    await sendMail(config().templateId, { to_email:recipient, email:recipient, recipient, passcode:code, otp:code, auth_code:code, code, token:code,
      message:`모영 관리자 인증번호: ${code} (5분 이내 입력)` });
  },
  // Lock alerts go to the owner's alert address with a one-time unlock button.
  async sendUnlock(username, token) {
    const { alertRecipient, unlockTemplateId } = config();
    if (!alertRecipient) throw Object.assign(new Error('잠금 알림 이메일 설정이 필요합니다.'),{status:503});
    const unlock_url = `${PUBLIC_ORIGIN}/api/auth/unlock?t=${token}`;
    await sendMail(unlockTemplateId, { to_email:alertRecipient, email:alertRecipient, username, unlock_url,
      message:`관리자 계정 ${username}이 인증번호 5회 오류로 잠겼습니다. 24시간 안에 잠금 해제 버튼을 눌러주세요.` });
  },
};
export const api = onRequest({region:'asia-northeast3',maxInstances:5,secrets:[mailConfig],cors:false},async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.set('X-Content-Type-Options','nosniff');
  try {
    const response = await dispatchApi(getFirestore(), { url:new URL(req.originalUrl,'https://moyoung.invalid'),
      method:req.method, body:req.body || {}, token:(req.get('authorization') || '').replace(/^Bearer /,''), ip:req.ip || '' },mail);
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(await response.text());
  } catch(error) {
    res.status(error.status || 500).json({error:error.status ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',...(error.is_locked ? {is_locked:true} : {})});
  }
});
