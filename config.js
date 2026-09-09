// ==============================================================================
// pesu.sido.fi - Supabase Asetukset
// ==============================================================================
// Korvaa alla olevat arvot omilla Supabase-projektisi tiedoilla:
// 1. Kirjaudu https://supabase.com
// 2. Avaa projekti -> Project Settings -> API
// 3. Kopioi Project URL ja anon public API key

window.APP_CONFIG = {
    // Esim: "https://xyzcompany.supabase.co"
    SUPABASE_URL: "https://agikcfmxqopmtsukyfny.supabase.co",

    // Esim: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaWtjZm14cW9wbXRzdWt5Zm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTcxNTksImV4cCI6MjEwNDUzMzE1OX0.igymR-HTJjPDmXtpHGKIBwxPNZ-3jxuDaU9RkJFIF0U",

    // Taloyhtiön perustiedot
    HOUSE_NAME: "Kouvolan Asunnot Oy",
    SITE_TITLE: "Pesutuvan varauslista / Laundry Reservation",

    // Varaussäännöt
    START_HOUR: 7,   // 07:00
    END_HOUR: 22,    // 22:00
    MAX_HOURS: 3     // Enintään 3 peräkkäistä tuntia
};
