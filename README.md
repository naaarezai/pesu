# Kouvolan Asunnot Oy – Digital Booking System

### Domain: `pesu.sido.fi`

This system replaces the traditional paper-based booking list for the laundry room and sauna. It is designed to be extremely user-friendly for residents: **no passwords are required**. It works simply with your apartment number (e.g., `D23/1`), just like the old paper list!

---

## 📁 Project Structure

- `index.html` – The main page and weekly calendar view (07:00 – 22:00, Mon–Sun).
- `style.css` – Responsive mobile-first theme with a modern, aesthetic design.
- `app.js` – Frontend logic, booking validation (max 3h, 1 booking per apartment), and real-time synchronization via Supabase.
- `config.js` – Configuration file for Supabase URL and public Anon Key.
- `supabase_setup.sql` – Ready-to-use SQL script that automatically sets up database tables, triggers, and security rules.

---

## 🚀 Deployment Guide (2 Easy Steps)

### Step 1: Set up Supabase Database (Free)

1. Go to [Supabase](https://supabase.com) and create a free account/project (e.g., named `pesutupa`).
2. Open the **SQL Editor** from the left-hand navigation bar.
3. Copy the entire contents of the [`supabase_setup.sql`](supabase_setup.sql) file, paste it into the SQL Editor, and click **Run**.
4. Go to your project settings: **Project Settings** -> **API**.
5. Copy the **Project URL** and the **anon public** API key.
6. Open [`config.js`](config.js) in your code editor and replace the placeholder values:
   ```javascript
   const SUPABASE_URL = "https://your-project.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

### Step 2: Publish to Cloudflare Pages (`pesu.sido.fi`)

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Navigate to **Workers & Pages** -> **Create application** -> **Pages**.
3. Choose your preferred upload method:
   - **Connect directly to your GitHub repository** (Highly recommended for automatic deployments upon new commits).
   - **Or drag and drop the project folder** directly into Cloudflare's "Direct Upload" interface.
4. Once the deployment is complete, go to the Pages project settings -> **Custom Domains**.
5. Add your custom subdomain: `pesu.sido.fi`.
6. Cloudflare will automatically configure the DNS routing and provision a free HTTPS SSL certificate.

---

## 📋 Booking Rules & Guidelines

### 🧺 Laundry Room (Pesutupa)

1. **Operating Hours:** 07:00 – 22:00 every day.
2. **Booking Duration:** You can book 1, 2, or a maximum of 3 hours per session.
3. **Active Booking Limit:** Only **1 active booking** is allowed at a time per apartment. You cannot reserve a new slot until your current one has passed or been canceled.
4. **Cancellation:** Residents can easily cancel their own bookings directly from the calendar or the top active booking banner. The time slot is immediately freed up for others to use.

### 🧖‍♂️ Sauna Shifts (Saunavuorot)

*(Note: If sauna functionality is implemented on the same or a separate page, these rules apply)*
1. **Booking Method:** Just like the laundry room, book your sauna shift using your apartment number.
2. **Shift Limits:** Usually limited to 1 hour per apartment per week (adjust according to your building company's specific rules).
3. **Cancellations:** If you are unable to attend your reserved sauna shift, please cancel it as early as possible so your neighbors can utilize the heated sauna.
4. **General Etiquette:** Please leave the sauna clean for the next resident. 

---

## 💡 Other Useful Information (Troubleshooting & Tips)

- **Real-Time Synchronization:** The booking calendar updates automatically in real-time for all users. If a neighbor books a slot, it instantly turns red on your screen—no page refresh needed!
- **Lost/Forgotten Bookings:** If you forget when your booking is, simply open the app and enter your apartment number. The system will prominently display your upcoming reservation at the top of the screen.
- **Browser Compatibility:** Works flawlessly on all modern web browsers (Chrome, Safari, Firefox, Edge). The interface is highly optimized for mobile devices, making it easy to book on the go.
- **Privacy:** Only apartment numbers are stored. No personal data, names, or phone numbers are collected by the system.
- **Support & Maintenance:** If you encounter any technical bugs or the system goes down, please contact the building manager or your local maintenance company.
