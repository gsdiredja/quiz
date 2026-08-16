let currentQuestionIndex = 0;
let questionsData = [];
let userAnswers = {};

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzvkDw9Jgk811hgKQzPeZrbbbCK5Hz7c0oI1uyNETD2uiE7Nkpybif28sY_J6NiJvsz/exec";

let EXAM_DURATION_MINUTES = 60;
let totalSeconds = EXAM_DURATION_MINUTES * 60;
let timerInterval = null;
let currentUsername = "";
let currentUserData = {};

function getCleanPaketId(rawPath) {
  if (!rawPath) return "soal-uh1";
  return String(rawPath)
    .replace(/^.*[\\\/]/, '') 
    .replace('.json', '')      
    .trim()
    .toLowerCase();
}

function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  let shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("questionsContainer");
  
  try {
    let userDataStr = localStorage.getItem("userData");
    let rawSoalPath = localStorage.getItem("soalPath");

    if (!userDataStr) {
      window.location.href = "index.html";
      return;
    }

    if (!rawSoalPath || rawSoalPath === "undefined") {
      rawSoalPath = "soal-uh1";
    }

    try {
      currentUserData = JSON.parse(userDataStr);
    } catch(e) {
      currentUserData = { username: "siswa", nama: "Siswa", kelas: "-" };
    }
    
    currentUsername = currentUserData.username || "siswa";
    const cleanPaketId = getCleanPaketId(rawSoalPath);

    const userInfoEl = document.getElementById("userInfo");
    if (userInfoEl) {
      userInfoEl.innerHTML = `
        PESERTA: <strong>${currentUserData.nama || currentUserData.username}</strong> | KELAS: <strong>${currentUserData.kelas || '-'}</strong> | NISN: <strong>${currentUserData.username}</strong>
      `;
    }

    // Ambil nomor soal terakhir yang sedang dikerjakan agar siswa tidak reset nomor saat refresh
    const savedLastIndex = localStorage.getItem(`currentIndex_${currentUsername}_${cleanPaketId}`);
    if (savedLastIndex !== null && !isNaN(parseInt(savedLastIndex))) {
      currentQuestionIndex = parseInt(savedLastIndex, 10);
    }

    const savedRemainingTime = localStorage.getItem(`remainingTime_${currentUsername}_${cleanPaketId}`);
    if (savedRemainingTime !== null && !isNaN(parseInt(savedRemainingTime))) {
      totalSeconds = parseInt(savedRemainingTime, 10);
    }

    startTimer();

    const cachedQuestionsKey = `questions_${currentUsername}_${cleanPaketId}`;
    const savedAnswersKey = `answers_${currentUsername}_${cleanPaketId}`;

    const savedUserAnswers = localStorage.getItem(savedAnswersKey);
    if (savedUserAnswers) {
      try { userAnswers = JSON.parse(savedUserAnswers); } catch(e) { userAnswers = {}; }
    }

    const cachedQuestions = localStorage.getItem(cachedQuestionsKey);

    if (cachedQuestions) {
      questionsData = JSON.parse(cachedQuestions);
      if (currentQuestionIndex >= questionsData.length) {
        currentQuestionIndex = questionsData.length - 1;
      }
      renderNumberGrid();
      showQuestion(currentQuestionIndex);
    } else {
      let loaded = false;
      let rawLoadedQuestions = null;

      try {
        const response = await fetch(SCRIPT_URL, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getquestions", paket: cleanPaketId })
        });
        const result = await response.json();
        if (result.status === "success" && result.data) {
          rawLoadedQuestions = result.data;
          loaded = true;
        }
      } catch(err) {
        console.warn("Gagal load dari GAS, mencoba lokal file...", err);
      }

      if (!loaded) {
        let targetLocalPath = rawSoalPath;
        if (!targetLocalPath.startsWith('./') && !targetLocalPath.startsWith('data/')) {
          targetLocalPath = `./data/${cleanPaketId}.json`;
        }

        try {
          const localRes = await fetch(targetLocalPath);
          if (localRes.ok) {
            const localData = await localRes.json();
            if (localData) {
              rawLoadedQuestions = localData;
              loaded = true;
            }
          }
        } catch(err) {
          console.error("Gagal load lokal JSON...", err);
        }
      }

      if (loaded && rawLoadedQuestions) {
        let finalArray = [];
        let maxQty = 0;

        if (!Array.isArray(rawLoadedQuestions) && rawLoadedQuestions.questions) {
          maxQty = rawLoadedQuestions.maxQuestions || 0;
          finalArray = rawLoadedQuestions.questions;
        } else if (Array.isArray(rawLoadedQuestions)) {
          finalArray = rawLoadedQuestions;
        }

        let shuffledAll = shuffleArray(finalArray);

        if (maxQty > 0 && maxQty < shuffledAll.length) {
          questionsData = shuffledAll.slice(0, maxQty);
        } else {
          questionsData = shuffledAll;
        }

        questionsData.forEach((q) => {
          if (q.options && Array.isArray(q.options) && q.type !== "boolean") {
            q.options = shuffleArray(q.options);
          }
          if (q.matchOptions && Array.isArray(q.matchOptions)) {
            q.matchOptions = shuffleArray(q.matchOptions);
          }
        });

        localStorage.setItem(cachedQuestionsKey, JSON.stringify(questionsData));
        renderNumberGrid();
        showQuestion(currentQuestionIndex);
      } else {
        if (container) {
          container.innerHTML = `
            <div style="color: #dc2626; padding: 30px; text-align: center; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
              <h3 style="margin-bottom: 8px;">⚠️ Soal Ujian Tidak Ditemukan!</h3>
              <p style="font-size: 0.9rem; color: #991b1b;">
                Paket soal <code>"${cleanPaketId}"</code> belum tersedia di Spreadsheet atau file lokal.<br>
                Silakan kembali ke menu Login dan pilih paket soal yang valid.
              </p>
            </div>
          `;
        }
      }
    }

  } catch (fatalError) {
    if (container) {
      container.innerHTML = `
        <div style="color: #dc2626; padding: 20px; text-align: center;">
          <p><strong>Terjadi Kesalahan Sistem:</strong> ${fatalError.message}</p>
        </div>
      `;
    }
  }
});

