const cron = require("node-cron");
const moment = require("moment");
const conn = require("../Database/ConfigDB"); // Koneksi database

// Fungsi untuk menghasilkan ID acak
const generateRandomString = (length) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// Cron job: setiap hari pukul 09:00
cron.schedule("0 12 * * *", async () => {
    try {
        const currentDate = moment().format("YYYY-MM-DD");

        // Ambil kelas & rombel PKL dari config_pkl
        const kelasPkl = await conn("config_pkl").select("id_kelas", "id_rombel");

        // Ambil semua siswa yang belum absen
        const siswaBelumAbsen = await conn("siswa")
            .leftJoin("absensi", function () {
                this.on("siswa.id_siswa", "=", "absensi.id_siswa").andOn(
                    "absensi.tanggal",
                    "=",
                    conn.raw("?", [currentDate])
                );
            })
            .select("siswa.id_siswa", "siswa.id_kelas", "siswa.id_rombel")
            .whereNull("absensi.id_siswa");

        // Pisahkan siswa PKL & non-PKL
        const siswaPKL = [];
        const siswaNonPKL = [];

        siswaBelumAbsen.forEach((siswa) => {
            const isSiswaPKL = kelasPkl.some(
                (kp) => kp.id_kelas === siswa.id_kelas && kp.id_rombel === siswa.id_rombel
            );

            if (isSiswaPKL) {
                siswaPKL.push({
                    id_absen: generateRandomString(5),
                    id_siswa: siswa.id_siswa,
                    keterangan: "PKL",
                    tanggal: currentDate,
                    datang: null,
                    pulang: null,
                });
            } else {
                siswaNonPKL.push({
                    id_absen: generateRandomString(5),
                    id_siswa: siswa.id_siswa,
                    keterangan: "Alpa",
                    tanggal: currentDate,
                    datang: null,
                    pulang: null,
                });
            }
        });

        // Simpan absensi
        if (siswaPKL.length > 0) {
            await conn("absensi").insert(siswaPKL);
            console.log(`[${currentDate}] ${siswaPKL.length} siswa PKL otomatis ditandai PKL.`);
        }

        if (siswaNonPKL.length > 0) {
            await conn("absensi").insert(siswaNonPKL);
            console.log(`[${currentDate}] ${siswaNonPKL.length} siswa non-PKL otomatis ditandai Alpa.`);
        }

        if (siswaPKL.length === 0 && siswaNonPKL.length === 0) {
            console.log(`[${currentDate}] Semua siswa sudah absen sebelum jam 09:00.`);
        }
    } catch (error) {
        console.error("Gagal menjalankan cron job untuk absensi:", error);
    }
});

// Ekspor biar bisa dipakai di file lain
module.exports = cron;
