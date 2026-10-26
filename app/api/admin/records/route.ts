
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/require-admin';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    );
  }

  const db = createSupabaseAdminClient();

  const { data, error } = await db
    .from('student_grades')
    .select(
      'student_id, student_name, final_grade, remarks, updated_at, classes!inner(class_code, subject)'
    )
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json(
      { error: 'Could not load grade records.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { records: data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json();

    if (
      !Array.isArray(body.records) ||
      body.records.length < 1 ||
      body.records.length > 500
    ) {
      return NextResponse.json(
        { error: 'Upload between 1 and 500 CSV records at a time.' },
        { status: 400 }
      );
    }

    // Accept both the old headers and the new Excel headings.
    const read = (
      row: Record<string, unknown>,
      ...keys: string[]
    ): string => {
      for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' || typeof value === 'number') {
          return String(value).trim();
        }
      }
      return '';
    };

    const normalized = body.records.map(
      (raw: Record<string, unknown>) => ({
        classCode: read(raw, 'class_code', 'class code', 'code'),
        subject: read(raw, 'subject'),
        studentId: read(raw, 'student_id', 'student id'),
        studentName: read(raw, 'student_name', 'student name', 'name'),
        finalGrade: read(raw, 'final_grade', 'final grade', 'grade'),
      })
    );

    const invalid = normalized.find(
      (row: {
        classCode: string;
        studentId: string;
        studentName: string;
        finalGrade: string;
      }) =>
        !row.classCode ||
        !row.studentId ||
        !row.studentName ||
        !row.finalGrade ||
        row.classCode.length > 80 ||
        row.studentId.length > 80 ||
        row.studentName.length > 160 ||
        row.finalGrade.length > 40
    );

    if (invalid) {
      return NextResponse.json(
        {
          error:
            'Check your CSV. CODE, STUDENT ID, NAME, and GRADE must contain values in every row.',
        },
        { status: 400 }
      );
    }

    const db = createSupabaseAdminClient();
    const classMap = new Map<string, string>();

    for (const row of normalized) {
      if (classMap.has(row.classCode)) continue;

      const { data: existing, error: lookupError } = await db
        .from('classes')
        .select('id')
        .eq('class_code', row.classCode)
        .maybeSingle();

      if (lookupError) {
        return NextResponse.json(
          { error: 'Could not check the class records.' },
          { status: 500 }
        );
      }

      if (existing) {
        classMap.set(row.classCode, existing.id);
      } else {
        const { data: created, error: createError } = await db
          .from('classes')
          .insert({
            class_code: row.classCode,
            subject: row.subject || null,
          })
          .select('id')
          .single();

        if (createError || !created) {
          return NextResponse.json(
            { error: 'Could not create a class record. Check the class code.' },
            { status: 500 }
          );
        }

        classMap.set(row.classCode, created.id);
      }
    }

    const output = normalized.map(
      (row: {
        classCode: string;
        studentId: string;
        studentName: string;
        finalGrade: string;
      }) => ({
        class_id: classMap.get(row.classCode),
        student_id: row.studentId,
        student_name: row.studentName,
        pin_hash: null,
        final_grade: row.finalGrade,
        remarks: null,
      })
    );

    const { error: saveError } = await db
      .from('student_grades')
      .upsert(output, { onConflict: 'class_id,student_id' });

    if (saveError) {
      return NextResponse.json(
        {
          error:
            'Could not save grades. Check the database settings and duplicate student IDs.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully saved ${output.length} grade record(s).`,
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not process the CSV upload.' },
      { status: 400 }
    );
  }
}
