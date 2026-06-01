// 1. ตั้งค่า Firebase Config ของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyADzVirlflWjw7ux1i8fRNFUNSBT139-6I",
    authDomain: "slot-machine-ff297.firebaseapp.com",
    databaseURL: "https://slot-machine-ff297-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "slot-machine-ff297",
    storageBucket: "slot-machine-ff297.firebasestorage.app",
    messagingSenderId: "196859530049",
    appId: "1:196859530049:web:09ba13fa577fd5fbe1efc0"
};

// เริ่มต้น Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();


const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
const playerNameSpan = document.querySelector('.player-name');

// 🎁 รายการของรางวัลพร้อมรูปภาพของคุณ
const prizes = [
    { name: "หมอนรองคอ", image: "2.png" },   
    { name: "กระบอกน้ำ", image: "4.png" },    
    { name: "ชุดถนอมอาหาร", image: "5.png" },       
    { name: "แก้วน้ำปาร์ตี้", image: "8.png" }, 
    { name: "แก้วชงชากาแฟ", image: "10.png" },
    { name: "ถุงผ้าเก็บของ", image: "11.png" }
];

const numPrizes = prizes.length;
const degreesPerSlice = 360 / numPrizes; // แต่ละช่องกว้างกี่องศา (6 ช่อง ช่องละ 60 องศา)
let currentRotation = 0;
let isSpinning = false;
let currentQueueData = null;

// 🛠️ ฟังก์ชันสร้างรูปภาพยัดลงไปในวงล้อ HTML เดิม (เอาส่วนข้อความออกแล้ว)
function createWheelItems() {
    prizes.forEach((prize, index) => {
        // สร้างกล่องสำหรับแต่ละเซกเมนต์
        const item = document.createElement('div');
        item.className = 'wheel-item';
        
        // คำนวณองศาให้ไอเทมหมุนไปอยู่ตรงกลางช่องพอดี
        const rotationAngle = (index * degreesPerSlice) + (degreesPerSlice / 2);
        item.style.transform = `rotate(${rotationAngle}deg)`;

        // สร้างส่วนรูปภาพ
        const img = document.createElement('img');
        img.src = prize.image;
        img.alt = prize.name;

        // ประกอบร่าง (ใส่เฉพาะรูปภาพเข้าไป ไม่ใส่ textSpan แล้ว)
        item.appendChild(img);
        wheel.appendChild(item);
    });
}

// เรียกใช้งานฟังก์ชันสร้างไอเทมในวงล้อทันทีเมื่อโหลดสคริปต์
createWheelItems();

// 🔄 ดึงข้อมูลคิวจาก Firebase Realtime Database
// บล็อกนี้ใน Wheel.js จะทำหน้าที่เปลี่ยนเครื่องหมาย "-" ให้เป็นชื่อลูกค้าอัตโนมัติ
db.ref('customerQueue').on('value', (snapshot) => {
    const queue = snapshot.val();
    currentQueueData = queue; 
    
    if (queue) {
        const keys = Object.keys(queue);
        if (keys.length > 0) {
            const firstKey = keys[0];
            const firstPlayer = queue[firstKey];
            
            // ดึงชื่อออกมา
            const nameToShow = (typeof firstPlayer === 'object') ? firstPlayer.name : firstPlayer;
            
            // 🎯 เปลี่ยนข้อความในแผ่นป้ายจาก "-" เป็นชื่อลูกค้าที่ดึงมาได้
            playerNameSpan.innerText = nameToShow; 
            spinBtn.disabled = false; 
            return;
        }
    }
    
    // ถ้าใน Firebase ไม่มีคิวเหลืออยู่เลย
    playerNameSpan.innerText = "-";
    spinBtn.disabled = true; 
});


// 🎡 ระบบสุ่มคำนวณและหมุนวงล้อ
spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;

    const randomDegree = Math.floor(Math.random() * 360);
    const totalRotation = currentRotation + (360 * 5) + randomDegree;
    currentRotation = totalRotation;

    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {
        const actualDegree = (360 - (totalRotation % 360)) % 360;
        const prizeIndex = Math.floor(actualDegree / degreesPerSlice) % numPrizes;
        const winningPrize = prizes[prizeIndex];

        // 🌟 3. เรียกใช้งาน SweetAlert2 โชว์รูปภาพและชื่อของรางวัลสุดปัง
        Swal.fire({
            title: 'ยินดีด้วยด้วยค่ะ! 🎉',
            html: `<b style="font-size: 28px; color: #ec4899;">คุณได้รับ: ${winningPrize.name}</b>`,
            imageUrl: winningPrize.image, // เอารูปของรางวัลมาโชว์ในป๊อปอัพด้วย
            imageWidth: 180,
            imageHeight: 180,
            imageAlt: winningPrize.name,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#2d3748', // สีปุ่มสไตล์เส้นขอบการ์ตูน
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title'
            }
        });

        isSpinning = false;
        spinBtn.disabled = false;
    }, 4000); 
});

// ⌨️ เพิ่มระบบดักจับการกดปุ่มบนคีย์บอร์ด
window.addEventListener('keydown', (event) => {
    // เช็กว่าปุ่มที่กดคือปุ่ม "Enter" หรือไม่
    if (event.key === 'Enter') {
        // เช็กเพิ่มเติมว่าปุ่มสปินไม่ได้ถูกสั่งปิดการใช้งานอยู่ (ป้องกันการกด Enter ซ้ำรัวๆ ตอนล้อกำลังหมุน)
        if (!spinBtn.disabled) {
            // สั่งให้ระบบทำงานเหมือนกับการคลิกปุ่ม START ทันที
            spinBtn.click();
        }
    }
});
