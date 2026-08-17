let currentQuestionIndex = 0;
let questionsData = [];
let userAnswers = {};

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwb5Ra-LdHJue0w0bRm9f_laJ80_YNU_pNr1FV1mfY1nIrQYhN3hFXH5XvTGFoS_iej/exec";

let EXAM_DURATION_MINUTES = 60;
let totalSeconds = EXAM_DURATION_MINUTES * 60;
let timerInterval = null;
let currentUsername = "";
let currentUserData = {};
let cleanPaketId = "soal-uh1";

function getCleanPaketId(rawPath) {
  if (!rawPath) return "soal-uh1";
  return String(rawPath).replace(/^.*[\\\/]/, '').replace('.json', '').trim().toLowerCase();
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

    try {
      currentUserData = JSON.parse(userDataStr);
    } catch(e) {
      currentUserData = { username: "siswa", nama: "Siswa", kelas: "-" };
    }
    
    currentUsername = String(currentUserData.username || "siswa").trim().toLowerCase();
    cleanPaketId = getCleanPaketId(rawSoalPath);

    const userInfoEl = document.getElementById("userInfo");
    if (userInfoEl) {
      userInfoEl.innerHTML = `
        PESERTA: <strong>${currentUserData.nama || currentUserData.username}</strong> | KELAS: <strong>${currentUserData.kelas || '-'}</strong> | NISN: <strong>${currentUserData.username}</strong>
      `;
    }

    // 1. Ambil Master Bank Soal & Cek Konfigurasi Limit dari Jadwal
    let masterQuestions = [];
    let serverLimit = 0;

    try {
      // Ambil limit soal dari active exams jika tersedia
      const activeRes = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getactiveexams" })
      });
      const activeList = await activeRes.json();
      if (Array.isArray(activeList)) {
        const matchedExam = activeList.find(ex => getCleanPaketId(ex.kode) === cleanPaketId);
        if (matchedExam && matchedExam.limitSoal) {
          serverLimit = parseInt(matchedExam.limitSoal, 10);
        }
      }
    } catch (e) {}

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getquestions", paket: cleanPaketId })
      });
      const result = await response.json();
      if (result.status === "success" && result.data) {
        if (!Array.isArray(result.data) && result.data.questions) {
          masterQuestions = result.data.questions;
        } else if (Array.isArray(result.data)) {
          masterQuestions = result.data;
        }
        if (result.limitSoal) {
          serverLimit = parseInt(result.limitSoal, 10);
        }
      }
    } catch(err) {
      console.error("Gagal load bank soal:", err);
    }

    if (masterQuestions.length === 0) {
      if (container) {
        container.innerHTML = `
          <div style="color: #dc2626; padding: 30px; text-align: center; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
            <h3>⚠️ Soal Ujian Tidak Ditemukan!</h3>
            <p style="font-size: 0.9rem; color: #991b1b; margin-top: 6px;">Paket soal '${cleanPaketId}' belum tersedia di Spreadsheet.</p>
          </div>
        `;
      }
      return;
    }

    // 2. Cek Sesi Cloud (Restore jika refresh halaman / ganti perangkat)
    let sessionRestored = false;
    try {
      const sessionRes = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getstudentsession", username: currentUsername, paket: cleanPaketId })
      });
      const sessionData = await sessionRes.json();

      if (sessionData.status === "found" && Array.isArray(sessionData.questionOrder) && sessionData.questionOrder.length > 0) {
        const orderMap = new Map();
        masterQuestions.forEach((q, idx) => {
          const key = String(q.name || q.id || `q_${idx}`).trim().toLowerCase();
          orderMap.set(key, q);
        });

        questionsData = [];
        sessionData.questionOrder.forEach(qKey => {
          const cleanK = String(qKey).trim().toLowerCase();
          if (orderMap.has(cleanK)) {
            questionsData.push(orderMap.get(cleanK));
          }
        });

        if (questionsData.length > 0) {
          userAnswers = sessionData.userAnswers || {};
          currentQuestionIndex = parseInt(sessionData.currentIndex, 10) || 0;
          if (sessionData.remainingSeconds !== null && !isNaN(parseInt(sessionData.remainingSeconds))) {
            totalSeconds = parseInt(sessionData.remainingSeconds, 10);
          }
          sessionRestored = true;
        }
      }
    } catch (err) {
      console.warn("Gagal restore sesi cloud:", err);
    }

    // 3. Jika sesi baru (pertama kali buka), lakukan acak dan pemotongan jumlah soal
    if (!sessionRestored) {
      let finalQuestions = shuffleArray(masterQuestions);

      // Batasi jumlah soal sesuai limit proktor (misal 50 soal dari 100)
      if (serverLimit > 0 && finalQuestions.length > serverLimit) {
        finalQuestions = finalQuestions.slice(0, serverLimit);
      }

      // Acak urutan opsi jawaban tiap butir soal
      finalQuestions.forEach((q) => {
        if (q.options && Array.isArray(q.options) && q.type !== "boolean") {
          q.options = shuffleArray(q.options);
        }
        if (q.matchOptions && Array.isArray(q.matchOptions)) {
          q.matchOptions = shuffleArray(q.matchOptions);
        }
      });

      questionsData = finalQuestions;
      currentQuestionIndex = 0;
      userAnswers = {};
      await syncSessionToCloud();
    }

    startTimer();
    renderNumberGrid();
    showQuestion(currentQuestionIndex);

  } catch (fatalError) {
    if (container) {
      container.innerHTML = `<p style="color:red; text-align:center;">Error: ${fatalError.message}</p>`;
    }
  }
});

