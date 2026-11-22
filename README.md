# Home Taste Foods POS (Render + Supabase)

## Deploy
1. Supabase: copy the **Session pooler** connection string.
2. Render: New -> Blueprint from your GitHub repo. Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Tables are created and updated automatically on every start.

## Everything is managed from the admin screens
- **Settings**: logo, business name, address, phones, MTN / Airtel merchant codes, take-away packing fee (per plate).
- **Menu**: categories (add / remove / photo) and items (photo, price, category).
- **My profile**: photo, name, password (staff and customers).

Customers order at `/order`. Staff: new online orders pulse on the Orders page with a sound.

## 48mm thermal printer
Print dialog: choose the thermal printer, paper 48mm, Margins None, Scale 100%, Headers/footers off.

## Availability and order tracking
- **Availability** page (admin): switch dishes on/off and set plates left. Plates drop automatically as orders come in; at 0 the dish shows Sold out. Settings lets you hide sold-out dishes instead.
- **Orders**: tap Received / Preparing / Ready / On the way / Done. Customers see a live tracker and get a pop-up when the stage changes.
