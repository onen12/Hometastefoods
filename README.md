# Home Taste Foods POS (Render + Supabase)

## Deploy
1. Supabase: copy the **Session pooler** connection string.
2. Render: New -> Blueprint from your GitHub repo. Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Tables are created and updated automatically on every start.

## Everything is managed from the admin screens
- **Settings**: logo, business name, address, phones, MTN / Airtel merchant codes, take-away packing fee (per plate).
- **Menu**: categories (add / remove / photo) and items (photo, price, category).
- **My profile**: photo, name, password (staff and customers).

Customers use the home page `/`; staff sign in at `/staff` (a small link under the customer login). Staff: new online orders pulse on the Orders page with a sound.

## 48mm thermal printer
Print dialog: choose the thermal printer, paper 48mm, Margins None, Scale 100%, Headers/footers off.

## Availability and order tracking
- **Availability** page (admin): switch dishes on/off and set plates left. Plates drop automatically as orders come in; at 0 the dish shows Sold out. Settings lets you hide sold-out dishes instead.
- **Orders**: tap Received / Preparing / Ready / On the way / Done. Customers see a live tracker and get a pop-up when the stage changes.

## Order alerts on phones
1. Open the staff app on your phone (use https), sign in, open the menu and tap **Enable order alerts**. Allow notifications.
2. When a customer orders, every phone with alerts on gets a notification, repeated for about one minute until the order is accepted.
3. With the app open, a loud alarm rings for one minute with **Accept order** and **Silence** buttons.
4. iPhone: first add the app to the Home Screen (Share > Add to Home Screen), then enable alerts.

## Install as an app
Both the staff app (`/staff`) and the customer app (`/`) can be installed: tap **Install app** in the menu, or use the browser's Add to Home screen.

## Special offers and packing
- **Special offers** (admin): pick a dish, a discount %, optional dates and weekdays. Prices update everywhere automatically.
- **Menu**: each dish has a "Charge packing fee" switch. Soda, juice and water are switched off automatically.

## Mobile money fee and packing
- Payments by MTN or Airtel add a fee per order (default UGX 1,000, change it in Settings) to cover withdrawal charges. Cash has no fee.
- Soda, juice, tea and water have no packing fee (you can switch this per dish in Menu).

## Fees
- **Mobile Money fee** (Settings): UGX 1000 per order paid by MTN or Airtel, to cover withdrawal charges.
- Packing is not charged on soda, juice, tea or water.
