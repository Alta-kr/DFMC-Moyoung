import nodemailer from 'nodemailer';

// Generate 5-character alphanumeric code with mixed case (A-Z, a-z, 0-9)
export function generateSecurityCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // exclude ambiguous characters like 0, O, 1, l, I
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Nodemailer transport
let transporter: nodemailer.Transporter | null = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function send2FACodeEmail(to: string, code: string): Promise<boolean> {
  console.log(`\n========================================`);
  console.log(`📧 [2FA AUTH CODE ISSUED]`);
  console.log(`Recipient: ${to}`);
  console.log(`Security Code: >> ${code} << (5 letters, case-sensitive)`);
  console.log(`Expires in: 5 minutes`);
  console.log(`========================================\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"DFMC Security System" <${process.env.SMTP_USER}>`,
        to,
        subject: `[둔산제일교회] 서버 관리자 2단계 보안 인증번호: [${code}]`,
        text: `서버 관리자 인증번호는 [${code}] 입니다. (대소문자 구분 5글자)\n타인에게 공유하지 마십시오.`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e293b; margin-bottom: 8px;">둔산제일교회 서버 관리자 2FA 인증</h2>
            <p style="color: #64748b; font-size: 14px;">서버 관리자 계정 로그인을 위한 2단계 보안 인증번호입니다.</p>
            <div style="margin: 24px 0; padding: 18px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #3b82f6; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #ef4444; font-size: 13px;">※ 대소문자를 구분합니다. 1회 실패 시 1분간 입력이 제한되며 5회 실패 시 시스템이 영구 잠금됩니다.</p>
          </div>
        `,
      });
      return true;
    } catch (err) {
      console.error('Failed to send actual email via SMTP:', err);
    }
  }
  return true;
}

export async function sendIntrusionAlertEmail(to: string, ip?: string): Promise<void> {
  console.log(`\n🚨🚨🚨 [CRITICAL SECURITY INTRUSION ALERT] 🚨🚨🚨`);
  console.log(`Recipient: ${to}`);
  console.log(`Reason: 5 consecutive failed 2FA attempts on server admin account!`);
  console.log(`IP: ${ip || 'Unknown'}`);
  console.log(`SYSTEM LOCKED: Must be reset directly in DB.`);
  console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"DFMC Security Alert" <${process.env.SMTP_USER}>`,
        to,
        subject: `🚨 [긴급 침입 감지] 둔산제일교회 서버 관리자 계정이 영구 잠금되었습니다`,
        text: `서버 관리자 계정 2단계 인증이 5회 연속 실패하여 시스템이 영구 잠금되었습니다.\n접속 시도 IP: ${ip || '알 수 없음'}`,
      });
    } catch (err) {
      console.error('Failed to send intrusion alert email:', err);
    }
  }
}
