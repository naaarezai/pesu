// ==============================================================================
// KOUVOLAN ASUNNOT OY - PESUTUVAN VARAUSJÄRJESTELMÄ (pesu.sido.fi)
// Frontend-sovelluslogiikka & Supabase-integraatio
// ==============================================================================

(function () {
  'use strict';

  // Alustetaan Supabase-asiakas
  let supabase = null;
  const cfg = window.APP_CONFIG || {};

  const isSupabaseConfigured = cfg.SUPABASE_URL &&
    cfg.SUPABASE_URL !== '' &&
    cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_ANON_KEY !== '';

  if (isSupabaseConfigured && window.supabase) {
    try {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } catch (e) {
      console.error('Virhe Supabase-yhteyden alustuksessa:', e);
    }
  }

  // Hae selaimen kieli, jos ei aiemmin valittu
  function getDefaultLanguage() {
    const saved = localStorage.getItem('pesu_lang');
    if (saved) return saved;
    const browserLang = navigator.language || navigator.userLanguage || '';
    if (browserLang.toLowerCase().startsWith('fi')) {
      return 'fi';
    }
    return 'en';
  }

  // Tilan hallinta (State)
  const state = {
    currentLang: getDefaultLanguage(),
    currentApt: localStorage.getItem('pesu_apt') || '',
    currentMonday: getMonday(new Date()),
    bookings: [], // Viikon varaukset
    myActiveBookings: [], // Käyttäjän kaikki voimassaolevat varaukset valitulle viikolle
    isOfflineMock: !isSupabaseConfigured // Toimii myös demotilassa paikallisesti ennen kuin käyttäjä syöttää Supabase-avaimet!
  };

  // Demo / Mock-tallennus jos Supabase ei ole vielä kytketty
  let mockBookings = JSON.parse(localStorage.getItem('pesu_mock_bookings') || '[]');

  // DOM-elementit
  const elements = {
    currentAptDisplay: document.getElementById('currentAptDisplay'),
    changeAptBtn: document.getElementById('changeAptBtn'),
    prevWeekBtn: document.getElementById('prevWeekBtn'),
    nextWeekBtn: document.getElementById('nextWeekBtn'),
    todayBtn: document.getElementById('todayBtn'),
    weekTitle: document.getElementById('weekTitle'),
    weekDateRange: document.getElementById('weekDateRange'),
    openBookingModalBtn: document.getElementById('openBookingModalBtn'),
    myBookingAlert: document.getElementById('myBookingAlert'),
    myBookingDetailsText: document.getElementById('myBookingDetailsText'),
    cancelMyBookingBtn: document.getElementById('cancelMyBookingBtn'),
    tableHeaderRow: document.getElementById('tableHeaderRow'),
    tableBody: document.getElementById('tableBody'),
    aptModal: document.getElementById('aptModal'),
    aptInput: document.getElementById('aptInput'),
    saveAptBtn: document.getElementById('saveAptBtn'),
    closeAptModalBtn: document.getElementById('closeAptModalBtn'),
    bookingModal: document.getElementById('bookingModal'),
    bookingForm: document.getElementById('bookingForm'),
    modalApt: document.getElementById('modalApt'),
    bookingDate: document.getElementById('bookingDate'),
    bookingStart: document.getElementById('bookingStart'),
    bookingDuration: document.getElementById('bookingDuration'),
    bookingSummaryRange: document.getElementById('bookingSummaryRange'),
    bookingErrorBox: document.getElementById('bookingErrorBox'),
    closeBookingModalBtn: document.getElementById('closeBookingModalBtn'),
    closeBookingModalX: document.getElementById('closeBookingModalX'),
    toast: document.getElementById('toast'),
    langToggleBtn: document.getElementById('langToggleBtn'),
    openRulesModalBtn: document.getElementById('openRulesModalBtn'),
    rulesModal: document.getElementById('rulesModal'),
    closeRulesModalX: document.getElementById('closeRulesModalX'),
    closeRulesModalBtn: document.getElementById('closeRulesModalBtn')
  };

  // Päivien nimet (Maanantai - Sunnuntai)
  const DAY_NAMES_FI = ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai'];
  const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ============================================================================
  // KIELET & KÄÄNNÖKSET
  // ============================================================================
  const translations = {
    fi: {
      pageTitle: "Kouvolan Asunnot Oy – Pesutuvan varauslista | pesu.sido.fi",
      ownAptLabel: "Oma huoneisto:",
      notSet: "Ei asetettu",
      setBtn: "Aseta",
      openingHours: "Aukioloaika",
      maxDuration: "Varauksen kesto max",
      hours: "tuntia",
      oneSlotOnly: "Vain 1 vuoro kerrallaan",
      cleanAfter: "Muistathan siivota pesutuvan vuorosi jälkeen!",
      thisWeek: "Tämä viikko",
      rulesBtn: "Ohjeet & Säännöt",
      reserveBtn: "Varaa pesuvuoro",
      activeBookingTitle: "Sinulla on voimassaoleva pesuvuoro:",
      cancelBookingBtn: "Peruuta varaus",
      footerNote1: "Merkitsithän huoneistosi numeron oikein.",
      footerNote2: "Noudata pesutuvan järjestyssääntöjä ja vapauta koneet ajoissa seuraavalle asukkaalle!",
      aptModalTitle: "Määritä oma huoneistonumero",
      aptModalDesc: "Syötä huoneistonumerosi (esim. <strong>D23/1</strong>, <strong>A4/1</strong>, <strong>B12/2</strong>). Salasanaa ei tarvita! Asuntonumero säilyy tämän laitteen muistissa.",
      aptModalLabel: "Huoneiston numero / Apartment number:",
      closeBtn: "Sulje",
      saveBtn: "Tallenna",
      bookingModalTitle: "Varaa pesuvuoro / Reserve laundry",
      dateLabel: "Päivämäärä / Date:",
      startTimeLabel: "Aloitusaika:",
      durationLabel: "Kesto (tuntia):",
      bookingSummaryLabel: "Varattava aikaväli:",
      cancelBtn: "Peruuta",
      confirmBtn: "Vahvista varaus",
      rulesModalTitle: "Ohjeet & Säännöt / Rules & Guides",
      weekTitlePrefix: "Viikko",
      dayNames: ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai'],
      freeSlotTitle: "Vapaa - Klikkaa varataksesi",
      pastSlotTitle: "Menneet vuorot",
      bookedSlotTitle: "Varattu asunnolle",
      toastDemo: "⚠️ Demotilassa: Muista päivittää omat Supabase-tunnukset config.js -tiedostoon.",
      toastPast: "Et voi varata menneitä vuoroja.",
      toastAlreadyBooked: "Vuoro on jo varattu asunnolle",
      toastMySlotCancelConfirm: "Haluatko peruuttaa asunnon {apt} varauksen?",
      alertAlreadyBookedMy: "Sinulla on jo varattu vuoro ({time}). Sääntöjen mukaan voit varata vain 1 vuoron kerrallaan! Peruuta ensin edellinen, jos haluat vaihtaa aikaa.",
      errorAptReq: "Syötä huoneiston numero (esim. D23/1)!",
      errorDateReq: "Valitse päivämäärä!",
      errorEndLate: "Pesutupa sulkeutuu klo {end}:00. Vuoro ei voi päättyä tämän jälkeen!",
      errorPast: "Et voi varata menneisyyteen sijoittuvaa aikaa.",
      errorOverlap: "Osa valitsemastasi ajasta on jo varattu toiselle asukkaalle!",
      errorMaxBookings: "Asunnolla {apt} on jo 3 varausta tällä viikolla! Enempää ei voi varata.",
      toastBooked: "Vuoro varattu huoneistolle {apt}!",
      toastCancelConfirm: "Haluatko varmasti peruuttaa huoneiston {apt} pesuvuoron?",
      toastCancelSuccess: "Varaus peruutettu. Aika on nyt vapaa muiden varattavaksi.",
      toastCancelFail: "Peruminen epäonnistui: ",
      toastAptSet: "Oma huoneisto asetettu: ",
      timePrefix: "klo",
      aptLabel: "Huoneisto",
      toastLoadFail: "Tietojen lataus epäonnistui: ",
      warnRealtime: "Realtime ei saatavilla:",
      hourShort: "h",
      errorBookingFail: "Varauksen tallennus epäonnistui",
      devCredit: "Tekninen toteutus ja tuki:",
      loadingWait: "Hetkinen...",
      loadingCanceling: "Peruutetaan...",
      alertMaxBookingsWeek: "Olet jo varannut sallitut 3 tuntia tälle viikolle.",
      activeBookingsTitle: "Sinulla on varauksia ({count}):",
      guideBtn: "Käyttöopas",
      tourStep0Title: "Valitse kieli",
      tourStep0Desc: "Aloita valitsemalla ohjelman kieli tästä painikkeesta.",
      tourStep1Title: "1. Aseta asuntosi numero",
      tourStep1Desc: "Klikkaa tästä ja syötä asuntosi numero (esim. C15/1). Laite muistaa numerosi automaattisesti.",
      tourStep2Title: "2. Varaa pesuvuoro",
      tourStep2Desc: "Klikkaa kalenterista vapaata vihreää ruutua haluamasi ajan kohdalta. Voit varata pesutuvan enintään 3 tunniksi kerrallaan samalla viikolla.",
      tourStep3Title: "3. Omat varaukset & peruutukset",
      tourStep3Desc: "Näet omat varauksesi tässä yläpalkissa. Voit myös peruuttaa varauksesi suoraan tästä tai klikkaamalla sitä kalenterissa.",
      tourDoneBtn: "Valmis",
      tourNextBtn: "Seuraava",
      tourPrevBtn: "Edellinen",
      rulesHtml: `
        <div class="rule-section">
          <h4>Pesutuvan säännöt</h4>
          <ul>
            <li>Vain asukkaiden käyttöön.</li>
            <li>Mattojen pesu kielletty.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Pesuvuoron varaus</h4>
          <ul>
            <li>Varauslistassa on pesuvuorovarauksia samoille asunnoille niin, että vuoroja on varattu useille päiville/viikoille etukäteen. Muistutamme pesutuvan käyttäjiä, että kerrallaan voi varata vain yhden vuoron, jonka kesto on enintään kolme tuntia. <strong>Uuden vuoron voi varata vasta kun on käyttänyt aikaisemman vuoron.</strong></li>
            <li>Pesutuvan sujuvan käytön varmistamiseksi varaukset tulee jatkossa tehdä pesutupaohjeistuksen mukaisesti.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Pyykinpesukoneen puhdistus</h4>
          <ul>
            <li>Puhdista pesuainekotelot mahdollisista jäämistä.</li>
            <li>Puhdista nukkasihti ja pyyhi kumitiiviste kostealla liinalla.</li>
            <li>Jätä pesukoneen luukku ja pesuainekotelo auki käytön jälkeen, jotta kone tuulettuu ja kuivuu.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Kuivauskaapin / nukkasihdin puhdistus</h4>
          <ul>
            <li>Luukussa oleva nukkasihti kerää tekstiileistä irtoavan nukan.</li>
            <li><strong>Puhdista nukkasihti jokaisen kuivauskerran jälkeen</strong> – säästät kuivausaikaa ja energiaa.</li>
            <li>Vedä luukun nukkasihti ylös kotelostaan. Pyyhi nukka sihdin pinnalta. Puhdista myös luukussa oleva tiiviste kostealla liinalla. Laita puhdistettu nukkasihti takaisin paikoilleen.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Sauna (Jukolantie 17)</h4>
          <ul>
            <li>Sijaitsee C-D-talon kellarikerroksessa.</li>
            <li>Lauantaisin: klo 18-19 (naiset) / klo 19-20 (miehet)</li>
          </ul>
        </div>
      `
    },
    en: {
      pageTitle: "Kouvolan Asunnot Oy – Laundry Reservation | pesu.sido.fi",
      ownAptLabel: "My apartment:",
      notSet: "Not set",
      setBtn: "Set",
      openingHours: "Opening hours",
      maxDuration: "Max duration",
      hours: "hours",
      oneSlotOnly: "Only 1 reservation at a time",
      cleanAfter: "Remember to clean the laundry room after use!",
      thisWeek: "This week",
      rulesBtn: "Rules & Guides",
      reserveBtn: "Reserve laundry",
      activeBookingTitle: "You have an active reservation:",
      cancelBookingBtn: "Cancel reservation",
      footerNote1: "Please ensure your apartment number is correct.",
      footerNote2: "Follow the laundry room rules and free the machines on time for the next resident!",
      aptModalTitle: "Set your apartment number",
      aptModalDesc: "Enter your apartment number (e.g. <strong>D23/1</strong>, <strong>A4/1</strong>, <strong>B12/2</strong>). No password required! It is saved locally on this device.",
      aptModalLabel: "Apartment number:",
      closeBtn: "Close",
      saveBtn: "Save",
      bookingModalTitle: "Reserve laundry time",
      dateLabel: "Date:",
      startTimeLabel: "Start time:",
      durationLabel: "Duration (hours):",
      bookingSummaryLabel: "Selected time:",
      cancelBtn: "Cancel",
      confirmBtn: "Confirm reservation",
      rulesModalTitle: "Rules & Guides",
      weekTitlePrefix: "Week",
      dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      freeSlotTitle: "Free - Click to reserve",
      pastSlotTitle: "Past times",
      bookedSlotTitle: "Reserved for apartment",
      toastDemo: "⚠️ Demo mode: Remember to update Supabase credentials in config.js.",
      toastPast: "You cannot reserve past times.",
      toastAlreadyBooked: "Time slot already reserved for apartment",
      toastMySlotCancelConfirm: "Do you want to cancel the reservation for apartment {apt}?",
      alertAlreadyBookedMy: "You already have a reservation ({time}). You can only have 1 active reservation at a time! Cancel the previous one first to change time.",
      errorAptReq: "Enter apartment number (e.g. D23/1)!",
      errorDateReq: "Select a date!",
      errorEndLate: "Laundry room closes at {end}:00. Reservation cannot end after this!",
      errorPast: "You cannot reserve time in the past.",
      errorOverlap: "Part of your selected time is already reserved!",
      errorMaxBookings: "Apartment {apt} already has 3 reservations this week! Limit reached.",
      toastBooked: "Reservation confirmed for apartment {apt}!",
      toastCancelConfirm: "Are you sure you want to cancel reservation for {apt}?",
      toastCancelSuccess: "Reservation cancelled. The time slot is now free.",
      toastCancelFail: "Cancellation failed: ",
      toastAptSet: "My apartment set: ",
      timePrefix: "at",
      aptLabel: "Apartment",
      toastLoadFail: "Failed to load data: ",
      warnRealtime: "Realtime not available:",
      hourShort: "h",
      errorBookingFail: "Failed to save reservation",
      devCredit: "Technical implementation and support:",
      loadingWait: "Please wait...",
      loadingCanceling: "Canceling...",
      alertMaxBookingsWeek: "You have already booked the maximum 3 hours for this week.",
      activeBookingsTitle: "You have active reservations ({count}):",
      guideBtn: "User Guide",
      tourStep0Title: "Select language",
      tourStep0Desc: "Start by selecting your preferred language from this button.",
      tourStep1Title: "1. Set your apartment number",
      tourStep1Desc: "Click here and enter your apartment number (e.g. C15/1). The device will remember your number automatically.",
      tourStep2Title: "2. Book a laundry slot",
      tourStep2Desc: "Click any free green slot on the calendar. You can book the laundry room for up to 3 hours per week.",
      tourStep3Title: "3. Your reservations & cancellations",
      tourStep3Desc: "You can see your reservations in this top bar. You can also cancel your reservation directly from here or by clicking it on the calendar.",
      tourDoneBtn: "Done",
      tourNextBtn: "Next",
      tourPrevBtn: "Previous",
      rulesHtml: `
        <div class="rule-section">
          <h4>Laundry room rules</h4>
          <ul>
            <li>Only for residents.</li>
            <li>Do not wash rugs.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Reserving laundry time</h4>
          <ul>
            <li>There are washing-time reservations in the booking list for the same apartments so that time slots have been reserved for several days/weeks in advance. We would like to remind all laundry room users that you may only reserve one slot at a time, with a maximum duration of three hours. <strong>You can make a new reservation only after you have used your previous slot.</strong></li>
            <li>To ensure the efficient use of the laundry room, reservations must from now on be made in accordance with the laundry room instructions.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Cleaning the washing machine</h4>
          <ul>
            <li>Clean the detergent compartments of any residue.</li>
            <li>Clean the lint filter and wipe the rubber seal with a damp cloth.</li>
            <li>Leave the washing machine door and detergent compartment open after use to allow the machine to ventilate and dry.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Cleaning the lint filter</h4>
          <ul>
            <li>The lint filter in the door collects lint that comes off textiles.</li>
            <li><strong>Clean the lint filter after each use</strong> – this saves drying time and energy.</li>
            <li>Pull the lint filter out of its filter frame in the door. Wipe the lint off the filter. Clean the door gasket with a damp cloth. Return the cleaned lint filter.</li>
          </ul>
        </div>
        <div class="rule-section">
          <h4>Sauna (Jukolantie 17)</h4>
          <ul>
            <li>Sauna is in the basement of the building C-D.</li>
            <li>On Saturdays: 18:00–19:00 (womens) / 19:00–20:00 (mens)</li>
          </ul>
        </div>
      `
    }
  };

  function getT(key, params = {}) {
    let str = translations[state.currentLang][key] || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  }

  function updateLanguage() {
    const t = translations[state.currentLang];
    document.documentElement.lang = state.currentLang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) {
        if (el.tagName === 'INPUT' && el.type === 'text') {
          // Keep placeholder or not? We can just keep it.
        } else {
          el.innerHTML = t[key];
        }
      }
    });

    const rulesContent = document.getElementById('rulesContent');
    if (rulesContent) {
      rulesContent.innerHTML = t.rulesHtml;
    }

    if (elements.langToggleBtn) {
      elements.langToggleBtn.textContent = state.currentLang === 'fi' ? 'EN' : 'FI';
    }

    renderCalendarSkeleton();
    updateCalendarSlots();
    updateAptBadge();
  }

  // ============================================================================
  // ALUSTUS
  // ============================================================================
  function init() {
    updateLanguage();
    updateAptBadge();
    populateTimeSelects();
    renderCalendarSkeleton();
    fetchBookings();
    bindEvents();
    checkFirstVisit();

    if (state.isOfflineMock) {
      showToast(getT('toastDemo'), 6000);
    } else {
      setupRealtime();
    }
  }

  function checkFirstVisit() {
    if (!localStorage.getItem('pesu_guide_seen')) {
      startLiveTour();
    }
  }

  function startLiveTour() {
    // Varmistetaan että driver.js on ladattu
    if (!window.driver) return;

    const driver = window.driver.js.driver;
    const driverObj = driver({
      showProgress: true,
      nextBtnText: getT('tourNextBtn'),
      prevBtnText: getT('tourPrevBtn'),
      doneBtnText: getT('tourDoneBtn'),
      steps: [
        {
          element: '#langToggleBtn',
          popover: {
            title: getT('tourStep0Title'),
            description: getT('tourStep0Desc'),
            side: "bottom",
            align: 'end'
          }
        },
        {
          element: '#changeAptBtn',
          popover: {
            title: getT('tourStep1Title'),
            description: getT('tourStep1Desc'),
            side: "left",
            align: 'start'
          }
        },
        {
          element: '.table-container',
          popover: {
            title: getT('tourStep2Title'),
            description: getT('tourStep2Desc'),
            side: "top",
            align: 'center'
          }
        },
        {
          element: '#myBookingAlert',
          popover: {
            title: getT('tourStep3Title'),
            description: getT('tourStep3Desc'),
            side: "bottom",
            align: 'start'
          }
        }
      ],
      onDestroyed: () => {
        localStorage.setItem('pesu_guide_seen', 'true');
      }
    });
    driverObj.drive();
  }

  // Aseta aloitustunnit valikkoon (07:00 - 21:00)
  function populateTimeSelects() {
    elements.bookingStart.innerHTML = '';
    for (let h = (cfg.START_HOUR || 7); h < (cfg.END_HOUR || 22); h++) {
      const opt = document.createElement('option');
      const timeStr = padZero(h) + ':00';
      opt.value = h;
      opt.textContent = 'klo ' + timeStr;
      elements.bookingStart.appendChild(opt);
    }
    updateBookingSummary();
  }

  // ============================================================================
  // PÄIVÄMÄÄRÄ-APURIT
  // ============================================================================
  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(d, days) {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res;
  }

  function padZero(num) {
    return num < 10 ? '0' + num : num;
  }

  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  function formatDateFI(d) {
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  }

  function formatFullDateFI(d) {
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  }

  // ============================================================================
  // KALENTERIN PIIRTO (Täsmälleen paperilistan kaltainen)
  // ============================================================================
  function renderCalendarSkeleton() {
    const monday = state.currentMonday;
    const sunday = addDays(monday, 6);

    const weekNum = getWeekNumber(monday);
    elements.weekTitle.textContent = `${getT('weekTitlePrefix')} ${weekNum}`;
    elements.weekDateRange.textContent = `${formatDateFI(monday)} – ${formatFullDateFI(sunday)}`;

    // Luodaan otsikkorivi: "klo" + 7 saraketta (Ma - Su)
    elements.tableHeaderRow.innerHTML = '<th class="time-col-header">klo</th>';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(monday, i);
      const isToday = dayDate.getTime() === today.getTime();
      const th = document.createElement('th');
      th.className = 'day-header' + (isToday ? ' today' : '');
      th.innerHTML = `
        <span>${formatDateFI(dayDate)}</span>
        <div>${getT('dayNames')[i]}</div>
      `;
      elements.tableHeaderRow.appendChild(th);
    }

    // Luodaan tuntirivit 07-08 ... 21-22
    elements.tableBody.innerHTML = '';
    const startH = cfg.START_HOUR || 7;
    const endH = cfg.END_HOUR || 22;

    for (let h = startH; h < endH; h++) {
      const tr = document.createElement('tr');

      // Aikasarake (esim. "07 - 08")
      const timeTd = document.createElement('td');
      timeTd.className = 'time-cell';
      timeTd.textContent = `${padZero(h)} - ${padZero(h + 1)}`;
      tr.appendChild(timeTd);

      // 7 päivää
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const slotDate = addDays(monday, dayIdx);
        slotDate.setHours(h, 0, 0, 0);

        const td = document.createElement('td');
        td.className = 'slot-cell free';
        td.dataset.date = slotDate.toISOString();
        td.dataset.hour = h;
        td.dataset.day = dayIdx;

        // Klikkaustapahtuma tunnin kohdalle
        td.addEventListener('click', () => handleSlotClick(slotDate, h));

        tr.appendChild(td);
      }

      elements.tableBody.appendChild(tr);
    }
  }

  // Päivitetään varaukset kalenteriruudukkoon
  function updateCalendarSlots() {
    const cells = elements.tableBody.querySelectorAll('.slot-cell');
    const now = new Date();

    // Nollataan ensin solut
    cells.forEach(cell => {
      cell.className = 'slot-cell free';
      cell.innerHTML = '';
      cell.title = getT('freeSlotTitle');

      const slotDate = new Date(cell.dataset.date);
      const slotEnd = new Date(slotDate);
      slotEnd.setHours(slotDate.getHours() + 1);

      if (slotEnd <= now) {
        cell.className = 'slot-cell past';
        cell.title = getT('pastSlotTitle');
      }
    });

    state.myActiveBookings = state.bookings.filter(b => {
      const endDate = new Date(b.lopetusaika);
      return state.currentApt &&
        b.asunto_numero.toUpperCase() === state.currentApt.toUpperCase() &&
        endDate > now &&
        getWeekNumber(endDate) === getWeekNumber(state.currentMonday) &&
        endDate.getFullYear() === state.currentMonday.getFullYear();
    });

    // Asetetaan varaukset
    state.bookings.forEach(b => {
      const start = new Date(b.aloitusaika);
      const end = new Date(b.lopetusaika);

      // Etsitään ruudukosta solut, jotka osuvat varauksen sisään
      cells.forEach(cell => {
        const slotStart = new Date(cell.dataset.date);
        const slotEnd = new Date(slotStart);
        slotEnd.setHours(slotStart.getHours() + 1);

        // Osuuko tämä 1h slotti varauksen sisään?
        if (slotStart >= start && slotEnd <= end) {
          const isMySlot = state.currentApt && (b.asunto_numero.toUpperCase() === state.currentApt.toUpperCase());
          cell.className = 'slot-cell booked' + (isMySlot ? ' my-slot' : '');
          cell.innerHTML = `<strong>${escapeHtml(b.asunto_numero)}</strong>`;
          cell.title = `${getT('bookedSlotTitle')} ${b.asunto_numero} (${formatTime(start)} - ${formatTime(end)})`;
          cell.dataset.bookingId = b.id;
        }
      });
    });

    renderMyBookingAlert();
  }

  // ============================================================================
  // OMA VARAUS BANNERI
  // ============================================================================
  function renderMyBookingAlert() {
    if (state.myActiveBookings && state.myActiveBookings.length > 0) {
      elements.myBookingAlert.classList.remove('hidden');

      // Etsitään otsikko, johon pistetään määrä
      const titleEl = elements.myBookingAlert.querySelector('h4');
      if (titleEl) {
        titleEl.textContent = getT('activeBookingsTitle', { count: state.myActiveBookings.length });
      }

      let html = '<ul class="active-bookings-list">';
      state.myActiveBookings.forEach(b => {
        const start = new Date(b.aloitusaika);
        const end = new Date(b.lopetusaika);
        const dateStr = `${getT('dayNames')[(start.getDay() + 6) % 7]} ${start.getDate()}.${start.getMonth() + 1}.${start.getFullYear()}`;
        const timeStr = `${getT('timePrefix')} ${formatTime(start)} – ${formatTime(end)}`;

        html += `
          <li>
            <span>${dateStr} ${timeStr}</span>
            <button class="btn-cancel-small" onclick="window.pesuCancelBooking('${b.id}', '${b.asunto_numero}')">✕</button>
          </li>
        `;
      });
      html += '</ul>';

      elements.myBookingDetailsText.innerHTML = html;

      // Piilotetaan alkuperäinen yksittäinen peruutusnappi, jos se on yhä olemassa
      if (elements.cancelMyBookingBtn) {
        elements.cancelMyBookingBtn.style.display = 'none';
      }
    } else {
      elements.myBookingAlert.classList.add('hidden');
    }
  }

  // Globaali funktio html-injektoidulle napille
  window.pesuCancelBooking = function (bookingId, apt) {
    if (confirm(getT('toastCancelConfirm', { apt: apt }))) {
      cancelBooking(bookingId);
    }
  };

  function getMyTotalHoursThisWeek() {
    if (!state.myActiveBookings) return 0;
    return state.myActiveBookings.reduce((sum, b) => {
      const s = new Date(b.aloitusaika);
      const e = new Date(b.lopetusaika);
      return sum + ((e - s) / (1000 * 60 * 60));
    }, 0);
  }

  // ============================================================================
  // VARAUSTEN HAKU & REALTIME
  // ============================================================================
  async function fetchBookings() {
    const monday = state.currentMonday;
    const sundayNext = addDays(monday, 7); // viikon loppu

    if (state.isOfflineMock) {
      // Mock-tila
      state.bookings = mockBookings.filter(b => {
        const d = new Date(b.aloitusaika);
        return d >= monday && d < sundayNext;
      });
      updateCalendarSlots();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('varaukset')
        .select('*')
        .gte('aloitusaika', monday.toISOString())
        .lt('aloitusaika', sundayNext.toISOString());

      if (error) throw error;

      state.bookings = data || [];
      updateCalendarSlots();
    } catch (err) {
      console.error('Virhe haettaessa varauksia:', err);
      showToast(getT('toastLoadFail') + err.message);
    }
  }

  function setupRealtime() {
    if (!supabase) return;
    try {
      supabase
        .channel('public:varaukset')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'varaukset' }, () => {
          fetchBookings();
        })
        .subscribe();
    } catch (e) {
      console.warn(getT('warnRealtime'), e);
    }
  }

  // ============================================================================
  // VARAUKSE TEKO & PERUUTUS
  // ============================================================================
  function handleSlotClick(slotDate, hour) {
    const now = new Date();
    const slotEnd = new Date(slotDate);
    slotEnd.setHours(hour + 1);

    if (slotEnd <= now) {
      showToast(getT('toastPast'));
      return;
    }

    // Jos solussa on jo varaus
    const bookedMatch = state.bookings.find(b => {
      const s = new Date(b.aloitusaika);
      const e = new Date(b.lopetusaika);
      return slotDate >= s && slotEnd <= e;
    });

    if (bookedMatch) {
      if (state.currentApt && bookedMatch.asunto_numero.toUpperCase() === state.currentApt.toUpperCase()) {
        if (confirm(getT('toastMySlotCancelConfirm', { apt: bookedMatch.asunto_numero }))) {
          cancelBooking(bookedMatch.id);
        }
      } else {
        showToast(`${getT('toastAlreadyBooked')} ${bookedMatch.asunto_numero}`);
      }
      return;
    }

    // Avataan varausmodaali klikatulle ajalle
    openBookingModal(slotDate, hour);
  }

  function openBookingModal(date, hour) {
    // Varmistetaan että asunto on tiedossa
    if (!state.currentApt) {
      openAptModal();
      return;
    }

    // Laske montako tuntia on jo varattu
    const totalHours = getMyTotalHoursThisWeek();
    const remainingHours = 3 - totalHours;

    if (remainingHours <= 0) {
      alert(getT('alertMaxBookingsWeek'));
      return;
    }

    const d = date || new Date();
    const yyyy = d.getFullYear();
    const mm = padZero(d.getMonth() + 1);
    const dd = padZero(d.getDate());
    elements.bookingDate.value = `${yyyy}-${mm}-${dd}`;

    elements.bookingStart.value = (hour !== undefined) ? hour : 7;

    // Päivitetään kesto-valikon vaihtoehdot (max jäljellä olevat tunnit)
    const durationSelect = elements.bookingDuration;
    durationSelect.innerHTML = '';
    const maxDuration = Math.min(3, remainingHours);
    for (let i = 1; i <= maxDuration; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      if (i === maxDuration) opt.selected = true;
      durationSelect.appendChild(opt);
    }

    elements.modalApt.value = state.currentApt;
    elements.bookingErrorBox.classList.add('hidden');

    updateBookingSummary();
    elements.bookingModal.classList.remove('hidden');
  }

  function updateBookingSummary() {
    const startH = parseInt(elements.bookingStart.value, 10) || 7;
    const duration = parseInt(elements.bookingDuration.value, 10) || 1;
    let endH = startH + duration;
    if (endH > (cfg.END_HOUR || 22)) {
      endH = cfg.END_HOUR || 22;
    }
    elements.bookingSummaryRange.textContent = `${padZero(startH)}:00 – ${padZero(endH)}:00 (${endH - startH} ${getT('hourShort')})`;
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();
    elements.bookingErrorBox.classList.add('hidden');

    const apt = elements.modalApt.value.trim().toUpperCase();
    if (!apt) {
      showBookingError(getT('errorAptReq'));
      return;
    }

    const dateStr = elements.bookingDate.value; // YYYY-MM-DD
    if (!dateStr) {
      showBookingError(getT('errorDateReq'));
      return;
    }

    const startH = parseInt(elements.bookingStart.value, 10);
    const duration = parseInt(elements.bookingDuration.value, 10);
    const endH = startH + duration;

    if (endH > (cfg.END_HOUR || 22)) {
      showBookingError(getT('errorEndLate', { end: cfg.END_HOUR || 22 }));
      return;
    }

    // Luodaan päivämääräobjektit
    const [year, month, day] = dateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, startH, 0, 0);
    const endDate = new Date(year, month - 1, day, endH, 0, 0);

    const now = new Date();
    if (endDate <= now) {
      showBookingError(getT('errorPast'));
      return;
    }

    // Tallennetaan muistiin nykyinen asunto
    setApt(apt);

    // Tarkistetaan päällekkäisyys lokaalisti ennen lähetystä
    const overlap = state.bookings.some(b => {
      const s = new Date(b.aloitusaika);
      const e = new Date(b.lopetusaika);
      return startDate < e && endDate > s;
    });

    if (overlap) {
      showBookingError(getT('errorOverlap'));
      return;
    }

    // TALLENNUS SUPABASEEN / MOCKIIN
    const submitBtn = elements.bookingForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = getT('loadingWait');
    }

    if (state.isOfflineMock) {
      // Mock-tallennus
      const userBookings = mockBookings.filter(b => b.asunto_numero.toUpperCase() === apt && new Date(b.lopetusaika) > now);
      const totalHoursMock = userBookings.reduce((sum, b) => {
        const s = new Date(b.aloitusaika);
        const e = new Date(b.lopetusaika);
        return sum + ((e - s) / (1000 * 60 * 60));
      }, 0);

      if (totalHoursMock + duration > 3) {
        showBookingError(getT('alertMaxBookingsWeek'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
        return;
      }

      const newBooking = {
        id: 'mock-' + Date.now(),
        asunto_numero: apt,
        aloitusaika: startDate.toISOString(),
        lopetusaika: endDate.toISOString(),
        kuitattu_alkaneeksi: false,
        luotu_pvm: new Date().toISOString()
      };
      mockBookings.push(newBooking);
      localStorage.setItem('pesu_mock_bookings', JSON.stringify(mockBookings));

      showToast(getT('toastBooked', { apt: apt }));
      elements.bookingModal.classList.add('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
      fetchBookings();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('varaukset')
        .insert([
          {
            asunto_numero: apt,
            aloitusaika: startDate.toISOString(),
            lopetusaika: endDate.toISOString(),
            kuitattu_alkaneeksi: false
          }
        ])
        .select();

      if (error) throw error;

      showToast(getT('toastBooked', { apt: apt }));
      elements.bookingModal.classList.add('hidden');
      fetchBookings();
    } catch (err) {
      console.error('Varausvirhe:', err);
      showBookingError(err.message || getT('errorBookingFail'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  }

  async function cancelBooking(bookingId) {
    showToast(getT('loadingCanceling'));

    if (state.isOfflineMock) {
      mockBookings = mockBookings.filter(b => b.id !== bookingId);
      localStorage.setItem('pesu_mock_bookings', JSON.stringify(mockBookings));
      setTimeout(() => {
        showToast(getT('toastCancelSuccess'));
        fetchBookings();
      }, 500);
      return;
    }

    try {
      const { error } = await supabase
        .from('varaukset')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      showToast(getT('toastCancelSuccess'));
      fetchBookings();
    } catch (err) {
      console.error('Peruutusvirhe:', err);
      showToast(getT('toastCancelFail') + err.message);
    }
  }

  function showBookingError(msg) {
    elements.bookingErrorBox.innerHTML = msg;
    elements.bookingErrorBox.classList.remove('hidden');
  }

  // ============================================================================
  // ASUNTONUMERON HALLINTA
  // ============================================================================
  function setApt(apt) {
    state.currentApt = apt.trim().toUpperCase();
    localStorage.setItem('pesu_apt', state.currentApt);
    updateLanguage();
    updateAptBadge();
    updateCalendarSlots();
  }

  function updateAptBadge() {
    if (state.currentApt) {
      elements.currentAptDisplay.textContent = state.currentApt;
      elements.changeAptBtn.textContent = getT('setBtn');
    } else {
      elements.currentAptDisplay.textContent = getT('notSet');
      elements.changeAptBtn.textContent = getT('setBtn');
    }
  }

  function openAptModal() {
    elements.aptInput.value = state.currentApt || '';
    elements.aptModal.classList.remove('hidden');
    setTimeout(() => elements.aptInput.focus(), 50);
  }

  // ============================================================================
  // TAPAHTUMANKÄSITTELIJÄT
  // ============================================================================
  function bindEvents() {

    // Guide Modal
    const openGuideModalBtn = document.getElementById('openGuideModalBtn');
    if (openGuideModalBtn) openGuideModalBtn.addEventListener('click', startLiveTour);

    // Kielen vaihto
    if (elements.langToggleBtn) {
      elements.langToggleBtn.addEventListener('click', () => {
        state.currentLang = state.currentLang === 'fi' ? 'en' : 'fi';
        localStorage.setItem('pesu_lang', state.currentLang);
        updateLanguage();
      });
    }

    // Ohjeet-modaali
    if (elements.openRulesModalBtn) {
      elements.openRulesModalBtn.addEventListener('click', () => {
        elements.rulesModal.classList.remove('hidden');
      });
    }
    if (elements.closeRulesModalX) {
      elements.closeRulesModalX.addEventListener('click', () => {
        elements.rulesModal.classList.add('hidden');
      });
    }
    if (elements.closeRulesModalBtn) {
      elements.closeRulesModalBtn.addEventListener('click', () => {
        elements.rulesModal.classList.add('hidden');
      });
    }

    // Asunnon valinta
    elements.changeAptBtn.addEventListener('click', openAptModal);
    elements.closeAptModalBtn.addEventListener('click', () => elements.aptModal.classList.add('hidden'));
    elements.saveAptBtn.addEventListener('click', () => {
      const val = elements.aptInput.value.trim();
      if (val) {
        setApt(val);
        elements.aptModal.classList.add('hidden');
        showToast(getT('toastAptSet') + state.currentApt);
      }
    });

    // Viikkonavigaatio
    elements.prevWeekBtn.addEventListener('click', () => {
      state.currentMonday = addDays(state.currentMonday, -7);
      renderCalendarSkeleton();
      fetchBookings();
    });

    elements.nextWeekBtn.addEventListener('click', () => {
      state.currentMonday = addDays(state.currentMonday, 7);
      renderCalendarSkeleton();
      fetchBookings();
    });

    elements.todayBtn.addEventListener('click', () => {
      state.currentMonday = getMonday(new Date());
      renderCalendarSkeleton();
      fetchBookings();
    });

    // Varausmodaali
    elements.openBookingModalBtn.addEventListener('click', () => {
      openBookingModal(new Date());
    });

    elements.closeBookingModalBtn.addEventListener('click', () => {
      elements.bookingModal.classList.add('hidden');
    });

    elements.closeBookingModalX.addEventListener('click', () => {
      elements.bookingModal.classList.add('hidden');
    });

    elements.bookingStart.addEventListener('change', updateBookingSummary);
    elements.bookingDuration.addEventListener('change', updateBookingSummary);
    elements.bookingForm.addEventListener('submit', handleBookingSubmit);

    // Peruuta oma varaus yläpalkista
    elements.cancelMyBookingBtn.addEventListener('click', () => {
      if (state.myActiveBooking) {
        if (confirm(getT('toastCancelConfirm', { apt: state.myActiveBooking.asunto_numero }))) {
          cancelBooking(state.myActiveBooking.id);
        }
      }
    });
  }

  // ============================================================================
  // APUTOIMINNOT
  // ============================================================================
  function formatTime(d) {
    return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  let toastTimer = null;
  function showToast(msg, duration = 3500) {
    elements.toast.innerHTML = msg;
    elements.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, duration);
  }

  // Käynnistetään kun sivu on latautunut
  document.addEventListener('DOMContentLoaded', init);

})();
