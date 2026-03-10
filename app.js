// app.js

const CATEGORIES = ['Otomobil', 'Minibüs', 'Midibüs', 'Otobüs', 'Motosiklet', 'Yaya'];

// Varsayılan fiyatlar
const defaultPrices = CATEGORIES.map(cat => ({
    category: cat,
    price: 0,
    effectiveDate: '1900-01-01'
}));

let state = {
    prices: JSON.parse(localStorage.getItem('gg_prices')) || defaultPrices,
    monthlyData: JSON.parse(localStorage.getItem('gg_monthly')) || {},
    guestData: JSON.parse(localStorage.getItem('gg_guest')) || {}
};

// Eski 2020 tarihli defaultları 1900'e çekme (Migration)
state.prices = state.prices.map(p => {
    if (p.effectiveDate === '2020-01-01' && p.price === 0) {
        return { ...p, effectiveDate: '1900-01-01' };
    }
    return p;
});

// Veriyi kaydetme
function saveState() {
    localStorage.setItem('gg_prices', JSON.stringify(state.prices));
    localStorage.setItem('gg_monthly', JSON.stringify(state.monthlyData));
    localStorage.setItem('gg_guest', JSON.stringify(state.guestData));
}

// Formatlayıcılar
const moneyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

// Girilen tarihe uyan aktif fiyatı getirme
function getPriceForDate(category, dateStr) {
    const applicablePrices = state.prices
        .filter(p => p.category === category && p.effectiveDate <= dateStr)
        .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));

    return applicablePrices.length > 0 ? parseFloat(applicablePrices[0].price) : 0;
}

// Navigasyon Mantığı (Sayfalar Arası Geçiş)
document.querySelectorAll('.nav-links li').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-links li').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'dashboard') updateDashboard();
        if (targetId === 'monthly') renderMonthlyTable();
        if (targetId === 'settings') renderSettings();
    });
});

// Ayarlar ve Fiyat Güncelleme Mantığı
// Bugünkü tarihi default set edelim
document.getElementById('price-date').value = new Date().toISOString().split('T')[0];

document.getElementById('price-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('price-category').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const date = document.getElementById('price-date').value;

    // Eğer aynı kategori ve tarih için zaten bir kayıt varsa onu güncelle, yoksa yeni ekle
    const existingIndex = state.prices.findIndex(p => p.category === category && p.effectiveDate === date);
    
    if (existingIndex > -1) {
        state.prices[existingIndex].price = price;
    } else {
        state.prices.push({
            category,
            price: price,
            effectiveDate: date
        });
    }

    saveState();
    renderSettings();
    updateDashboard(); // Geçmiş Fiyatları etkilerse

    // reset ama tarihi koru
    document.getElementById('new-price').value = '';
    alert('Fiyat güncellendi!');
});

function renderSettings() {
    const list = document.getElementById('current-prices-list');
    list.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    CATEGORIES.forEach(cat => {
        const price = getPriceForDate(cat, today);
        const li = document.createElement('li');
        li.innerHTML = `<span><strong style="color:var(--text-primary)">${cat}</strong> Güncel Fiyatı</span> <span style="color:var(--accent-color)">${moneyFormatter.format(price)}</span>`;
        list.appendChild(li);
    });
}


// Aylık Çizelge Mantığı
let currentDisplayedDate = new Date();

document.getElementById('prev-month').addEventListener('click', () => {
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() - 1);
    renderMonthlyTable();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() + 1);
    renderMonthlyTable();
});

// SADECE PAZAR GÜNLERİNİ DÖNDÜREN FONKSİYON
function getSundays(year, month) {
    let sundays = [];
    let d = new Date(year, month, 1);

    // Ayın ilk pazarını bul
    if (d.getDay() !== 0) {
        d.setDate(d.getDate() + (7 - d.getDay()));
    }

    while (d.getMonth() === month) {
        // Güvenli YYYY-MM-DD local format
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        sundays.push(`${y}-${m}-${day}`);
        d.setDate(d.getDate() + 7);
    }
    return sundays;
}

