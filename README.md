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

## Excel sales report
Reports page (admin): pick dates and tap **Download Excel report**. The file has Summary, Orders, Items sold, Top dishes and Daily sales sheets (Kampala time).

## Logo and icons
The default logo and app icons come from `public/logo-full.png`, `public/logo-mark.png`, `public/icon-192.png`, `public/icon-512.png` and `public/favicon.ico`. A logo uploaded under Settings overrides the in-app logo.

## Pickup, delivery and contact
- **Take away** now asks for **Self pickup** or **Delivery**. Delivery adds the delivery fee (Settings, default UGX 2000) and needs an address; staff see the customer phone, address and instructions on the order, with **Copy for rider** and **Send to rider** (WhatsApp) buttons.
- Rolex is not charged packing (already included). Soda, juice, tea and water are also free of packing.
- **Contact us** page for customers: call, WhatsApp, email, Facebook, Instagram, map and a built-in **live chat**. Staff reply under **Messages** and get a phone alert for new messages.
- Set the email, WhatsApp number, social links and the year started in **Settings**. They appear in the footer on every customer page.
- The Excel report's **Orders** sheet now lists the items ordered, delivery details and fees; **Items sold** includes customer name and phone.

## Riders
- **Riders** page (admin): register riders (name, phone, login email, password). Riders sign in at `/staff` and only see their own dashboard.
- On a delivery order, staff pick a rider and tap **Assign**; the rider gets a phone alert.
- The rider sees the customer's phone, address, instructions and a map link, taps **Pick up**, then **Delivered and cash collected** (cash orders). Cash is tracked per rider.
- When a rider hands over the money, the admin taps **I received ...** on the Riders page to settle it. The Excel report shows the rider and cash collected on each order.
- Customers see their rider's name and a call button while the order is on the way.

## Waitress role and saved carts
- **Staff page**: add a staff member with the role **Waitress**. Waitresses see only **New order** (dine-in only) and **Orders** (accept orders, move them along, assign riders, record payment). They cannot cancel orders or open Menu, Reports, Settings, Staff, Customers, Riders or Messages. They still get new-order alerts.
- Carts are saved on the device, so refreshing the page no longer empties the cart (customers and staff).
- The menu has no "All" tab: customers see one category at a time, and searching looks across every category.

## Local foods with sides, and side-dish packing
- **Menu** (admin): switch **Served with sides (local food)** on for each sauce or local dish. Dishes in categories whose name contains "local" are switched on automatically.
- **Settings**: the list of sides is editable (default Rice, Posho, Matooke, Pumpkin). Customers and staff tick one or more sides, or "Sauce only". Different plates can have different sides: add the dish again with other sides.
- Sides appear on the cart, order cards, rider screen, receipt and the Excel report.
- **Packing per category**: each category has a **Packing fee** box on the Menu page (blank uses the default UGX 1000). Categories with "side" in the name were set to UGX 500 automatically.

## Delivery location (map pin)
- At checkout, **Delivery** now shows a map: tap **Use my current location**, search an area or landmark, or tap/drag the pin. The address is filled in from the pin and can still be edited.
- Staff and riders see **Open pin in Google Maps** / **Navigate** on delivery orders, and the Excel report has a **Map link** column.
- By default the picker uses OpenStreetMap (free, no key). To use Google Maps instead, create a Google Maps API key (Maps JavaScript API + Geocoding API, restricted to your website) and paste it in **Settings > Google Maps API key**.

## Customer layout
- Bottom menu on phones and tablets: Home, My orders, Profile and Cart (lower right). Contact us is the chat icon at the top and on the Profile page.
- The menu shows 6 categories with **View more**. The customer footer was removed.

## Options (scoops, sugar), availability groups, popular strip, live rider tracking
- **Menu > each dish > Options**: set a label (e.g. Scoops, Spoons of sugar), smallest and largest number, starting number, how many are included free and the price per extra unit. Presets for ice cream and tea fill it in. Ice cream and tea dishes were set up automatically with no extra charge; set a price per extra scoop if you want one.
- **Availability** is grouped by category: turn a whole category on or off, or tick several dishes and use Turn off / Turn on selected. Waitresses and cashiers can use Availability too.
- The customer menu has a **Popular right now** strip (most ordered in the last 30 days) that scrolls sideways.
- **Live rider tracking**: when a rider taps Pick up and start delivery, their phone shares its location every few seconds while the app is open. Staff tap **Track** on the order to see the customer pin, the rider and the route so far, with distance and an estimated arrival. Riders should keep the app open and allow location.
