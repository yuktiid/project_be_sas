const express = require('express');
const router = express.Router();
const conn = require('../Database/ConfigDB')// koneksi ke database
// const bcrypt = require('bcrypt')
const verifyToken = require('../middleware/jwToken')
const multer = require('multer');

// Setup multer untuk menyimpan file logo
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Fungsi untuk mengacak karakter untuk ID
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
  
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters[randomIndex];
    }
  
    return randomString;
  }

router.post('/setting-sistem', async (req, res) => {
    const rombelDataArray = req.body;
    const resultMessages = [];

    if (Array.isArray(rombelDataArray) && rombelDataArray.length > 0) {
        try {
            await conn.transaction(async trx => {
                for (const rombelData of rombelDataArray) {
                    const { hari, jam_masuk, jam_pulang, jam_terlambat, tanggal_libur } = rombelData;

                    // Validasi: Jika hari kosong, tanggal_libur harus diisi, dan sebaliknya
                    if (!hari && !tanggal_libur) {
                        resultMessages.push({
                            hari,
                            status: 'Gagal',
                            message: 'Harus mengisi salah satu (hari atau tanggal_libur)',
                        });
                        continue; // Lewati iterasi jika tidak ada hari dan tanggal_libur
                    }

                    // Cek apakah semua jam kosong
                    const isLibur = (!jam_masuk || jam_masuk.every(time => time === "")) &&
                                    (!jam_pulang || jam_pulang.every(time => time === "")) &&
                                    (!jam_terlambat || jam_terlambat.every(time => time === ""));

                    // Jika hari libur, set "libur" pada jam_masuk, jam_pulang, dan jam_terlambat
                    const newJamMasuk = isLibur ? ["libur", "libur"] : jam_masuk;
                    const newJamPulang = isLibur ? ["libur", "libur"] : jam_pulang;
                    const newJamTerlambat = isLibur ? ["libur", "libur"] : jam_terlambat;

                    const statusMessage = isLibur
                        ? `Data berhasil diperbarui sebagai hari libur pada ${tanggal_libur || 'setiap ' + hari}`
                        : 'Data berhasil diperbarui';

                    // Cek apakah data sudah ada untuk hari tertentu atau tanggal tertentu
                    let existingDataQuery = trx('setting').where('hari', hari);

                    // Jika ada tanggal_libur, cek apakah sudah ada data dengan tanggal tersebut
                    if (tanggal_libur) {
                        existingDataQuery = existingDataQuery.andWhere('tanggal_libur', tanggal_libur);
                    } else {
                        existingDataQuery = existingDataQuery.whereNull('tanggal_libur');
                    }
                    
                    const existingData = await existingDataQuery.first();

                    if (existingData) {
                        // Update data jika sudah ada
                        await trx('setting')
                            .where('id_setting', existingData.id_setting)
                            .update({
                                jam_masuk: JSON.stringify(newJamMasuk),
                                jam_pulang: JSON.stringify(newJamPulang),
                                jam_terlambat: JSON.stringify(newJamTerlambat),
                                tanggal_libur: tanggal_libur || null, // Update jika ada tanggal libur
                            });

                        resultMessages.push({
                            hari,
                            status: 'Berhasil',
                            message: statusMessage,
                        });
                    } else {
                        // Tambahkan data baru jika belum ada
                        const idAcak = generateRandomString(5);
                        const addData = {
                            id_setting: idAcak,
                            hari,
                            tanggal_libur: tanggal_libur || null, // Simpan tanggal libur jika ada
                            jam_masuk: JSON.stringify(newJamMasuk),
                            jam_pulang: JSON.stringify(newJamPulang),
                            jam_terlambat: JSON.stringify(newJamTerlambat),
                        };

                        await trx('setting').insert(addData);

                        resultMessages.push({
                            hari,
                            status: 'Berhasil',
                            message: statusMessage,
                        });
                    }
                }
            });

            res.status(207).json({
                Status: 207,
                success: true,
                results: resultMessages,
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                Status: 500,
                error: error.message || 'Internal Server Error',
            });
        }
    } else {
        res.status(400).json({
            Status: 400,
            success: false,
            message: 'Data tidak valid atau kosong',
        });
    }
});

