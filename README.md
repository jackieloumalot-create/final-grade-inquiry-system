# Final Grade Inquiry System

A starter project using Next.js, Supabase, and Vercel. It includes a student grade lookup page, PIN verification, administrator sign-in, and CSV import/update.

## Important before using real student data
- This is a starter implementation. Test it using fake records first.
- The student lookup uses class code + student ID + a private PIN. Do not use student ID alone as authentication.
- Add rate limiting/WAF protection before production to slow repeated PIN guesses. Configure Vercel protection/rate limits or add a suitable rate-limit provider.
- Use a strong administrator password and enable MFA in Supabase where available.
- Do not commit `.env.local` or share the service-role key.
- Confirm your institution's rules and data privacy requirements before uploading actual grades to a third-party service.

## Requirements
- Node.js 20.9 or newer
- A GitHub account
- A Supabase account
- A Vercel account

## Local setup
1. Install Node.js LTS from https://nodejs.org/.
2. Extract this project folder.
3. Open a terminal in this folder and run `npm install`.
4. Copy `.env.example` to `.env.local` and fill in values from Supabase project settings.
5. In Supabase SQL Editor, run `supabase/schema.sql`.
6. Create an administrator under Supabase Dashboard > Authentication > Users (email/password). Disable public sign-ups if not needed.
7. Copy that user's UUID. In SQL Editor run `insert into public.admin_users (user_id) values ('THE-USER-UUID');` using the real UUID.
8. Start the app with `npm run dev` and open http://localhost:3000.
9. Sign in at `/admin`, import a CSV, then test student lookup at `/`.

## CSV format
Required headers (exact spelling):
`class_code,subject,student_id,student_name,pin,final_grade,remarks`

- `pin` is a temporary/private PIN for that student. The server hashes it using bcrypt before storage; the plain PIN is not stored in the database.
- Keep IDs as text in Excel so leading zeroes are preserved.
- Do not use actual student data in the sample CSV.
- Re-importing the same class code + student ID updates that student's record, including the PIN.
- Import in batches of up to 500 records.

## Supabase environment variables
Use the project URL, publishable/anon key, and service-role/secret key from Supabase project settings. The service-role key is used only by server-side API routes and must never have a `NEXT_PUBLIC_` prefix.

## Deploy to Vercel
1. Push the project to a private GitHub repository.
2. In Vercel, choose Add New > Project and import that repository.
3. Add the three environment variables from `.env.local` to Vercel Project Settings > Environment Variables. Do not add the service-role key to any `NEXT_PUBLIC_` variable.
4. Deploy. If you later change environment variables, redeploy.
5. Test login, CSV import, and student lookup using fake records.

## Known production hardening still needed
- The starter includes a database-backed limit of 10 lookups per source IP per 15 minutes. Also configure Vercel Firewall/rate limits where available, and test this behavior before production.
- Consider a separate one-time PIN distribution process and a way to reset PINs securely.
- Consider audit logging for admin imports and grade changes.
- Keep database backups and confirm the data hosting arrangement is approved by the institution.
