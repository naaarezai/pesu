// ==============================================================================
// KOUVOLAN ASUNNOT OY - PESUTUVAN VARAUSJÄRJESTELMÄ (pesu.sido.fi)
// Frontend-sovelluslogiikka & Supabase-integraatio
// ==============================================================================

(function() {
  'use strict';

  // Alustetaan Supabase-asiakas
  let supabase = null;
  const cfg = window.APP_CONFIG || {};

  const isSupabaseConfigured = cfg.SUPABASE_URL && 
    cfg.SUPABASE_URL !== 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co' &&
    cfg.SUPABASE_ANON_KEY && 
    cfg.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

  if (isSupabaseConfigured && window.supabase) {
    try {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } catch (e) {
      console.error('Virhe Supabase-yhteyden alustuksessa:', e);
    }
  }

  // Tilan hallinta (State)
  const state = {
    currentLang: localStorage.getItem('pesu_lang') || 'fi',
    currentApt: localStorage.getItem('pesu_apt') || '',
    currentMonday: getMonday(new Date()),
    bookings: [], // Viikon varaukset
    myActiveBooking: null,
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
  // ALUSTUS
  // ============================================================================
  function init() {
    updateLanguage();
    updateAptBadge();
    populateTimeSelects();
    renderCalendarSkeleton();
    fetchBookings();
    bindEvents();

    if (state.isOfflineMock) {
      showToast(getT('toastDemo'), 6000);
    } else {
      setupRealtime();
    }
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

    let activeUserBooking = null;

    // Asetetaan varaukset
    state.bookings.forEach(b => {
      const start = new Date(b.aloitusaika);
      const end = new Date(b.lopetusaika);

      // Tarkistetaan onko käyttäjän oma varaus ja tulevaisuudessa
      if (state.currentApt && b.asunto_numero.toUpperCase() === state.currentApt.toUpperCase()) {
        if (end > now) {
          activeUserBooking = b;
        }
      }

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

    state.myActiveBooking = activeUserBooking;
    renderMyBookingAlert();
  }

  // ============================================================================
  // OMA VARAUS BANNERI
  // ============================================================================
  function renderMyBookingAlert() {
    if (state.myActiveBooking) {
      const b = state.myActiveBooking;
      const start = new Date(b.aloitusaika);
      const end = new Date(b.lopetusaika);
      const dateStr = `${getT('dayNames')[(start.getDay() + 6) % 7]} ${start.getDate()}.${start.getMonth() + 1}.${start.getFullYear()}`;
      elements.myBookingDetailsText.textContent = `${dateStr} klo ${formatTime(start)} – ${formatTime(end)} (Huoneisto: ${b.asunto_numero})`;
      elements.myBookingAlert.classList.remove('hidden');
    } else {
      elements.myBookingAlert.classList.add('hidden');
    }
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
      showToast('Tietojen lataus epäonnistui: ' + err.message);
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
      console.warn('Realtime ei saatavilla:', e);
    }
  }

  // ============================================================================
  // VARAUKSEN TEKO & PERUUTUS
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
        if (confirm(getT('toastMySlotCancelConfirm', {apt: bookedMatch.asunto_numero}))) {
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

    // Tarkistetaan onko jo tuleva varaus
    if (state.myActiveBooking) {
      alert(getT('alertAlreadyBookedMy', {time: elements.myBookingDetailsText.textContent}));
      return;
    }

    const d = date || new Date();
    const yyyy = d.getFullYear();
    const mm = padZero(d.getMonth() + 1);
    const dd = padZero(d.getDate());
    elements.bookingDate.value = `${yyyy}-${mm}-${dd}`;

    elements.bookingStart.value = (hour !== undefined) ? hour : 7;
    elements.bookingDuration.value = 3; // Oletuksena 3h
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
    elements.bookingSummaryRange.textContent = `${padZero(startH)}:00 – ${padZero(endH)}:00 (${endH - startH} h)`;
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
      showBookingError(getT('errorEndLate', {end: cfg.END_HOUR || 22}));
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
    if (state.isOfflineMock) {
      // Mock-tallennus
      // Tarkistetaan tuplavaraus
      const existing = mockBookings.find(b => b.asunto_numero.toUpperCase() === apt && new Date(b.lopetusaika) > now);
      if (existing) {
        showBookingError(getT('errorMaxBookings', {apt: apt}));
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
      
      showToast(getT('toastBooked', {apt: apt}));
      elements.bookingModal.classList.add('hidden');
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

      showToast(getT('toastBooked', {apt: apt}));
      elements.bookingModal.classList.add('hidden');
      fetchBookings();
    } catch (err) {
      console.error('Varausvirhe:', err);
      showBookingError(err.message || 'Varauksen tallennus epäonnistui');
    }
  }

  async function cancelBooking(bookingId) {
    if (state.isOfflineMock) {
      mockBookings = mockBookings.filter(b => b.id !== bookingId);
      localStorage.setItem('pesu_mock_bookings', JSON.stringify(mockBookings));
      showToast(getT('toastCancelSuccess'));
      fetchBookings();
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
        if (confirm(getT('toastCancelConfirm', {apt: state.myActiveBooking.asunto_numero}))) {
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