function handleInput(e, dateStr, field) {
    const valStr = e.target.value;
    const val = parseFloat(valStr);

    if (!state.monthlyData[dateStr]) {
        state.monthlyData[dateStr] = {};
    }

    // Eğer girdi silinmişse 0 veya boş kabul et
    if (isNaN(val)) {
        state.monthlyData[dateStr][field] = 0;
    } else {
        state.monthlyData[dateStr][field] = val;
    }

    saveState();
    renderMonthlyTable(); // Genel toplamı live güncellemek için
    updateDashboard(); // Dashboardı da arkada günceller
}

function handleGuestInput(e, dateStr, field) {
    const valStr = e.target.value;
    const val = parseInt(valStr);

    if (!state.guestData[dateStr]) {
        state.guestData[dateStr] = {};
    }

    if (isNaN(val)) {
        state.guestData[dateStr][field] = 0;
    } else {
        state.guestData[dateStr][field] = val;
    }

    saveState();
    renderMonthlyTable();
}

function renderMonthlyTable() {
    const year = currentDisplayedDate.getFullYear();
    const month = currentDisplayedDate.getMonth();

    const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(currentDisplayedDate);
    document.getElementById('current-month-display').innerText = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const sundays = getSundays(year, month);
    const tbody = document.getElementById('monthly-tbody');
    const tfoot = document.getElementById('monthly-tfoot');
    const gTbody = document.getElementById('guest-tbody');
    const gTfoot = document.getElementById('guest-tfoot');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    gTbody.innerHTML = '';
    gTfoot.innerHTML = '';

    let grandTotals = { Otomobil: 0, Minibüs: 0, Midibüs: 0, Otobüs: 0, Motosiklet: 0, Yaya: 0, BufeIncome: 0, BufeExpense: 0, Money: 0 };
    let guestTotals = { Otomobil: 0, Minibüs: 0, Midibüs: 0, Otobüs: 0, Motosiklet: 0, Yaya: 0 };

    sundays.forEach(dateStr => {
        const tr = document.createElement('tr');

        // Tarih Hücresi (Pazar)
        const tdDate = document.createElement('td');
        const dObj = new Date(dateStr);
        tdDate.innerText = `${String(dObj.getDate()).padStart(2, '0')}.${String(dObj.getMonth() + 1).padStart(2, '0')}`;
        tdDate.style.fontWeight = '600';
        tr.appendChild(tdDate);

        let dayTotalMoney = 0;

        CATEGORIES.forEach(cat => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';

            const count = state.monthlyData[dateStr]?.[cat];
            input.value = count !== undefined && count !== 0 ? count : '';

            // Kullanıcı sayı girdikçe blur atarak tetikler
            input.addEventListener('change', (e) => handleInput(e, dateStr, cat));

            // Para ve toplam hesaplaması
            if (count && count > 0) {
                const price = getPriceForDate(cat, dateStr);
                dayTotalMoney += (count * price);
                grandTotals[cat] += parseInt(count);
            }

            td.appendChild(input);
            tr.appendChild(td);
        });

        // Büfe Gelir
        const tdBufeIncome = document.createElement('td');
        const inputBufeIncome = document.createElement('input');
        inputBufeIncome.type = 'number';
        inputBufeIncome.min = '0';
        inputBufeIncome.step = '0.01';
        const bIncome = state.monthlyData[dateStr]?.bufeIncome || 0;
        inputBufeIncome.value = bIncome !== 0 ? bIncome : '';
        inputBufeIncome.addEventListener('change', (e) => handleInput(e, dateStr, 'bufeIncome'));
        tdBufeIncome.appendChild(inputBufeIncome);
        tr.appendChild(tdBufeIncome);
        grandTotals.BufeIncome += bIncome;

        // Büfe Gider
        const tdBufeExpense = document.createElement('td');
        const inputBufeExpense = document.createElement('input');
        inputBufeExpense.type = 'number';
        inputBufeExpense.min = '0';
        inputBufeExpense.step = '0.01';
        const bExpense = state.monthlyData[dateStr]?.bufeExpense || 0;
        inputBufeExpense.value = bExpense !== 0 ? bExpense : '';
        inputBufeExpense.addEventListener('change', (e) => handleInput(e, dateStr, 'bufeExpense'));
        tdBufeExpense.appendChild(inputBufeExpense);
        tr.appendChild(tdBufeExpense);
        grandTotals.BufeExpense += bExpense;

        // Net hesabına büfeyi ekle
        dayTotalMoney += (bIncome - bExpense);

        // Günlük toplam gelir
        const tdTotal = document.createElement('td');
        tdTotal.className = 'total-cell';
        tdTotal.innerText = moneyFormatter.format(dayTotalMoney);
        tr.appendChild(tdTotal);

        grandTotals.Money += dayTotalMoney;
        tbody.appendChild(tr);

        // --- Guest Row Logic ---
        const gTr = document.createElement('tr');
        const gTdDate = document.createElement('td');
        gTdDate.innerText = `${String(dObj.getDate()).padStart(2, '0')}.${String(dObj.getMonth() + 1).padStart(2, '0')}`;
        gTdDate.style.fontWeight = '600';
        gTr.appendChild(gTdDate);

        CATEGORIES.forEach(cat => {
            const gTd = document.createElement('td');
            const gInput = document.createElement('input');
            gInput.type = 'number';
            gInput.min = '0';

            const gCount = state.guestData[dateStr]?.[cat];
            gInput.value = gCount !== undefined && gCount !== 0 ? gCount : '';

            gInput.addEventListener('change', (e) => handleGuestInput(e, dateStr, cat));

            if (gCount && gCount > 0) {
                guestTotals[cat] += parseInt(gCount);
            }

            gTd.appendChild(gInput);
            gTr.appendChild(gTd);
        });
        gTbody.appendChild(gTr);
    });

    // Aylık Tablo Ayağı (TFOOT)
    const tfTr = document.createElement('tr');
    const tfTitle = document.createElement('th');
    tfTitle.innerText = 'AYLIK TOPLAM';
    tfTr.appendChild(tfTitle);

    CATEGORIES.forEach(cat => {
        const td = document.createElement('th');
        td.innerText = grandTotals[cat] || 0;
        tfTr.appendChild(td);
    });

    const tfBufeIncome = document.createElement('th');
    tfBufeIncome.innerText = moneyFormatter.format(grandTotals.BufeIncome);
    tfTr.appendChild(tfBufeIncome);

    const tfBufeExpense = document.createElement('th');
    tfBufeExpense.innerText = moneyFormatter.format(grandTotals.BufeExpense);
    tfTr.appendChild(tfBufeExpense);

    const tfMoney = document.createElement('th');
    tfMoney.innerText = moneyFormatter.format(grandTotals.Money);
    tfTr.appendChild(tfMoney);

    tfoot.appendChild(tfTr);

    // Guest Table tfoot
    const gTfTr = document.createElement('tr');
    const gTfTitle = document.createElement('th');
    gTfTitle.innerText = 'AYLIK TOPLAM';
    gTfTr.appendChild(gTfTitle);

    CATEGORIES.forEach(cat => {
        const td = document.createElement('th');
        td.innerText = guestTotals[cat] || 0;
        gTfTr.appendChild(td);
    });

    gTfoot.appendChild(gTfTr);
}

