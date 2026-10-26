
'use client';
import { FormEvent, useState } from 'react';

type GradeResult = {
  studentName: string;
  subject: string;
  finalGrade: string;
  remarks: string | null;
};

export default function HomePage() {
  const [classCode, setClassCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: classCode.trim(),
          studentId: studentId.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'We could not verify your details.');
      }

      setResult(data.result as GradeResult);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to check your grade right now.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">FINAL GRADE ACCESS SYSTEM</div>
          <a className="top-link" href="/admin">
            Instructor login
          </a>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <div className="hero-icon" aria-hidden="true">▤</div>
          <h1>Check Your Final Grade</h1>
          <p className="muted">
            Enter your class details below to view your final grade.
          </p>
        </section>

        <section className="card">
          <form className="form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="classCode">Class code</label>
              <input
                id="classCode"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="Enter your class code"
                autoComplete="off"
                required
                maxLength={80}
              />
            </div>

            <div className="field">
              <label htmlFor="studentId">Student ID number</label>
              <input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter your student ID"
                autoComplete="username"
                required
                maxLength={80}
              />
            </div>

            <button className="btn" disabled={loading} type="submit">
              {loading ? 'Checking…' : 'View Final Grade'}
            </button>
          </form>

          {message && (
            <div
              className="message error"
              role="alert"
              style={{ marginTop: 16 }}
            >
              {message}
            </div>
          )}

          {result && (
            <section className="result" aria-live="polite">
              <div className="result-head">
                <div className="muted small">GRADE RECORD FOUND</div>
                <strong>{result.studentName}</strong>
                <div className="muted">{result.subject}</div>
              </div>

              <div className="result-grid">
                <div className="result-item">
                  <div className="result-label">Final grade</div>
                  <div className="result-value grade-value">
                    {result.finalGrade}
                  </div>
                </div>

                <div className="result-item">
                  <div className="result-label">Remarks</div>
                  <div className="result-value">
                    {result.remarks || '—'}
                  </div>
                </div>
              </div>

              <p className="muted small" style={{ padding: '0 18px' }}>
                Contact your instructor if you believe this record is incorrect.
              </p>
            </section>
          )}
        </section>
      </main>

      <footer className="footer">
        INC's and NFE Grades, Kindly contact contact your Instructor.
      </footer>
    </div>
  );
}
