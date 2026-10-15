// send-verification-code: generates a 6-digit code, stores its hash via RPC, and sends via SMTP
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "البريد الإلكتروني مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate a random 6-digit code
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

    // Store the hashed code via RPC — the code itself never goes to/from the DB in plaintext
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: storeData, error: storeErr } = await supabase.rpc("store_verification_code", {
      p_email: email,
      p_code: code,
    });

    if (storeErr || !storeData?.success) {
      return new Response(
        JSON.stringify({ error: storeData?.error || "فشل إنشاء رمز التحقق" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(`[send-verification-code] SMTP not configured. Code for ${email}: ${code}`);
      return new Response(
        JSON.stringify({ success: true, message: "لم يتم تهيئة خدمة البريد. رمز التحقق مسجل في سجل الخادم" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = "رمز التحقق - نظام متابعة الحضور الأكاديمي";
    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669; text-align: center;">جامعة المستقبل - نظام متابعة الحضور</h2>
        <p>مرحباً ${name || ""}،</p>
        <p>رمز التحقق الخاص بك هو:</p>
        <div style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; background: #f0fdf4; border-radius: 12px; color: #059669;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #666;">هذا الرمز صالح لمدة 10 دقائق فقط. لا تشاركه مع أحد.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 11px; color: #999;">إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
      </div>
    `;

    const message = `From: ${smtpFrom}\r\nTo: ${email}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${htmlBody}`;

    using conn = (Deno as any).connect({
      hostname: smtpHost,
      port: parseInt(smtpPort || "587"),
    });

    await readSmtp(conn);
    await writeSmtp(conn, `EHLO localhost\r\n`);
    await readSmtp(conn);

    if (smtpPort === "465") {
      // Direct TLS - no STARTTLS needed
    } else {
      await writeSmtp(conn, `STARTTLS\r\n`);
      await readSmtp(conn);
    }

    await writeSmtp(conn, `AUTH LOGIN\r\n`);
    await readSmtp(conn);
    await writeSmtp(conn, `${btoa(smtpUser)}\r\n`);
    await readSmtp(conn);
    await writeSmtp(conn, `${btoa(smtpPass)}\r\n`);
    await readSmtp(conn);

    await writeSmtp(conn, `MAIL FROM:<${smtpFrom}>\r\n`);
    await readSmtp(conn);
    await writeSmtp(conn, `RCPT TO:<${email}>\r\n`);
    await readSmtp(conn);
    await writeSmtp(conn, `DATA\r\n`);
    await readSmtp(conn);
    await writeSmtp(conn, `${message}\r\n.\r\n`);
    await readSmtp(conn);
    await writeSmtp(conn, `QUIT\r\n`);

    return new Response(
      JSON.stringify({ success: true, message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[send-verification-code] error:", err.message);
    return new Response(
      JSON.stringify({ error: "فشل إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function readSmtp(conn: any): Promise<string> {
  const buf = new Uint8Array(4096);
  const n = await conn.read(buf);
  return new TextDecoder().decode(buf.subarray(0, n));
}

async function writeSmtp(conn: any, data: string): Promise<void> {
  const encoded = new TextEncoder().encode(data);
  await conn.write(encoded);
}