router.get('/all-setting', async (req, res) => {
  try {
      const data = await conn('setting').select('*');

      let liburDays = [];
      let tanggalLibur = [];

      if (Array.isArray(data)) {
          // Memisahkan hari libur (libur berdasarkan hari seperti Sabtu/Minggu)
          liburDays = data
              .filter(item => {
                  const jamMasukArray = JSON.parse(item.jam_masuk || '[]');
                  const jamPulangArray = JSON.parse(item.jam_pulang || '[]');
                  const jamTerlambatArray = JSON.parse(item.jam_terlambat || '[]');

                  // Memeriksa apakah semua jam libur (semua jam masuk, pulang, terlambat adalah "libur")
                  const isLibur = jamMasukArray.every(time => time === "libur") &&
                                  jamPulangArray.every(time => time === "libur") &&
                                  jamTerlambatArray.every(time => time === "libur");

                  return isLibur; // Jika semuanya "libur", maka hari tersebut adalah libur
              })
              .map(item => item.hari); // Ambil hanya nama hari yang libur

          // Memisahkan tanggal libur (libur berdasarkan tanggal spesifik)
          tanggalLibur = data
              .filter(item => item.tanggal_libur) // Pastikan ada tanggal libur
              .map(item => item.tanggal_libur); // Ambil tanggal libur yang ada
      }

      // Format jam_masuk, jam_pulang, dan jam_terlambat serta tambahkan tanggal_libur
      const formattedData = data.map(item => {
          const jamMasukArray = JSON.parse(item.jam_masuk || '[]');
          const jamPulangArray = JSON.parse(item.jam_pulang || '[]');
          const jamTerlambatArray = JSON.parse(item.jam_terlambat || '[]');

          // Format jam_masuk, jam_pulang, dan jam_terlambat menjadi array string
          item.jam_masuk = `"${jamMasukArray.join('","')}"`;
          item.jam_pulang = `"${jamPulangArray.join('","')}"`;
          item.jam_terlambat = `"${jamTerlambatArray.join('","')}"`;

          // Tambahkan tanggal_libur ke dalam objek jika ada
          if (item.tanggal_libur) {
              item.tanggal_libur = item.tanggal_libur; // Tanggal spesifik libur
          } else {
              item.tanggal_libur = null; // Jika tidak ada tanggal libur
          }

          return item;
      });

      res.status(200).json({
          Status: 200,
          Message: "ok",
          data: formattedData,
          liburDays, // Daftar hari yang libur
          tanggalLibur, // Daftar tanggal libur
      });
  } catch (error) {
      console.error(error);
      res.status(500).json({
          Status: 500,
          error: 'Internal Server Error'
      });
  }
});

// Tambah atau update instansi
router.post('/instansi', upload.single('logo'), async (req, res) => {
    try {
        const { nama_instansi } = req.body;
        const logo = req.file ? req.file.path : null;  // Jika tidak ada file, set logo menjadi null

        // Cek apakah data instansi sudah ada (langsung check apakah ada instansi apapun di tabel)
        const existingInstansi = await conn('instansi').first();

        if (existingInstansi) {
            // Jika sudah ada, lakukan update
            await conn('instansi')
                .update({
                    nama_instansi,
                    logo: logo || existingInstansi.logo,  // Jika logo baru tidak ada, gunakan logo lama
                });

            return res.status(200).json({ success: true, message: 'Instansi berhasil diperbarui' });
        } else {
            // Jika belum ada data, insert data baru
            const idAcak = generateRandomString(5);  // Membuat id unik untuk instansi
            const dataInstansi = {
                id_instansi: idAcak,
                nama_instansi,
                logo,
            };

            await conn('instansi').insert(dataInstansi);  // Menyimpan data baru ke database

            return res.status(201).json({ success: true, message: 'Instansi berhasil ditambahkan', id_instansi: idAcak });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Ambil semua data instansi
router.get('/all-instansi', async (req, res) => {
    try {
        // Pilih hanya nama_instansi dan logo dari tabel instansi
        const instansi = await conn('instansi').select('nama_instansi', 'logo');
        
        res.status(200).json({ success: true, data: instansi });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// UPDATE / TAMBAH batas_absen UNTUK SEMUA HARI TANPA MENGUBAH JAM MASUK / PULANG
router.post('/update-batas-absen', async (req, res) => {
    try {
        const { batas_absen } = req.body;

        if (!batas_absen) {
            return res.status(400).json({
                message: "Field batas_absen wajib diisi"
            });
        }

        // Cek apakah ada setting lama
        const existing = await conn("setting").select("id_setting");

        if (existing.length === 0) {
            // Jika tabel kosong → buat 1 baris saja
            await conn("setting").insert({
                id_setting: generateRandomString(5),
                hari: "Senin", // default (boleh ubah kalau mau)
                jam_masuk: JSON.stringify(["07:00", "08:00"]),
                jam_pulang: JSON.stringify(["14:00", "16:00"]),
                jam_terlambat: JSON.stringify(["08:00", "08:30"]),
                batas_absen
            });

            return res.status(201).json({
                message: "Setting baru dibuat dan batas_absen ditambahkan"
            });
        }

        // Jika sudah ada → update semua baris setting yang ada
        await conn("setting").update({ batas_absen });
        const { startDynamicCron } = require("../CronJobs/dynamicCron");
startDynamicCron();

        return res.status(200).json({
            message: "batas_absen berhasil diperbarui di semua hari"
        });

    } catch (error) {
        console.error("Error update batas_absen:", error);
        res.status(500).json({
            message: "Gagal update batas_absen",
            error
        });
    }
});

// ===============================
//  GET batas_absen
// ===============================
router.get('/get-batas-absen', async (req, res) => {
    try {
        // Ambil batas_absen dari salah satu row (karena kamu update semua baris)
        const data = await conn("setting")
            .select("batas_absen")
            .whereNotNull("batas_absen")
            .first();

        if (!data) {
            return res.status(200).json({
                success: true,
                message: "Belum ada batas_absen",
                data: null
            });
        }

        return res.status(200).json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error("Error GET batas_absen:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil batas_absen"
        });
    }
});



  module.exports = router;