# Home Taste Foods POS (Render + Supabase)

## 1. Supabase (database)
1. Create a project at supabase.com.
2. Project Settings → Database → Connection string → choose **Session pooler**, copy the URI and put your DB password in it.
3. Tables and sample menu are created automatically the first time the app starts.

## 2. Render (hosting)
1. Push this folder to a GitHub repo.
2. Render → New → Blueprint → pick the repo (it reads render.yaml).
3. Fill in: `DATABASE_URL` (from step 1), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (your first admin login).
4. Deploy, open the URL, sign in, then add cashiers under Staff and edit your real menu under Menu.

Run locally: `DATABASE_URL=... ADMIN_EMAIL=you@mail.com ADMIN_PASSWORD=yourpass npm start`

## Customer ordering
Customers use `https://YOUR-APP.onrender.com/order` (create account with phone + password, order, pay Cash or Mobile Money).
Add env vars `MOMO_NUMBER` and `MOMO_NAME` on Render so customers see where to send Mobile Money. Staff confirm payment in **Orders**.

## Logo
Upload your logo as `public/logo.png` (it replaces the placeholder `logo.svg` automatically).

## 48mm thermal printer
In the print dialog choose the thermal printer, paper size 48mm, Margins: None, Scale: 100%, and turn off Headers and footers.
