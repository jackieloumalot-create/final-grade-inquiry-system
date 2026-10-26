
'use client';

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import Papa from 'papaparse';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type GradeRow = {
  student_id: string;
  student_name: string;
  final_grade: string;
  updated_at: string;
  classes: {
    class_code: string;
    subject: string | null;
  };
};

type CsvRow = {
  class_code?: string;
  subject?: string;
  student_id?: string;
  student_name?: string;
  final_grade?: string;
};

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [records, setRecords] = useState<GradeRow[]>([]);
  const [busy, setBusy] = useState(false);

  const supabase = createSupabaseBrowserClient();

  const loadRecords = useCallback(async () => {
    setBusy(true);

    try {
      const res = await fetch('/api/admin/records', {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Could not load records.');
      }

      setRecords(data.records || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not load records.'
      );
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        setSignedIn(true);
        void loadRecords();
      }
    });

    return () => {
      active = false;
    };
  }, [loadRecords, supabase.auth]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage('Sign-in failed. Check your email and password.');
      setIsError(true);
      return;
    }

    setSignedIn(true);
    setIsError(false);
    setMessage('Signed in.');
    await loadRecords();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSignedIn(false);
    setRecords([]);
    setPassword('');
    setMessage('You have signed out.');
    setIsError(false);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage('');
    setIsError(false);
    setBusy(true);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) =>
        header.replace(/^\uFEFF/, '').trim().toLowerCase(),

      complete: async (result) => {
        const required = [
          'class_code',
          'subject',
          'student_id',
          'student_name',
          'final_grade',
        ];

        const headers = result.meta.fields ?? [];
        const missing = required.filter(
          (column) => !headers.includes(column)
        );

        if (missing.length > 0) {
          setMessage(
            `CSV is missing columns: ${missing.join(', ')}. Check the first row of your file.`
          );
          setIsError(true);
          setBusy(false);
          event.target.value = '';
          return;
        }

        const cleaned = result.data
          .map((row) => ({
            class_code: String(row.class_code ?? '').trim(),
            subject: String(row.subject ?? '').trim(),
            student_id: String(row.student_id ?? '').trim(),
            student_name: String(row.student_name ?? '').trim(),
            final_grade: String(row.final_grade ?? '').trim(),
          }))
          .filter((row) =>
            Object.values(row).some((value) => value !== '')
          );

        if (cleaned.length === 0) {
          setMessage('Your CSV does not contain any student records.');
          setIsError(true);
          setBusy(false);
          event.target.value = '';
          return;
        }

        const invalidIndex = cleaned.findIndex(
          (row) =>
            !row.class_code ||
            !row.student_id ||
            !row.student_name ||
            !row.final_grade
        );

        if (invalidIndex !== -1) {
          setMessage(
            `CSV data row ${invalidIndex + 2} is missing a class code, student ID, student name, or final grade. Please check that row.`
          );
          setIsError(true);
          setBusy(false);
          event.target.value = '';
          return;
        }

        try {
          const res = await fetch('/api/admin/records', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              records: cleaned,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Import failed.');
          }

          setMessage(data.message || 'CSV imported successfully.');
          setIsError(false);
          await loadRecords();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Import failed.'
          );
          setIsError(true);
        } finally {
          setBusy(false);
          event.target.value = '';
        }
      },

      error: (error) => {
        setMessage(`Could not read CSV: ${error.message}`);
        setIsError(true);
        setBusy(false);
        event.target.value = '';
      },
    });
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">INSTRUCTOR DASHBOARD</div>
          <a className="top-link" href="/">
            Student portal
          </a>
        </div>
      </header>

      <main className="main wide">
        {!signedIn ? (
          <section
            className="card"
            style={{ maxWidth: 460, margin: '0 auto' }}
          >
            <h1>Instructor Sign In</h1>
            <p className="muted">
              Sign in with the administrator account created in Supabase.
            </p>

            <form className="form" onSubmit={handleLogin}>
              <div className="field">
                <label htmlFor="email">Administrator email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <button className="btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {message && (
              <div
                className={`message ${isError ? 'error' : 'success'}`}
                style={{ marginTop: 16 }}
                role="status"
              >
                {message}
              </div>
            )}

            <p className="muted small">
              Only authorized administrator accounts can manage grades.
            </p>
          </section>
        ) : (
          <>
            <div className="admin-head">
              <div>
                <h1>Grade Records</h1>
                <p className="muted">
                  Import a CSV to add new records or update existing grades.
                </p>
              </div>

              <div className="admin-actions">
                <label className="btn secondary" htmlFor="csvFile">
                  {busy ? 'Please wait…' : 'Import CSV'}
                </label>

                <input
                  id="csvFile"
                  className="file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  disabled={busy}
                  style={{ maxWidth: 220 }}
                />

                <button className="btn" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            </div>

            <section className="card">
              <h2>Import instructions</h2>

              <p className="muted">
                Your CSV must contain these exact column names:
                class_code, subject, student_id, student_name, and
                final_grade. Completely blank rows are ignored. A matching
                class code and student ID will be updated when re-imported.
                Use NA if the final grade is not available.
              </p>

              <p className="small">
                <a href="/sample-grades.csv" download>
                  Download sample CSV template
                </a>
              </p>

              {message && (
                <div
                  className={`message ${isError ? 'error' : 'success'}`}
                  role="status"
                >
                  {message}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Class code</th>
                      <th>Student ID</th>
                      <th>Student name</th>
                      <th>Subject</th>
                      <th>Final grade</th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record, index) => (
                      <tr
                        key={`${record.classes.class_code}-${record.student_id}-${index}`}
                      >
                        <td>{record.classes.class_code}</td>
                        <td>{record.student_id}</td>
                        <td>{record.student_name}</td>
                        <td>{record.classes.subject || '—'}</td>
                        <td>{record.final_grade}</td>
                      </tr>
                    ))}

                    {records.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          {busy
                            ? 'Loading records…'
                            : 'No records to display yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="muted small">
                Showing up to 1,000 records.
              </p>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        Keep administrator credentials private. Sign out when finished.
      </footer>
    </div>
  );
}
