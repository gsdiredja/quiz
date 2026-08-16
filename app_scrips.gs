/**
 * ENGINE UJIAN ONLINE - GOOGLE APPS SCRIPT (FULL AUTOMATION & ADMIN MANAGEMENT)
 * Developer: Agus Suyatno, S.Kom
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  e = e || {}; 
  var params = e.parameter || {};
  
  if (e && e.postData && e.postData.contents) {
    try {
      var postData = JSON.parse(e.postData.contents);
      params = Object.assign({}, params, postData);
    } catch (err) {
      // Abaikan jika bukan JSON
    }
  }

  var action = String(params.action || "").trim().toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ==========================================
  // --- 1. FITUR AMBIL DAFTAR UJIAN AKTIF ---
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

        if (status === "AKTIF" && now >= tglMulai && now <= tglSelesai) {
          activeExams.push({
            kode: kode,
            nama: nama,
            durasi: durasi
          });
        }
      }
    }
    return responseJSON(activeExams);
  }

  // ==========================================
  // --- 2. FITUR AMBIL SOAL DARI BANK SOAL ---
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
            var questionsObj = JSON.parse(dataBank[b][1]);
            return responseJSON({ status: "success", data: questionsObj });
          } catch(err) {
            return responseJSON({ status: "error", message: "Format JSON di Bank Soal tidak valid!" });
          }
        }
      }
    }
    return responseJSON({ status: "error", message: "Soal untuk paket '" + paketReq + "' tidak ditemukan!" });
  }

  // ==========================================
  // --- 3. FITUR ADMIN: SIMPAN PAKET BARU ---
  // ==========================================
  if (action === "savenewexampackage") {
    var kodeSoal      = String(params.kodeSoal || "").trim();
    var namaUjian     = String(params.namaUjian || "").trim();
    var durasi        = params.durasi || 60;
    var jadwalMulai   = params.jadwalMulai;
    var jadwalSelesai = params.jadwalSelesai;
    var soalJson      = params.soalJson || [];
    var kunciObj      = params.kunciObj || {};

    if (!kodeSoal || !namaUjian) {
      return responseJSON({ status: "error", message: "Kode Soal dan Nama Ujian wajib diisi!" });
    }

    var sheetJadwal = ss.getSheetByName("Jadwal_Ujian") || ss.insertSheet("Jadwal_Ujian");
    if (sheetJadwal.getLastRow() === 0) {
      sheetJadwal.appendRow(["Kode_Soal", "Nama_Ujian", "Waktu_Mulai", "Waktu_Selesai", "Durasi_Menit", "Status"]);
    }
    sheetJadwal.appendRow([kodeSoal, namaUjian, jadwalMulai, jadwalSelesai, durasi, "AKTIF"]);

    var sheetBank = ss.getSheetByName("Bank_Soal") || ss.insertSheet("Bank_Soal");
    if (sheetBank.getLastRow() === 0) {
      sheetBank.appendRow(["Kode_Soal", "Soal_JSON"]);
    }
    sheetBank.appendRow([kodeSoal, JSON.stringify(soalJson)]);

    var sheetKunci = ss.getSheetByName("Kunci") || ss.insertSheet("Kunci");
    if (sheetKunci.getLastRow() === 0) {
      sheetKunci.appendRow(["Paket", "Kode_Soal", "Kunci"]);
    }
    for (var qNum in kunciObj) {
      sheetKunci.appendRow([kodeSoal, qNum, kunciObj[qNum]]);
    }

    return responseJSON({
      status: "success",
      message: "Paket Ujian '" + kodeSoal + "' berhasil disimpan & dijadwalkan!"
    });
  }

  // ==========================================
  // --- 4. FITUR ADMIN: AMBIL DETAIL UNTUK EDIT ---
  // ==========================================
  if (action === "getadminexampackage") {
    var kodeReq = String(params.kodeSoal || "").trim().toLowerCase();
    
    var sheetJadwal = ss.getSheetByName("Jadwal_Ujian");
    var jadwalData = null;
    if (sheetJadwal && sheetJadwal.getLastRow() > 1) {
      var dataJ = sheetJadwal.getRange(2, 1, sheetJadwal.getLastRow() - 1, 6).getDisplayValues();
      for (var i = 0; i < dataJ.length; i++) {
        if (String(dataJ[i][0] || "").trim().toLowerCase() === kodeReq) {
          jadwalData = {
            kodeSoal: dataJ[i][0],
            namaUjian: dataJ[i][1],
            jadwalMulai: dataJ[i][2],
            jadwalSelesai: dataJ[i][3],
            durasi: dataJ[i][4]
          };
          break;
        }
      }
    }

    var sheetBank = ss.getSheetByName("Bank_Soal");
    var soalObj = [];
    if (sheetBank && sheetBank.getLastRow() > 1) {
      var dataB = sheetBank.getRange(2, 1, sheetBank.getLastRow() - 1, 2).getDisplayValues();
      for (var b = 0; b < dataB.length; b++) {
        if (String(dataB[b][0] || "").trim().toLowerCase() === kodeReq) {
          try { soalObj = JSON.parse(dataB[b][1]); } catch(e) {}
          break;
        }
      }
    }

    var sheetKunci = ss.getSheetByName("Kunci");
    var kunciStrArr = [];
    if (sheetKunci && sheetKunci.getLastRow() > 1) {
      var dataK = sheetKunci.getRange(2, 1, sheetKunci.getLastRow() - 1, 3).getDisplayValues();
      for (var k = 0; k < dataK.length; k++) {
        if (String(dataK[k][0] || "").trim().toLowerCase() === kodeReq) {
          kunciStrArr.push(dataK[k][1] + ":" + dataK[k][2]);
        }
      }
    }

    if (!jadwalData && soalObj.length === 0) {
      return responseJSON({ status: "error", message: "Paket soal '" + kodeReq + "' tidak ditemukan!" });
    }

    return responseJSON({
      status: "success",
      data: {
        jadwal: jadwalData,
        soalJson: soalObj,
        kunciText: kunciStrArr.join(", ")
      }
    });
  }

  // ==========================================
  // --- 5. FITUR ADMIN: UPDATE / SIMPAN EDITAN ---
  // ==========================================
  if (action === "updateexampackage") {
    var kodeSoal      = String(params.kodeSoal || "").trim();
    var namaUjian     = String(params.namaUjian || "").trim();
    var durasi        = params.durasi || 60;
    var jadwalMulai   = params.jadwalMulai;
    var jadwalSelesai = params.jadwalSelesai;
    var soalJson      = params.soalJson || [];
    var kunciObj      = params.kunciObj || {};

    var sheetJadwal = ss.getSheetByName("Jadwal_Ujian");
    if (sheetJadwal && sheetJadwal.getLastRow() > 1) {
      var dataJ = sheetJadwal.getRange(2, 1, sheetJadwal.getLastRow() - 1, 1).getDisplayValues();
      for (var j = 0; j < dataJ.length; j++) {
        if (String(dataJ[j][0] || "").trim().toLowerCase() === kodeSoal.toLowerCase()) {
          sheetJadwal.getRange(j + 2, 2, 1, 5).setValues([[namaUjian, jadwalMulai, jadwalSelesai, durasi, "AKTIF"]]);
          break;
        }
      }
    }

    var sheetBank = ss.getSheetByName("Bank_Soal");
    if (sheetBank && sheetBank.getLastRow() > 1) {
      var dataB = sheetBank.getRange(2, 1, sheetBank.getLastRow() - 1, 1).getDisplayValues();
      for (var b = 0; b < dataB.length; b++) {
        if (String(dataB[b][0] || "").trim().toLowerCase() === kodeSoal.toLowerCase()) {
          sheetBank.getRange(b + 2, 2).setValue(JSON.stringify(soalJson));
          break;
        }
      }
    }

    var sheetKunci = ss.getSheetByName("Kunci");
    if (sheetKunci && sheetKunci.getLastRow() > 1) {
      var lastR = sheetKunci.getLastRow();
      for (var k = lastR; k >= 2; k--) {
        var valPkt = String(sheetKunci.getRange(k, 1).getValue() || "").trim().toLowerCase();
        if (valPkt === kodeSoal.toLowerCase()) {
          sheetKunci.deleteRow(k);
        }
      }
    }
    for (var qNum in kunciObj) {
      sheetKunci.appendRow([kodeSoal, qNum, kunciObj[qNum]]);
    }

    return responseJSON({
      status: "success",
      message: "Paket Ujian '" + kodeSoal + "' berhasil diperbarui!"
    });
  }

  // ==========================================
  // --- 6. FITUR LOGIN USER (SISWA BERBASIS KODE UJIAN) ---
  // ==========================================
  if (action === "login") {
    var usernameInput = String(params.username || "").trim().toLowerCase();
    var passwordInput = String(params.password || "").trim();
    var paketInput    = String(params.paket || "").trim().toLowerCase();

    var sheetSiswa = ss.getSheetByName("Siswa");
    if (!sheetSiswa) {
      return responseJSON({ status: "error", message: "Sheet 'Siswa' tidak ditemukan!" });
    }

    var lastRowSiswa = sheetSiswa.getLastRow();
    if (lastRowSiswa < 2) {
      return responseJSON({ status: "fail", message: "Data siswa masih kosong!" });
    }

    // 1️⃣ CEK APABILA SISWA SUDAH PERNAH MENYELESAIKAN (SUBMIT) PAKET UJIAN INI
    var sheetHasilCheck = ss.getSheetByName("Hasil_UJIAN") || ss.getSheetByName("Hasil");
    if (sheetHasilCheck && sheetHasilCheck.getLastRow() > 1) {
      var dataHasilCheck = sheetHasilCheck.getRange(2, 1, sheetHasilCheck.getLastRow() - 1, 7).getDisplayValues();
      for (var k = 0; k < dataHasilCheck.length; k++) {
        var dbNisn = String(dataHasilCheck[k][1] || "").trim().toLowerCase();
        var dbSummary = String(dataHasilCheck[k][6] || "").trim().toLowerCase();

        if (dbNisn === usernameInput && (paketInput && dbSummary.indexOf(paketInput) !== -1)) {
          return responseJSON({
            status: "fail",
            message: "Anda sudah menyelesaikan paket ujian " + paketInput.toUpperCase() + " dan tidak dapat mengulangnya!"
          });
        }
      }
    }

    // 2️⃣ VERIFIKASI USERNAME, PASSWORD, DAN STATUS KUNCI UJIAN
    var dataSiswa = sheetSiswa.getRange(1, 1, lastRowSiswa, 5).getDisplayValues();

    for (var i = 1; i < dataSiswa.length; i++) {
      var dbUser   = String(dataSiswa[i][0] || "").trim().toLowerCase();
      var dbPass   = String(dataSiswa[i][1] || "").trim();
      var dbNama   = String(dataSiswa[i][2] || "").trim() || "Siswa";
      var dbKelas  = String(dataSiswa[i][3] || "").trim() || "-";
      var dbStatus = String(dataSiswa[i][4] || "").trim().toUpperCase();

      if (dbUser === usernameInput && dbPass === passwordInput) {
        
        var currentPaketTag = "ONLINE_" + paketInput.toUpperCase();

        // 🔒 JIKA TERKUNCI DI PAKET UJIAN YANG SAMA
        if (dbStatus === currentPaketTag) {
          return responseJSON({
            status: "fail",
            message: "Sesi ujian " + paketInput.toUpperCase() + " Anda sedang aktif di perangkat lain! Hubungi Proktor/Guru untuk reset sesi."
          });
        }

        // 🔒 JIKA SISWA MASIH AKTIF DI PAKET LAIN (BELUM SUBMIT SOAL LAIN)
        if (dbStatus.indexOf("ONLINE_") === 0 && dbStatus !== currentPaketTag) {
          var activeExamCode = dbStatus.replace("ONLINE_", "");
          return responseJSON({
            status: "fail",
            message: "Anda masih memiliki sesi aktif di ujian " + activeExamCode + ". Selesaikan atau minta Proktor me-reset ujian tersebut dahulu!"
          });
        }

        // ✅ JIKA STATUS "OFFLINE", CATAT KODE PAKET YANG SEDANG DIKERJAKAN SEMENTARA
        sheetSiswa.getRange(i + 1, 5).setValue(currentPaketTag);

        return responseJSON({
          status: "success",
          user: { username: dbUser, nama: dbNama, kelas: dbKelas }
        });
      }
    }

    return responseJSON({ status: "fail", message: "NISN/Username atau Password salah!" });
  }

  // ==========================================
  // --- 7. FITUR LOGOUT / RESET SESI ---
  // ==========================================
  if (action === "logout") {
    var usernameLogout = String(params.username || "").trim().toLowerCase();
    var sheetSiswaLogout = ss.getSheetByName("Siswa");
    
    if (sheetSiswaLogout && sheetSiswaLogout.getLastRow() > 1) {
      var listUsers = sheetSiswaLogout.getRange(2, 1, sheetSiswaLogout.getLastRow() - 1, 1).getDisplayValues();
      for (var m = 0; m < listUsers.length; m++) {
        if (String(listUsers[m][0] || "").trim().toLowerCase() === usernameLogout) {
          sheetSiswaLogout.getRange(m + 2, 5).setValue("OFFLINE");
          break;
        }
      }
    }
    return responseJSON({ status: "success", message: "Logout berhasil" });
  }

  // ==========================================
  // --- 8. FITUR SUBMIT & SIMPAN HASIL ---
  // ==========================================
  if (action === "submit") {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (err) {
      return responseJSON({ status: "error", message: "Server sibuk, silakan coba kirim ulang." });
    }

    try {
      var sheetHasil = ss.getSheetByName("Hasil_UJIAN") || ss.getSheetByName("Hasil");
      
      if (!sheetHasil) {
        sheetHasil = ss.insertSheet("Hasil_UJIAN");
        sheetHasil.appendRow([
          "Waktu Selesai", "NISN", "Nama Siswa", "Kelas", "Nilai Objektif (0-100)", "Detail Jawaban (JSON)", "Ringkasan Skor"
        ]);
      }

      var userAnswers = params.jawaban || {};
      if (typeof userAnswers === "string") {
        try { userAnswers = JSON.parse(userAnswers); } catch(e) { userAnswers = {}; }
      }

      var finalUsername = String(params.username || "-").trim();
      var finalNama     = String(params.nama || "").trim();
      var finalKelas    = String(params.kelas || "").trim();
      var paketUjian    = String(params.paket || "soal-uh1").trim();

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
        } else {
          if (String(userVal).trim().toUpperCase() === String(keyVal).trim().toUpperCase()) {
            correctCount++;
          }
        }
      }

      var calculatedScore = totalObjective > 0 ? Math.round((correctCount / totalObjective) * 100) : 0;
      var detailJawabanStr = JSON.stringify(userAnswers);
      var summaryStr = "Benar " + correctCount + " dari " + totalObjective + " Soal (" + paketUjian + ")";

      sheetHasil.appendRow([
        new Date(), finalUsername, finalNama || "Siswa", finalKelas || "-", calculatedScore, detailJawabanStr, summaryStr
      ]);

      // 🔄 SETELAH SUBMIT: KEMBALIKAN STATUS SISWA MENJADI OFFLINE AGAR BISA MENGAMBIL UJIAN LAIN
      var sheetSiswaStatus = ss.getSheetByName("Siswa");
      if (sheetSiswaStatus && sheetSiswaStatus.getLastRow() > 1) {
        var usersArr = sheetSiswaStatus.getRange(2, 1, sheetSiswaStatus.getLastRow() - 1, 1).getDisplayValues();
        for (var n = 0; n < usersArr.length; n++) {
          if (String(usersArr[n][0] || "").trim().toLowerCase() === finalUsername.toLowerCase()) {
            sheetSiswaStatus.getRange(n + 2, 5).setValue("OFFLINE");
            break;
          }
        }
      }

      return responseJSON({ status: "success", message: "Data ujian berhasil disimpan." });

    } finally {
      lock.releaseLock();
    }
  }

  return responseJSON({ status: "error", message: "Aksi tidak dikenal!" });
}

function getAnswerKeysFromSheet(ss, paketUjian) {
  var sheetKunci = ss.getSheetByName("Kunci");
  var keys = {};

  if (!sheetKunci || sheetKunci.getLastRow() < 2) return keys;

  var data = sheetKunci.getRange(2, 1, sheetKunci.getLastRow() - 1, 3).getDisplayValues();

  for (var i = 0; i < data.length; i++) {
    var pkt    = String(data[i][0] || "").trim().toLowerCase();
    var qNum   = String(data[i][1] || "").trim(); 
    var keyVal = String(data[i][2] || "").trim(); 

    var cleanPaketParam = paketUjian.toLowerCase().replace("./data/", "").replace(".json", "");
    var cleanPktSheet   = pkt.replace("./data/", "").replace(".json", "");

    if (cleanPktSheet === cleanPaketParam) {
      if (keyVal.indexOf(",") !== -1) {
        keys[qNum] = keyVal.split(",").map(function(s) { return s.trim().toUpperCase(); });
      } else {
        keys[qNum] = keyVal.toUpperCase();
      }
    }
  }

  return keys;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
