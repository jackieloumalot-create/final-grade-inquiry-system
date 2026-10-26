import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const classCode = typeof body.classCode === 'string' ? body.classCode.trim() : '';
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!classCode || !studentId || !pin || classCode.length > 80 || studentId.length > 80 || pin.length > 32) {
      return NextResponse.json({ error: 'Enter a valid class code, student ID, and PIN.' }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    // Rate-limit by source IP: 10 attempts per 15-minute window.
    // Configure Vercel's own firewall/rate limiting as an additional layer in production.
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = createHash('sha256').update(ip).digest('hex');
    const { data: allowed, error: rateError } = await db.rpc('check_lookup_rate_limit', {
      p_key_hash: rateKey, p_max_attempts: 10, p_window_seconds: 900
    });
    if (rateError || allowed !== true) {
      return NextResponse.json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, { status: 429, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }
    const { data: classRecord, error: classError } = await db.from('classes')
      .select('id, subject').eq('class_code', classCode).maybeSingle();
    if (classError || !classRecord) return NextResponse.json({ error: 'We could not verify those details. Check them and try again.' }, { status: 401 });
    const { data: record, error } = await db.from('student_grades')
      .select('student_name, pin_hash, final_grade, remarks')
      .eq('class_id', classRecord.id).eq('student_id', studentId).maybeSingle();
    if (error || !record) return NextResponse.json({ error: 'We could not verify those details. Check them and try again.' }, { status: 401 });
    const pinMatches = await bcrypt.compare(pin, record.pin_hash);
    if (!pinMatches) return NextResponse.json({ error: 'We could not verify those details. Check them and try again.' }, { status: 401 });
    return NextResponse.json({ result: { studentName: record.student_name, subject: classRecord.subject, finalGrade: record.final_grade, remarks: record.remarks } }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Unable to check your grade right now. Please try again later.' }, { status: 500 });
  }
}
