//https://script.google.com/macros/s/AKfycby7y6F-755S42rE1vfNFccjugXs3DsXO9sdvBjE90Ld7LgzI1VSmoJzXz4uWivKglVY/exec
//**
 * CBT ENGINE - GOOGLE APPS SCRIPT (FULL PROTECTION & CLOUD RESTORE)
 */

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  e = e || {}; 
  var params = e.parameter || {};
  
  if (e && e.postData && e.postData.contents) {
    try {
      var postData = JSON.parse(e.postData.contents);
      params = Object.assign({}, params, postData);
    } catch (err) {}
  }

  var action = String(params.action || "").trim().toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ==========================================
  // 1. GET ACTIVE EXAMS
  // ==========================================
  if (action === "getactiveexams") {
    var sheetJadwal = ss.getSheetByName("Jadwal_Ujian");
    var activeExams = [];

    if (sheetJadwal && sheetJadwal.getLastRow() > 1) {
      var dataJadwal = sheetJadwal.getRange(2, 1, sheetJadwal.getLastRow() - 1, 6).getDisplayValues();
      var now = new Date();

      for (var i = 0; i < dataJadwal.length; i++) {
        var kode       = String(dataJadwal[i][0] || "").trim();
        var nama       = String(dataJadwal[i][1] || "").trim();
        var tglMulai   = new Date(dataJadwal[i][2]);
        var tglSelesai = new Date(dataJadwal[i][3]);
        var durasi     = dataJadwal[i][4] || "60";
        var status     = String(dataJadwal[i][5] || "").trim().toUpperCase();

        var isOpen = (status === "OPEN" || status === "AKTIF");
        var inSchedule = (now >= tglMulai && now <= tglSelesai);

        if (isOpen && inSchedule) {
          activeExams.push({ kode: kode, nama: nama, durasi: durasi });
        }
      }
    }
    return responseJSON(activeExams);
  }

  // ==========================================
  // 2. GET QUESTIONS DARI BANK SOAL
  // ==========================================
  if (action === "getquestions") {
    var paketReq = String(params.paket || "").trim().toLowerCase();
    var sheetBank = ss.getSheetByName("Bank_Soal");

    if (sheetBank && sheetBank.getLastRow() > 1) {
      var dataBank = sheetBank.getRange(2, 1, sheetBank.getLastRow() - 1, 2).getDisplayValues();
      for (var b = 0; b < dataBank.length; b++) {
        var kodePkt = String(dataBank[b][0] || "").trim().toLowerCase();
        if (kodePkt === paketReq) {
          try {
            return responseJSON({ status: "success", data: JSON.parse(dataBank[b][1]) });
          } catch(err) {
            return responseJSON({ status: "error", message: "Format JSON Bank Soal tidak valid!" });
          }
        }
      }
    }
    return responseJSON({ status: "error", message: "Paket soal tidak ditemukan!" });
  }

  // ==========================================
  // 3. RESTORE SESI DI TABLET / PERANGKAT LAIN
  // ==========================================
  if (action === "getstudentsession") {
    var username = String(params.username || "").trim().toLowerCase();
    var paket = String(params.paket || "").trim().toLowerCase();
    var sheetSesi = ss.getSheetByName("Sesi_Ujian");

    if (sheetSesi && sheetSesi.getLastRow() > 1) {
      var dataSesi = sheetSesi.getRange(2, 1, sheetSesi.getLastRow() - 1, 6).getDisplayValues();
      for (var s = 0; s < dataSesi.length; s++) {
        var uDb = String(dataSesi[s][0] || "").trim().toLowerCase();
        var pDb = String(dataSesi[s][1] || "").trim().toLowerCase();

        if (uDb === username && pDb === paket) {
          var rawOrder = String(dataSesi[s][4] || "[]").trim();
          var rawAns = String(dataSesi[s][5] || "{}").trim();

          if (rawOrder !== "[]" && rawOrder !== "") {
            try {
              return responseJSON({
                status: "found",
                remainingSeconds: parseInt(dataSesi[s][2], 10) || null,
                currentIndex: parseInt(dataSesi[s][3], 10) || 0,
                questionOrder: JSON.parse(rawOrder),
                userAnswers: JSON.parse(rawAns)
              });
            } catch(e) {}
          }
        }
      }
    }
    return responseJSON({ status: "not_found" });
  }

  // ==========================================
  // 4. AUTOSAVE SESI KE SPREADSHEET (CLOUD SYNC)
  // ==========================================
  if (action === "savestudentsession") {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch(e) {
      return responseJSON({ status: "error", message: "Server sibuk" });
    }

    try {
      var username = String(params.username || "").trim().toLowerCase();
      var paket = String(params.paket || "").trim().toLowerCase();
      var remainingSeconds = params.remainingSeconds || 3600;
      var currentIndex = params.currentIndex || 0;
      var questionOrder = params.questionOrder ? (typeof params.questionOrder === "string" ? params.questionOrder : JSON.stringify(params.questionOrder)) : "[]";
      var userAnswers = params.userAnswers ? (typeof params.userAnswers === "string" ? params.userAnswers : JSON.stringify(params.userAnswers)) : "{}";

      var sheetSesi = ss.getSheetByName("Sesi_Ujian") || ss.insertSheet("Sesi_Ujian");
      if (sheetSesi.getLastRow() === 0) {
        sheetSesi.appendRow(["User", "Kode_Paket", "Sisa_waktu", "Index_Soal", "Urutan_ID_Soal", "Jawaban_JSON"]);
      }

      var rowTarget = -1;
      if (sheetSesi.getLastRow() > 1) {
        var dSesi = sheetSesi.getRange(2, 1, sheetSesi.getLastRow() - 1, 2).getDisplayValues();
        for (var r = 0; r < dSesi.length; r++) {
          if (String(dSesi[r][0]).trim().toLowerCase() === username && String(dSesi[r][1]).trim().toLowerCase() === paket) {
            rowTarget = r + 2;
            break;
          }
        }
      }

      if (rowTarget !== -1) {
        sheetSesi.getRange(rowTarget, 3, 1, 4).setValues([[remainingSeconds, currentIndex, questionOrder, userAnswers]]);
      } else {
        sheetSesi.appendRow([username, paket, remainingSeconds, currentIndex, questionOrder, userAnswers]);
      }

      return responseJSON({ status: "success" });
    } finally {
      lock.releaseLock();
    }
  }

  // ==========================================
  // 5. LOGIN SISWA & PROTEKSI KETAT
  // ==========================================
  if (action === "login") {
    var usernameInput = String(params.username || "").trim().toLowerCase();
    var passwordInput = String(params.password || "").trim();
    var paketInput    = String(params.paket || "").trim().toLowerCase();

    var sheetSiswa = ss.getSheetByName("Siswa");
    if (!sheetSiswa || sheetSiswa.getLastRow() < 2) {
      return responseJSON({ status: "fail", message: "Database siswa kosong!" });
    }

    // 1. Cek Apakah SUDAH SELESAI
    var sheetHasil = ss.getSheetByName("Hasil_UJIAN") || ss.getSheetByName("Hasil");
    if (sheetHasil && sheetHasil.getLastRow() > 1) {
      var dataHasil = sheetHasil.getRange(2, 1, sheetHasil.getLastRow() - 1, 7).getDisplayValues();
      for (var h = 0; h < dataHasil.length; h++) {
        var resNisn = String(dataHasil[h][1] || "").trim().toLowerCase();
        var resSum = String(dataHasil[h][6] || "").trim().toLowerCase();
        if (resNisn === usernameInput && resSum.indexOf(paketInput) !== -1) {
          return responseJSON({ status: "fail", message: "Anda sudah menyelesaikan Ujian" });
        }
      }
    }

    // 2. Cek Akun dan Proteksi Sesi Aktif
    var dataSiswa = sheetSiswa.getRange(2, 1, sheetSiswa.getLastRow() - 1, 5).getDisplayValues();
    for (var i = 0; i < dataSiswa.length; i++) {
      var dbUser   = String(dataSiswa[i][0] || "").trim().toLowerCase();
      var dbPass   = String(dataSiswa[i][1] || "").trim();
      var dbNama   = String(dataSiswa[i][2] || "").trim() || "Siswa";
      var dbKelas  = String(dataSiswa[i][3] || "").trim() || "-";
      var dbStatus = String(dataSiswa[i][4] || "").trim().toUpperCase();

      if (dbUser === usernameInput && dbPass === passwordInput) {
        var currentPaketTag = "ONLINE_" + paketInput.toUpperCase();

        // 🔒 JIKA STATUS MASIH ONLINE: TOLAK LOGIN
        if (dbStatus.indexOf("ONLINE_") === 0) {
          return responseJSON({ status: "fail", message: "Hubungi Admin/Proktor" });
        }

        // KUNCI STATUS SISWA DI SPREADSHEET
        sheetSiswa.getRange(i + 2, 5).setValue(currentPaketTag);

        return responseJSON({
          status: "success",
          user: { username: dbUser, nama: dbNama, kelas: dbKelas }
        });
      }
    }
    return responseJSON({ status: "fail", message: "NISN atau Password salah!" });
  }

  // ==========================================
  // 6. SUBMIT HASIL UJIAN
  // ==========================================
  if (action === "submit") {
    var sheetHasil = ss.getSheetByName("Hasil_UJIAN") || ss.insertSheet("Hasil_UJIAN");
    if (sheetHasil.getLastRow() === 0) {
      sheetHasil.appendRow(["Waktu Selesai", "NISN", "Nama Siswa", "Kelas", "Nilai Objektif (0-100)", "Detail Jawaban (JSON)", "Ringkasan Skor"]);
    }

    var userAnswers = params.jawaban || {};
    if (typeof userAnswers === "string") {
      try { userAnswers = JSON.parse(userAnswers); } catch(e) {}
    }

    var finalUsername = String(params.username || "-").trim();
    var finalNama     = String(params.nama || "").trim();
    var finalKelas    = String(params.kelas || "").trim();
    var paketUjian    = String(params.paket || "").trim();

    var ANSWER_KEYS = getAnswerKeysFromSheet(ss, paketUjian);
    var correctCount = 0;
    var totalObjective = 0;

    for (var qKey in ANSWER_KEYS) {
      totalObjective++;
      var keyVal = ANSWER_KEYS[qKey];
      var userVal = userAnswers[qKey];

      if (!userVal) continue;

      if (Array.isArray(keyVal)) {
        if (Array.isArray(userVal)) {
          var isMatch = (keyVal.length === userVal.length) && 
            keyVal.every(function(v) { return userVal.indexOf(v) !== -1; });
          if (isMatch) correctCount++;
        }
      } else if (typeof keyVal === "object" && keyVal !== null) {
        var pairMatch = true;
        for (var pKey in keyVal) {
          if (!userVal[pKey] || String(userVal[pKey]).trim().toUpperCase() !== String(keyVal[pKey]).trim().toUpperCase()) {
            pairMatch = false;
            break;
          }
        }
        if (pairMatch) correctCount++;
      } else {
        if (String(userVal).trim().toUpperCase() === String(keyVal).trim().toUpperCase()) {
          correctCount++;
        }
      }
    }

    var calculatedScore = totalObjective > 0 ? Math.round((correctCount / totalObjective) * 100) : 0;
    var summaryStr = "Benar " + correctCount + " dari " + totalObjective + " Soal (" + paketUjian + ")";

    sheetHasil.appendRow([
      new Date(), finalUsername, finalNama, finalKelas, calculatedScore, JSON.stringify(userAnswers), summaryStr
    ]);

    // SETELAH SELESAI RESMI: KEMBALIKAN KE OFFLINE
    var sheetSiswa = ss.getSheetByName("Siswa");
    if (sheetSiswa && sheetSiswa.getLastRow() > 1) {
      var uList = sheetSiswa.getRange(2, 1, sheetSiswa.getLastRow() - 1, 1).getDisplayValues();
      for (var u = 0; u < uList.length; u++) {
        if (String(uList[u][0]).trim().toLowerCase() === finalUsername.toLowerCase()) {
          sheetSiswa.getRange(u + 2, 5).setValue("OFFLINE");
          break;
        }
      }
    }

    return responseJSON({ status: "success", message: "Ujian selesai." });
  }

  // ==========================================
  // 7. ADMIN MANAGEMENT
  // ==========================================
  if (action === "savenewexampackage" || action === "updateexampackage") {
    var kodeSoal = String(params.kodeSoal || "").trim();
    var namaUjian = String(params.namaUjian || "").trim();
    var durasi = params.durasi || 60;
    var jadwalMulai = params.jadwalMulai;
    var jadwalSelesai = params.jadwalSelesai;
    var statusUjian = String(params.statusUjian || "OPEN").trim().toUpperCase();
    var soalJson = params.soalJson || [];
    var kunciObj = params.kunciObj || {};

    var sheetJadwal = ss.getSheetByName("Jadwal_Ujian") || ss.insertSheet("Jadwal_Ujian");
    if (sheetJadwal.getLastRow() === 0) {
      sheetJadwal.appendRow(["Kode_Soal", "Nama_Ujian", "Waktu_Mulai", "Waktu_Selesai", "Durasi_Menit", "Status"]);
    }
    var foundJ = false;
    if (sheetJadwal && sheetJadwal.getLastRow() > 1) {
      var jD = sheetJadwal.getRange(2, 1, sheetJadwal.getLastRow() - 1, 1).getDisplayValues();
      for (var j = 0; j < jD.length; j++) {
        if (String(jD[j][0]).trim().toLowerCase() === kodeSoal.toLowerCase()) {
          sheetJadwal.getRange(j + 2, 2, 1, 5).setValues([[namaUjian, jadwalMulai, jadwalSelesai, durasi, statusUjian]]);
          foundJ = true;
          break;
        }
      }
    }
    if (!foundJ) sheetJadwal.appendRow([kodeSoal, namaUjian, jadwalMulai, jadwalSelesai, durasi, statusUjian]);

    var sheetBank = ss.getSheetByName("Bank_Soal") || ss.insertSheet("Bank_Soal");
    if (sheetBank.getLastRow() === 0) sheetBank.appendRow(["Kode_Soal", "Soal_JSON"]);
    var foundB = false;
    if (sheetBank && sheetBank.getLastRow() > 1) {
      var bD = sheetBank.getRange(2, 1, sheetBank.getLastRow() - 1, 1).getDisplayValues();
      for (var b = 0; b < bD.length; b++) {
        if (String(bD[b][0]).trim().toLowerCase() === kodeSoal.toLowerCase()) {
          sheetBank.getRange(b + 2, 2).setValue(JSON.stringify(soalJson));
          foundB = true;
          break;
        }
      }
    }
    if (!foundB) sheetBank.appendRow([kodeSoal, JSON.stringify(soalJson)]);

    var sheetKunci = ss.getSheetByName("Kunci") || ss.insertSheet("Kunci");
    if (sheetKunci.getLastRow() === 0) sheetKunci.appendRow(["Paket", "Kode_Soal", "Kunci"]);
    if (sheetKunci.getLastRow() > 1) {
      for (var k = sheetKunci.getLastRow(); k >= 2; k--) {
        if (String(sheetKunci.getRange(k, 1).getValue()).trim().toLowerCase() === kodeSoal.toLowerCase()) {
          sheetKunci.deleteRow(k);
        }
      }
    }
    for (var qNum in kunciObj) {
      var valK = kunciObj[qNum];
      if (typeof valK === "object") valK = Array.isArray(valK) ? valK.join(",") : JSON.stringify(valK);
      sheetKunci.appendRow([kodeSoal, qNum, valK]);
    }

    return responseJSON({ status: "success", message: "Paket Ujian berhasil disimpan!" });
  }

  return responseJSON({ status: "error", message: "Aksi tidak dikenal" });
}

function getAnswerKeysFromSheet(ss, paketUjian) {
  var sheetKunci = ss.getSheetByName("Kunci");
  var keys = {};
  if (!sheetKunci || sheetKunci.getLastRow() < 2) return keys;

  var data = sheetKunci.getRange(2, 1, sheetKunci.getLastRow() - 1, 3).getDisplayValues();
  var cleanParam = paketUjian.toLowerCase().replace("./data/", "").replace(".json", "").trim();

  for (var i = 0; i < data.length; i++) {
    var pkt  = String(data[i][0] || "").toLowerCase().replace("./data/", "").replace(".json", "").trim();
    var qNum = String(data[i][1] || "").trim();
    var val  = String(data[i][2] || "").trim();

    if (pkt === cleanParam) {
      if (val.startsWith("{") && val.endsWith("}")) {
        try { keys[qNum] = JSON.parse(val); } catch(e) { keys[qNum] = val; }
      } else if (val.indexOf(",") !== -1) {
        keys[qNum] = val.split(",").map(function(s) { return s.trim().toUpperCase(); });
      } else {
        keys[qNum] = val.toUpperCase();
      }
    }
  }
  return keys;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