function startTimer() {
  updateTimerDisplay();
  const cleanPaketId = getCleanPaketId(localStorage.getItem("soalPath"));
  
  timerInterval = setInterval(() => {
    totalSeconds--;
    if (currentUsername) localStorage.setItem(`remainingTime_${currentUsername}_${cleanPaketId}`, totalSeconds);
    updateTimerDisplay();

    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      alert("Waktu Ujian telah habis!");
      forceSubmitExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerDisplay = document.getElementById("timerDisplay");
  if (!timerDisplay) return;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  timerDisplay.innerText = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toggleSidebar() {
  const sidebar = document.getElementById("gridSidebar");
  if (sidebar) sidebar.classList.toggle("open");
}

function changeFontSize(size) {
  const panel = document.getElementById("examPanel");
  if (!panel) return;
  if (size === 'small') panel.style.fontSize = '0.875rem';
  else if (size === 'medium') panel.style.fontSize = '1rem';
  else if (size === 'large') panel.style.fontSize = '1.15rem';
}

/* 🔒 RENDER NUMBER GRID: HANYA INDIKATOR STATUS (TIDAK BISA DIKLIK) */
function renderNumberGrid() {
  const gridContainer = document.getElementById("numberGrid");
  if (!gridContainer || !questionsData) return;
  let html = "";

  questionsData.forEach((q, idx) => {
    const qKey = q.name || q.id || `q_${idx}`;
    const isAnswered = isQuestionAnswered(qKey);
    const isActive = idx === currentQuestionIndex;

    let classList = "btn-num-indicator";
    if (isActive) classList += " active";
    else if (isAnswered) classList += " answered";
    else if (idx < currentQuestionIndex) classList += " skipped"; // Soal terlewat

    html += `<div class="${classList}">${idx + 1}</div>`;
  });

  gridContainer.innerHTML = html;
}

function showQuestion(index) {
  const container = document.getElementById("questionsContainer");
  if (!container || !questionsData[index]) return;

  const q = questionsData[index];
  const qKey = q.name || q.id || `q_${index}`;

  const titleEl = document.getElementById("questionTitle");
  if (titleEl) titleEl.innerText = `Soal Nomor ${index + 1}`;
  
  let typeText = "Pilihan Ganda";
  if (q.type === "boolean") typeText = "Benar / Salah";
  else if (q.type === "checkbox" || q.type === "checkbox_limit_2") typeText = "Pilihan Ganda Kompleks (Pilih 2)";
  else if (q.type === "matching") typeText = "Menjodohkan";
  else if (q.type === "essay") typeText = "Uraian / Essay";
  
  const badgeEl = document.getElementById("questionTypeBadge");
  if (badgeEl) badgeEl.innerText = typeText;

  const questionTextHtml = q.question || q.text || "";

  let html = `<div style="line-height: 1.6; color: #1e293b;">`;
  html += `<p style="margin-bottom: 12px; font-weight: 600; font-size: 1.05rem;">${questionTextHtml}</p>`;

  const mainImg = q.image || q.img || "";
  if (mainImg && mainImg.trim() !== "") {
    html += `
      <div style="text-align: center; margin-bottom: 16px;">
        <img src="${mainImg}" alt="Gambar Soal" style="max-width: 100%; max-height: 350px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
      </div>
    `;
  }

  // 1. TIPE: PILIHAN GANDA & BENAR/SALAH
  if ((q.type === "radio" || q.type === "boolean") && Array.isArray(q.options)) {
    q.options.forEach((opt, idx) => {
      const optVal = opt.v !== undefined ? opt.v : String.fromCharCode(65 + idx);
      const optText = opt.t || opt.text || "";
      const optImg = opt.image || opt.img || "";
      const isChecked = userAnswers[qKey] === optVal;
      const labelBadge = String.fromCharCode(65 + idx);

      let imgHtml = "";
      if (optImg && optImg.trim() !== "") {
        imgHtml = `<div style="margin-top: 8px;"><img src="${optImg}" alt="Gambar Opsi" style="max-width: 200px; max-height: 150px; border-radius: 6px; border: 1px solid #e2e8f0;"></div>`;
      }

      html += `
        <div class="option-item ${isChecked ? 'selected' : ''}" onclick="selectRadioOption('${qKey}', '${optVal}', this)">
          <input type="radio" name="${qKey}" value="${optVal}" ${isChecked ? 'checked' : ''} style="display: none;" />
          <div class="option-badge">${labelBadge}</div>
          <div class="option-text">${optText}${imgHtml}</div>
        </div>
      `;
    });
  } 
  // 2. TIPE: PILIHAN GANDA KOMPLEKS (2 JAWABAN)
  else if ((q.type === "checkbox" || q.type === "checkbox_limit_2") && Array.isArray(q.options)) {
    const savedArr = Array.isArray(userAnswers[qKey]) ? userAnswers[qKey] : [];
    html += `<p style="font-size:0.8rem; color:#64748b; margin-bottom:10px;"><em>*Pilihlah tepat 2 jawaban yang paling tepat.</em></p>`;

    q.options.forEach((opt, idx) => {
      const optVal = opt.v !== undefined ? opt.v : String.fromCharCode(65 + idx);
      const optText = opt.t || opt.text || "";
      const optImg = opt.image || opt.img || "";
      const isChecked = savedArr.includes(optVal);
      const labelBadge = idx + 1;

      let imgHtml = "";
      if (optImg && optImg.trim() !== "") {
        imgHtml = `<div style="margin-top: 8px;"><img src="${optImg}" alt="Gambar Opsi" style="max-width: 200px; max-height: 150px; border-radius: 6px; border: 1px solid #e2e8f0;"></div>`;
      }

      html += `
        <div class="option-item ${isChecked ? 'selected' : ''}" onclick="toggleCheckboxOption('${qKey}', '${optVal}', this)">
          <input type="checkbox" name="${qKey}" value="${optVal}" ${isChecked ? 'checked' : ''} style="display: none;" />
          <div class="option-badge">${labelBadge}</div>
          <div class="option-text">${optText}${imgHtml}</div>
        </div>
      `;
    });
  } 
  // 3. TIPE: MENJODOHKAN (MATCHING)
  else if (q.type === "matching" && Array.isArray(q.pairs)) {
    const savedPairs = (typeof userAnswers[qKey] === "object" && userAnswers[qKey] !== null) ? userAnswers[qKey] : {};
    html += `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">`;

    q.pairs.forEach((pair) => {
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; flex-wrap: wrap; gap: 10px;">
          <span style="font-weight: 600; font-size: 0.95rem;">${pair.left}</span>
          <select class="form-control" style="max-width: 320px; width: 100%;" onchange="saveMatchingOption('${qKey}', '${pair.id}', this.value)">
            <option value="">-- Pilih Jawaban Pasangan --</option>
            ${(q.matchOptions || []).map(opt => `
              <option value="${opt.v}" ${savedPairs[pair.id] === opt.v ? 'selected' : ''}>${opt.t}</option>
            `).join('')}
          </select>
        </div>
      `;
    });
    html += `</div>`;
  }
  // 4. TIPE: ESSAY / URAIAN
  else if (q.type === "essay") {
    const savedText = typeof userAnswers[qKey] === "string" ? userAnswers[qKey] : "";
    html += `
      <textarea id="essayInput" name="${qKey}" rows="6" class="essay-box" placeholder="Ketikkan jawaban uraian Anda..." oninput="saveEssayText('${qKey}', this.value)">${savedText}</textarea>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;

  const progEl = document.getElementById("questionProgress");
  if (progEl) progEl.innerText = `Soal ${index + 1} dari ${questionsData.length}`;

  const btnNext = document.getElementById("btnNext");
  const btnSubmit = document.getElementById("btnSubmitExam");

  if (index === questionsData.length - 1) {
    if (btnNext) btnNext.style.display = "none";
    if (btnSubmit) btnSubmit.style.display = "inline-flex";
  } else {
    if (btnNext) btnNext.style.display = "inline-flex";
    if (btnSubmit) btnSubmit.style.display = "none";
  }

  renderNumberGrid();
}

function selectRadioOption(qName, val, el) {
  const parent = el.parentNode;
  parent.querySelectorAll('.option-item').forEach(item => {
    item.classList.remove('selected');
    const input = item.querySelector('input');
    if (input) input.checked = false;
  });

  el.classList.add('selected');
  const input = el.querySelector('input');
  if (input) input.checked = true;

  userAnswers[qName] = val;
  saveCurrentAnswer();
  hideWarning();
}

function toggleCheckboxOption(qName, val, el) {
  if (!Array.isArray(userAnswers[qName])) {
    userAnswers[qName] = [];
  }

  const idx = userAnswers[qName].indexOf(val);
  if (idx > -1) {
    userAnswers[qName].splice(idx, 1);
    el.classList.remove('selected');
    const input = el.querySelector('input');
    if (input) input.checked = false;
  } else {
    if (userAnswers[qName].length >= 2) {
      alert("Anda hanya dapat memilih maksimal 2 jawaban!");
      return;
    }
    userAnswers[qName].push(val);
    el.classList.add('selected');
    const input = el.querySelector('input');
    if (input) input.checked = true;
  }

  saveCurrentAnswer();
  hideWarning();
}

function saveMatchingOption(qName, pairId, val) {
  if (typeof userAnswers[qName] !== "object" || userAnswers[qName] === null) {
    userAnswers[qName] = {};
  }

  if (val) {
    userAnswers[qName][pairId] = val;
  } else {
    delete userAnswers[qName][pairId];
  }

  saveCurrentAnswer();
  hideWarning();
}

function saveEssayText(qName, text) {
  if (text.trim() !== "") {
    userAnswers[qName] = text.trim();
  } else {
    delete userAnswers[qName];
  }
  saveCurrentAnswer();
  hideWarning();
}

function saveCurrentAnswer() {
  let rawSoalPath = localStorage.getItem("soalPath") || "soal-uh1";
  const cleanPaketId = getCleanPaketId(rawSoalPath);
  const savedAnswersKey = `answers_${currentUsername}_${cleanPaketId}`;
  localStorage.setItem(savedAnswersKey, JSON.stringify(userAnswers));
  renderNumberGrid();
}

function isQuestionAnswered(qName) {
  const ans = userAnswers[qName];
  if (!ans) return false;
  if (Array.isArray(ans)) return ans.length > 0;
  if (typeof ans === "object") return Object.keys(ans).length > 0;
  if (typeof ans === "string") return ans.trim() !== "";
  return true;
}

function hideWarning() {
  const warnEl = document.getElementById("warningMessage");
  if (warnEl) warnEl.style.display = "none";
}

/* 🔒 HANYA BISA MAJU KE DEPAN (KONFIRMASI JIKA SOAL AKAN DIKUNCI / TIDAK BISA KEMBALI) */
function nextQuestion() {
  saveCurrentAnswer();
  const qKey = questionsData[currentQuestionIndex].name || questionsData[currentQuestionIndex].id || `q_${currentQuestionIndex}`;
  
  if (!isQuestionAnswered(qKey)) {
    showWarning("Jawab pertanyaan ini terlebih dahulu sebelum melanjutkan!");
    return;
  }

  if (confirm("Lanjut ke nomor berikutnya? Soal yang telah dilewati TIDAK DAPAT diakses kembali!")) {
    if (currentQuestionIndex < questionsData.length - 1) {
      currentQuestionIndex++;
      
      const cleanPaketId = getCleanPaketId(localStorage.getItem("soalPath"));
      localStorage.setItem(`currentIndex_${currentUsername}_${cleanPaketId}`, currentQuestionIndex);

      showQuestion(currentQuestionIndex);
      
      const sidebar = document.getElementById("gridSidebar");
      if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
      }
    }
  }
}

function showWarning(msg) {
  let warnEl = document.getElementById("warningMessage");
  if (!warnEl) {
    warnEl = document.createElement("div");
    warnEl.id = "warningMessage";
    warnEl.style.color = "#ef4444";
    warnEl.style.marginTop = "10px";
    warnEl.style.fontWeight = "bold";
    const container = document.getElementById("questionsContainer");
    if (container) container.appendChild(warnEl);
  }
  warnEl.innerText = "⚠️ " + msg;
  warnEl.style.display = "block";
}

function submitExam() {
  saveCurrentAnswer();
  const qKey = questionsData[currentQuestionIndex].name || questionsData[currentQuestionIndex].id || `q_${currentQuestionIndex}`;
  if (!isQuestionAnswered(qKey)) {
    showWarning("Jawab soal terakhir terlebih dahulu!");
    return;
  }

  if (confirm("Apakah Anda yakin ingin mengakhiri ujian ini?")) {
    processExamResults();
  }
}

function forceSubmitExam() {
  saveCurrentAnswer();
  processExamResults();
}

async function processExamResults() {
  clearInterval(timerInterval);

  const panel = document.getElementById("examPanel");
  if (panel) {
    panel.innerHTML = `
      <div style="text-align:center; padding: 60px;">
        <h3>Sedang Memproses & Mengirimkan Jawaban...</h3>
        <p style="color:#64748b; margin-top:8px;">Mohon jangan menutup halaman ini.</p>
      </div>
    `;
  }

  let rawSoalPath = localStorage.getItem("soalPath") || "soal-uh1";

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "submit",
        username: currentUserData.username || currentUsername,
        nama: currentUserData.nama || "-",
        kelas: currentUserData.kelas || "-",
        paket: rawSoalPath,
        jawaban: userAnswers
      }),
    });
  } catch (err) {
    console.error("Gagal Mengirim Data:", err);
  }

  clearExamCache();
  showFinalResult();
}

