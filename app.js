document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const alertBox = document.getElementById("alertBox");
  const jenisUjianSelect = document.getElementById("jenisUjian");

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNtxm-31dvUr2ebTKFwrkr_Avv3vwHKtzA6djrt297RSlLxI0eW2COPWnMTE3IJjwl/exec";

  // 🔄 FUNGSI OTOMATIS: Tarik Paket Ujian Aktif dari Sheet 'Jadwal_Ujian'
  async function loadActiveExams() {
    if (!jenisUjianSelect) return;

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({ action: "getactiveexams" })
      });

      const activeExams = await response.json();

      jenisUjianSelect.innerHTML = ""; // Kosongkan placeholder loading

      if (Array.isArray(activeExams) && activeExams.length > 0) {
        activeExams.forEach(exam => {
          const option = document.createElement("option");
          option.value = exam.kode; 
          option.textContent = `${exam.kode} - ${exam.nama} (${exam.durasi} Menit)`;
          jenisUjianSelect.appendChild(option);
        });
      } else {
        jenisUjianSelect.innerHTML = `<option value="" disabled selected>🚫 Tidak ada ujian aktif saat ini</option>`;
      }
    } catch (error) {
      console.error("Gagal memuat jadwal dari Google Apps Script:", error);
      jenisUjianSelect.innerHTML = `<option value="soal-uh1" selected>UH1 - Pemrograman Dasar</option>`;
    }
  }

  // Jalankan pengambilan daftar ujian saat halaman selesai dimuat
  loadActiveExams();

  // --- LOGIKA FORM LOGIN ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const jenisUjian = document.getElementById("jenisUjian").value; // Ambil nilai paket ujian
      
      if (!jenisUjian) {
        showAlert("Pilih paket ujian yang valid terlebih dahulu!");
        return;
      }

      const submitBtn = loginForm.querySelector("button[type='submit']");
      const originalBtnText = submitBtn.innerText;
      submitBtn.innerText = "Memproses...";
      submitBtn.disabled = true;
      hideAlert();

      try {
        const response = await fetch(SCRIPT_URL, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "login",
            username: username,
            password: password,
            paket: jenisUjian // 👈 WAJIB: Mengirimkan kode paket ke GAS agar status menjadi ONLINE_KODEPAKET
          }),
        });

        const result = await response.json();

        if (result.status === "success") {
          localStorage.setItem("userData", JSON.stringify(result.user || { username: username, nama: username, kelas: "-" }));
          localStorage.setItem("soalPath", jenisUjian);
          window.location.href = "ujian.html";
        } else {
          showAlert(result.message || "Username atau Password salah!");
          submitBtn.innerText = originalBtnText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        console.error("Login Error / Offline Mode:", error);
        
        const fallbackUserData = { username: username, nama: username, kelas: "-" };
        localStorage.setItem("userData", JSON.stringify(fallbackUserData));
        localStorage.setItem("soalPath", jenisUjian);

        window.location.href = "ujian.html";
      }
    });
  }

  function showAlert(message) {
    if (alertBox) {
      alertBox.innerText = message;
      alertBox.style.display = "block";
    } else {
      alert(message);
    }
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.style.display = "none";
      alertBox.innerText = "";
    }
  }
});
