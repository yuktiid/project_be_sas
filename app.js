const express = require('express')
const cors = require('cors'); // Import cors
const app = express()

//cronJOB
const cronJob = require('./CronJobs/cron'); // Jalankan Cron Job

// const verifyToken = require('../../middleware/jwToken')
const cookieParser = require('cookie-parser')
require('dotenv').config(); // Memuat variabel dari .env
const PORT = process.env.PORT;

const tes = require('./routes/masterData/tes')
const path = require('path');
//rute data
const EPAdmin = require('./routes/administrator/user')
const EPLoginDash = require('./routes/login')
const EPSiswa = require('./routes/masterData/siswa')
const EPTahunPelajaran = require('./routes/masterData/tahunAjaran')
const EPKelas = require('./routes/masterData/kelas')
const EPRombel = require('./routes/masterData/rombel')
const EPGuru = require('./routes/masterData/guru')
const EPMapel = require('./routes/masterData/mapel')

//Data Join
const EPTotKelasSiswa = require('./routes/NonMasterData/joinData')
const EPNaikKelas = require('./routes/NonMasterData/naikkelas')

// Setting
const EPSetting = require('./routes/setting')

//Absensi
const EPAbsensi = require('./routes/absensiSiswa/absensiSiswa')





// Pastikan path ini sesuai dengan lokasi sebenarnya dari folder `uploads`
app.use('/img', express.static(path.join(__dirname, 'uploads/siswa/')));


// Gunakan cors dengan konfigurasi untuk mengizinkan permintaan dari http://localhost:3000
app.use(cookieParser());
app.use(cors({
    
    // origin: 'http://localhost:60830//' //flutter
    // origin: 'http://localhost:3000',
    origin : 'https://sas.smkbudimuliapakisaji.sch.id'
  }));

 // Middleware untuk mengurai body dalam format JSON
app.use(express.json())

app.get('/', (req, res)=>{
    res.send('Express The word')
})

// End point / Url API
// Login
app.use('/api', EPLoginDash)
// Administrator
app.use('/admin', EPAdmin)
// Master Data
app.use('/siswa', EPSiswa)
app.use('/tahun-pelajaran', EPTahunPelajaran)
app.use('/kelas', EPKelas)
app.use('/rombel', EPRombel)
app.use('/guru', EPGuru)
app.use('/mapel', EPMapel)
app.use('/tes', tes)

// Non Master data
app.use('/joinNonMaster', EPTotKelasSiswa)
app.use('/naik', EPNaikKelas)

//Setting
app.use('/setting', EPSetting)


//Absensi
app.use('/absensi', EPAbsensi)

// Cron job otomatis dijalankan setiap hari pukul yang ditentukan
// require('./CronJobs/cron'); // Pastikan cron job terjadwal
const { startDynamicCron } = require('./CronJobs/dynamicCron');
startDynamicCron();


app.listen(PORT, ()=>{
    console.log(`brtjalan di PORT http://localhost:${PORT}`)
})