// Ana Sayfa Dashboard Mantığı
function updateDashboard(startDate = null, endDate = null) {
    let sumIncome = 0;
    let sumBufeIncome = 0;
    let sumBufeExpense = 0;

    // Araç sayılarını tutacak objeler
    let vehicleCounts = {};
    CATEGORIES.forEach(c => vehicleCounts[c] = { paid: 0, guest: 0 });

    let filteredDates = Object.keys(state.monthlyData);
    let filteredGuestDates = Object.keys(state.guestData);

    if (startDate) {
        filteredDates = filteredDates.filter(d => d >= startDate);
        filteredGuestDates = filteredGuestDates.filter(d => d >= startDate);
    }
    if (endDate) {
        filteredDates = filteredDates.filter(d => d <= endDate);
        filteredGuestDates = filteredGuestDates.filter(d => d <= endDate);
    }

    filteredDates.forEach(dateStr => {
        const dayData = state.monthlyData[dateStr];
        CATEGORIES.forEach(cat => {
            if (dayData[cat]) {
                const count = parseInt(dayData[cat]);
                const price = getPriceForDate(cat, dateStr);
                sumIncome += (count * price);
                vehicleCounts[cat].paid += count;
            }
        });

        if (dayData.bufeIncome) sumBufeIncome += dayData.bufeIncome;
        if (dayData.bufeExpense) sumBufeExpense += dayData.bufeExpense;
    });

    let guestLoss = 0;
    filteredGuestDates.forEach(dateStr => {
        const guestDataDay = state.guestData[dateStr];
        CATEGORIES.forEach(cat => {
            if (guestDataDay[cat]) {
                const count = parseInt(guestDataDay[cat]);
                vehicleCounts[cat].guest += count;
                const price = getPriceForDate(cat, dateStr);
                guestLoss += (count * price);
            }
        });
    });

    const netBufe = sumBufeIncome - sumBufeExpense;
    const finalNet = sumIncome + netBufe;

    document.getElementById('sum-income').innerText = moneyFormatter.format(sumIncome);
    document.getElementById('sum-bufe-net').innerText = moneyFormatter.format(netBufe);
    document.getElementById('sum-net').innerText = moneyFormatter.format(finalNet);
    document.getElementById('sum-guest-loss').innerText = moneyFormatter.format(guestLoss);

    const dateLabel = document.getElementById('dashboard-date');
    if (startDate || endDate) {
        const startText = startDate ? dateFormatter.format(new Date(startDate)) : 'Başlangıç';
        const endText = endDate ? dateFormatter.format(new Date(endDate)) : 'Bugün';
        dateLabel.innerText = `${startText} - ${endText} Arası Rapor`;
    } else {
        dateLabel.innerText = 'Tarih aralığı seçerek özet tabloyu filtreleyin';
    }

    // Araç Kartlarını Render Et
    const statsContainer = document.getElementById('vehicle-stats-container');
    statsContainer.innerHTML = '';

    CATEGORIES.forEach(cat => {
        const stat = vehicleCounts[cat];
        if (stat.paid > 0 || stat.guest > 0) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.padding = '1rem';
            card.innerHTML = `
                <h3 style="margin-bottom: 0.5rem; font-size: 0.95rem; color: #fff;">${cat}</h3>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3rem; margin-bottom: 0.3rem;">
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">Ücretli:</span>
                    <strong style="color: var(--accent-color);">${stat.paid}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3rem; margin-bottom: 0.3rem;">
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">Misafir:</span>
                    <strong style="color: #58a6ff;">${stat.guest}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                    <span style="color: var(--text-primary); font-size: 0.9rem; font-weight: 500;">Toplam:</span>
                    <strong style="color: #fff; font-size: 1.1rem;">${stat.paid + stat.guest}</strong>
                </div>
            `;
            statsContainer.appendChild(card);
        }
    });

    if (statsContainer.innerHTML === '') {
        statsContainer.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Bu tarih aralığında henüz araç geçişi bulunmuyor.</p>';
    }
}


