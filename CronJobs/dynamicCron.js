const cron = require("node-cron");
const moment = require("moment");
const conn = require("../Database/ConfigDB");
let task = null;

// jalankan absensi otomatis
async function runJob() {
    const currentDate = moment().format("YYYY-MM-DD");

    const kelasPkl = await conn("config_pkl").select("id_kelas", "id_rombel");

    const siswaBelumAbsen = await conn("siswa")
        .leftJoin("absensi", function () {
            this.on("siswa.id_siswa", "=", "absensi.id_siswa")
                .andOn("absensi.tanggal", "=", conn.raw("?", [currentDate]));
        })
        .select("siswa.id_siswa", "siswa.id_kelas", "siswa.id_rombel")
        .whereNull("absensi.id_siswa");

    const siswaPKL = [];
    const siswaNonPKL = [];

    siswaBelumAbsen.forEach((s) => {
        const isPkl = kelasPkl.some(
            (kp) => kp.id_kelas === s.id_kelas && kp.id_rombel === s.id_rombel
        );

        const data = {
            id_absen: generateRandom(5),
            id_siswa: s.id_siswa,
            keterangan: isPkl ? "PKL" : "Alpa",
            tanggal: currentDate,
            datang: null,
            pulang: null,
        };

        isPkl ? siswaPKL.push(data) : siswaNonPKL.push(data);
    });

    if (siswaPKL.length) await conn("absensi").insert(siswaPKL);
    if (siswaNonPKL.length) await conn("absensi").insert(siswaNonPKL);
}

function generateRandom(length) {
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

async function startDynamicCron() {
    const setting = await conn("setting").first("batas_absen");

    if (!setting || !setting.batas_absen) {
        console.log("Cron time belum diset di tabel setting");
        return;
    }

    const cronTime = setting.batas_absen;

    if (task) {
        task.stop();
        console.log("Cron sebelumnya dihentikan");
    }

    if (!cron.validate(cronTime)) {
        console.log("Format cron tidak valid:", cronTime);
        return;
    }

    task = cron.schedule(cronTime, runJob);
    console.log("Cron dijalankan dengan jadwal:", cronTime);
}

module.exports = { startDynamicCron };