function showFinalResult() {
  const gridSidebar = document.getElementById("gridSidebar");
  const akmFooter = document.querySelector(".akm-footer");

  if (gridSidebar) gridSidebar.style.display = "none";
  if (akmFooter) akmFooter.style.display = "none";

  const panel = document.getElementById("examPanel");
  if (panel) {
    panel.innerHTML = `
      <div style="text-align: center; padding: 40px 10px;">
        <div style="font-size: 4rem; margin-bottom: 12px;">🏛️</div>
        <h2 style="color: #0f172a; margin-bottom: 8px;">Ujian Asesmen Selesai</h2>
        <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 24px;">
          Jawaban Anda telah tersimpan secara resmi di server.
        </p>

        <button onclick="logout()" style="padding: 12px 30px; background-color: #1e3a8a; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">
          Keluar Dari Portal Ujian
        </button>
      </div>
    `;
  }
}

function confirmLogout() {
  if (confirm("Apakah Anda yakin ingin keluar dari sesi ujian?")) {
    logout();
  }
}

function logout() {
  clearInterval(timerInterval);
  
  if (currentUsername) {
    fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "logout", username: currentUsername }),
    }).catch(() => {});
  }

  localStorage.removeItem("userData");
  window.location.href = "index.html";
}

function clearExamCache() {
  let rawSoalPath = localStorage.getItem("soalPath") || "soal-uh1";
  const cleanPaketId = getCleanPaketId(rawSoalPath);

  if (currentUsername) {
    localStorage.removeItem(`currentIndex_${currentUsername}_${cleanPaketId}`);
    localStorage.removeItem(`remainingTime_${currentUsername}_${cleanPaketId}`);
    localStorage.removeItem(`questions_${currentUsername}_${cleanPaketId}`);
    localStorage.removeItem(`answers_${currentUsername}_${cleanPaketId}`);
  }
}