// Dashboard Event Listeners
document.getElementById('btn-filter').addEventListener('click', () => {
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    updateDashboard(start, end);
});

document.getElementById('btn-reset-filter').addEventListener('click', () => {
    document.getElementById('filter-start').value = '';
    document.getElementById('filter-end').value = '';
    updateDashboard();
});

// --- Yedekleme (Backup / Restore) İşlemleri ---
document.getElementById('btn-export').addEventListener('click', () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().split('T')[0];
    a.download = `GelirGider_Yedek_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.getElementById('btn-import-trigger').addEventListener('click', () => {
    document.getElementById('file-import').click();
});

document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (confirm("DİKKAT! Yüklediğiniz dosyadaki veriler, sistemdeki tüm verilerin yerini alacak. Onaylıyor musunuz?")) {
        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const importedData = JSON.parse(evt.target.result);

                if (importedData.prices && importedData.monthlyData) {
                    state = importedData;

                    // Eksik listeleri tamamla
                    if (!state.guestData) state.guestData = {};

                    saveState();
                    alert("Yedek başarıyla yüklendi! Sayfa yenileniyor...");
                    window.location.reload();
                } else {
                    alert("Hatalı veya eksik yedek dosyası!");
                }
            } catch (err) {
                alert("Dosya okuma hatası. Lütfen geçerli bir JSON dosyası seçin.");
            }
        };
        reader.readAsText(file);
    }
    // Seçimi temizle
    e.target.value = '';
});

// Başlatma ve Event Listenerlar ilk setup
updateDashboard();
renderSettings();
if (document.getElementById('monthly').classList.contains('active')) {
    renderMonthlyTable();
}
