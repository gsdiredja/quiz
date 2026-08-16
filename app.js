document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const alertBox = document.getElementById("alertBox");
  const jenisUjianSelect = document.getElementById("jenisUjian");

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXMJAupaHR29GuFx5-7IECHTJ3p7Och8OgI_vBpkXXYypkRGqf6y0bS1VUTZxuCjY/exec";

  // Tarik Paket Ujian Aktif dari Sheet 'Jadwal_Ujian'
  async function loadActiveExams() {
    if (!jenisUjianSelect) return;

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getactiveexams" })
      });

      const activeExams = await response.json();
      jenisUjianSelect.innerHTML = "";

      if (Array.isArray(activeExams) && activeExams.length > 0) {
        activeExams.forEach((exam, idx) => {
          const option = document.createElement("option");
          option.value = exam.kode; 
          option.textContent = `${exam.kode} - ${exam.nama} (${exam.durasi} Menit)`;
          if (idx === 0) option.selected = true;
          jenisUjianSelect.appendChild(option);
        });
      } else {
        jenisUjianSelect.innerHTML = `<option value="" disabled selected>🚫 Tidak ada ujian aktif saat ini</option>`;
      }
    } catch (error) {
      console.error("Gagal memuat jadwal:", error);
      jenisUjianSelect.innerHTML = `<option value="soal-uh1" selected>UH1 - Pemrograman Dasar</option>`;
    }
  }

  loadActiveExams();

  // Logika Form Login Siswa
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const jenisUjian = document.getElementById("jenisUjian").value;
      
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
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "login",
            username: username,
            password: password,
            paket: jenisUjian
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
        console.error("Login Error:", error);
        showAlert("HUBUNGI ADMIN/PROKTOR");
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }

  function showAlert(message) {
    if (alertBox) {
      alertBox.innerHTML = `<span style="color: #dc2626; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ ${message}</span>`;
      alertBox.style.display = "block";
      alertBox.style.backgroundColor = "#fee2e2";
      alertBox.style.border = "2px solid #ef4444";
      alertBox.style.padding = "12px 16px";
      alertBox.style.borderRadius = "8px";
      alertBox.style.marginTop = "14px";
      alertBox.style.textAlign = "center";
      alertBox.style.boxShadow = "0 2px 6px rgba(239, 68, 68, 0.15)";
    } else {
      alert(message);
    }
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.style.display = "none";
      alertBox.innerHTML = "";
    }
  }
});