async function syncSessionToCloud() {
  if (!currentUsername || !cleanPaketId || !Array.isArray(questionsData) || questionsData.length === 0) {
    return;
  }

  const questionOrder = questionsData.map((q, idx) => q.name || q.id || `q_${idx}`);

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "savestudentsession",
        username: currentUsername,
        paket: cleanPaketId,
        remainingSeconds: totalSeconds,
        currentIndex: currentQuestionIndex,
        questionOrder: questionOrder,
        userAnswers: userAnswers
      })
    });
  } catch (e) {}
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    totalSeconds--;
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
    else if (idx < currentQuestionIndex) classList += " skipped";

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

  let html = `<div style="line-height: 1.6; color: #1e293b;">`;
  html += `<p style="margin-bottom: 12px; font-weight: 600; font-size: 1.05rem;">${q.question || q.text || ""}</p>`;

  // 🖼️ RENDERING GAMBAR (RESOLVER GOOGLE DRIVE DB_IMAGES)
  if (q.image && q.image.trim() !== "") {
    var rawImg = q.image.trim();
    var imgId = "img_q_" + index;

    html += `
      <div style="text-align: center; margin-bottom: 16px;">
        <img id="${imgId}" src="" alt="Memuat Gambar..." style="max-width: 100%; max-height: 350px; border-radius: 8px; border: 1px solid #cbd5e1; display: none;">
        <div id="${imgId}_loading" style="font-size: 0.85rem; color: #64748b; padding: 10px;">⏳ Memuat gambar...</div>
      </div>
    `;

    if (rawImg.startsWith("http://") || rawImg.startsWith("https://")) {
      setTimeout(() => {
        var el = document.getElementById(imgId);
        var loadEl = document.getElementById(imgId + "_loading");
        if (el) { el.src = rawImg; el.style.display = "inline-block"; }
        if (loadEl) loadEl.style.display = "none";
      }, 50);
    } else {
      fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getimageurl", filename: rawImg })
      })
      .then(res => res.json())
      .then(res => {
        var el = document.getElementById(imgId);
        var loadEl = document.getElementById(imgId + "_loading");
        if (res.status === "success" && el) {
          el.src = res.url;
          el.style.display = "inline-block";
          if (loadEl) loadEl.style.display = "none";
        } else {
          if (loadEl) loadEl.innerHTML = `<span style="color:#ef4444;">⚠️ Gambar '${rawImg}' belum diunggah di folder db_images Google Drive</span>`;
        }
      })
      .catch(() => {
        var loadEl = document.getElementById(imgId + "_loading");
        if (loadEl) loadEl.innerHTML = `<span style="color:#ef4444;">⚠️ Gagal memuat gambar</span>`;
      });
    }
  }

  // 1. Radio / Boolean
  if ((q.type === "radio" || q.type === "boolean") && Array.isArray(q.options)) {
    q.options.forEach((opt, idx) => {
      const optVal = opt.v !== undefined ? opt.v : String.fromCharCode(65 + idx);
      const isChecked = userAnswers[qKey] === optVal;
      html += `
        <div class="option-item ${isChecked ? 'selected' : ''}" onclick="selectRadioOption('${qKey}', '${optVal}', this)">
          <input type="radio" name="${qKey}" value="${optVal}" ${isChecked ? 'checked' : ''} style="display: none;" />
          <div class="option-badge">${String.fromCharCode(65 + idx)}</div>
          <div class="option-text">${opt.t || opt.text || ""}</div>
        </div>
      `;
    });
  } 
  // 2. Checkbox Kompleks
  else if ((q.type === "checkbox" || q.type === "checkbox_limit_2") && Array.isArray(q.options)) {
    const savedArr = Array.isArray(userAnswers[qKey]) ? userAnswers[qKey] : [];
    html += `<p style="font-size:0.8rem; color:#64748b; margin-bottom:10px;"><em>*Pilihlah tepat 2 jawaban.</em></p>`;

    q.options.forEach((opt, idx) => {
      const optVal = opt.v !== undefined ? opt.v : String.fromCharCode(65 + idx);
      const isChecked = savedArr.includes(optVal);
      html += `
        <div class="option-item ${isChecked ? 'selected' : ''}" onclick="toggleCheckboxOption('${qKey}', '${optVal}', this)">
          <input type="checkbox" name="${qKey}" value="${optVal}" ${isChecked ? 'checked' : ''} style="display: none;" />
          <div class="option-badge">${idx + 1}</div>
          <div class="option-text">${opt.t || opt.text || ""}</div>
        </div>
      `;
    });
  } 
  // 3. Menjodohkan
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
  // 4. Essay
  else if (q.type === "essay") {
    const savedText = typeof userAnswers[qKey] === "string" ? userAnswers[qKey] : "";
    html += `
      <textarea id="essayInput" rows="6" class="essay-box" placeholder="Ketikkan jawaban uraian..." oninput="saveEssayText('${qKey}', this.value)">${savedText}</textarea>
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
  renderNumberGrid();
  hideWarning();
  syncSessionToCloud();
}

function toggleCheckboxOption(qName, val, el) {
  if (!Array.isArray(userAnswers[qName])) userAnswers[qName] = [];
  const idx = userAnswers[qName].indexOf(val);

  if (idx > -1) {
    userAnswers[qName].splice(idx, 1);
    el.classList.remove('selected');
  } else {
    if (userAnswers[qName].length >= 2) {
      alert("Hanya dapat memilih maksimal 2 jawaban!");
      return;
    }
    userAnswers[qName].push(val);
    el.classList.add('selected');
  }

  renderNumberGrid();
  hideWarning();
  syncSessionToCloud();
}

function saveMatchingOption(qName, pairId, val) {
  if (typeof userAnswers[qName] !== "object" || userAnswers[qName] === null) userAnswers[qName] = {};
  if (val) userAnswers[qName][pairId] = val;
  else delete userAnswers[qName][pairId];

  renderNumberGrid();
  hideWarning();
  syncSessionToCloud();
}

function saveEssayText(qName, text) {
  if (text.trim() !== "") userAnswers[qName] = text.trim();
  else delete userAnswers[qName];

  renderNumberGrid();
  hideWarning();
  syncSessionToCloud();
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

async function nextQuestion() {
  const qKey = questionsData[currentQuestionIndex].name || questionsData[currentQuestionIndex].id || `q_${currentQuestionIndex}`;
  
  if (!isQuestionAnswered(qKey)) {
    showWarning("Jawab pertanyaan ini terlebih dahulu sebelum melanjutkan!");
    return;
  }

  if (currentQuestionIndex < questionsData.length - 1) {
    currentQuestionIndex++;
    await syncSessionToCloud();
    showQuestion(currentQuestionIndex);
    
    const sidebar = document.getElementById("gridSidebar");
    if (sidebar && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
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
        paket: cleanPaketId,
        jawaban: userAnswers,
        totalSoal: Array.isArray(questionsData) ? questionsData.length : 0 // Menjamin pembagian nilai presisi sesuai jumlah soal yang tampil
      }),
    });
  } catch (err) {
    console.error("Gagal Mengirim Data:", err);
  }

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

async function logout() {
  clearInterval(timerInterval);
  try {
    await syncSessionToCloud();
  } catch (e) {}

  localStorage.removeItem("userData");
  window.location.href = "index.html";
}
