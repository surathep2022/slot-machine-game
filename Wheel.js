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
const playerNameSpan = document.querySelector('.player-name'); // อ้างอิง element ชื่อผู้เล่น เพื่ออัปเดตทุกครั้งที่หมุนเสร็จ

// 🎁 รายการของรางวัลพร้อมรูปภาพของคุณ
const prizes = [
    { name: "หมอนรองคอ", image: "2.png" },   
    { name: "กระบอกน้ำ", image: "4.png" },    
    { name: "ชุดถนอมอาหาร", image: "5.png" },       
    { name: "แก้วน้ำปาร์ตี้", image: "8.png" }, 
    { name: "แก้วชงชากาแฟ", image: "10.png" },
    { name: "ถุงผ้าเก็บของ", image: "11.png" },
    { name: "หมอนรองคอ", image: "2.png" },   
    { name: "กระบอกน้ำ", image: "4.png" },    
    { name: "ชุดถนอมอาหาร", image: "5.png" },       
    { name: "แก้วน้ำปาร์ตี้", image: "8.png" }, 
    { name: "แก้วชงชากาแฟ", image: "10.png" },
    { name: "ถุงผ้าเก็บของ", image: "11.png" },
  
];

const numPrizes = prizes.length;
const degreesPerSlice = 360 / numPrizes; // แต่ละช่องกว้างกี่องศา (6 ช่อง ช่องละ 60 องศา)
const START_INDEX = 0; // เริ่มต้นให้ลูกศรชี้ไปที่ช่องแรก
const START_DEGREE = -(degreesPerSlice / 2); // ตำแหน่งตรงกลางช่องแรกที่ชี้ขึ้นบน (-30°)
let currentRotation = START_DEGREE; // เริ่มจากช่องแรก
let isSpinning = false;
let currentQueueData = null;

let dbQueue = [];
let dbStock = {};
let dbTotalSpins = 0;
let lastWonPrizeName = "";

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

// ตั้งให้ลูกศรชี้ตรงกลางช่องแรกตอนเริ่มหน้า
wheel.style.transition = 'none';
wheel.style.transform = `rotate(${START_DEGREE}deg)`;

// 2. --- ฟังก์ชันล้าง/แปลงชื่อ สำหรับนำไปแสดงผลบนหน้าจอหน้าตู้ ---
function formatDisplayName(fullName) {
    if (!fullName) return "ไม่ระบุชื่อ";
    
    // ตัดเอาเฉพาะชื่อจริงท่อนแรกก่อนช่องว่าง
    let firstName = fullName.trim().split(' ')[0];          
   
    // 🎯 จำกัด 10 ตัวอักษร ถ้าชื่อยาวเกินให้หั่นเหลือ 10 แล้วเติม xxxxxx
    if (firstName.length > 10) {
        firstName = firstName.substring(0, 10) + "xxxxxx";
    }
    
    return firstName;
}

// 3. --- ฟังก์ชันอัปเดต UI รายชื่อคิวลูกค้าด้านล่าง ---
function updatePlayerInterface() {
    if (!spinBtn) return;
    const display = document.getElementById('current-player-display');
    const nameSpan = playerNameSpan;

    const uniqueQueue = [...new Set(dbQueue)];

    if (uniqueQueue && uniqueQueue.length > 0) {
        if (display) display.style.display = 'block';
        
        const formattedName = formatDisplayName(uniqueQueue[0]);
        if (nameSpan) nameSpan.textContent = formattedName;
        
        // 🎯 เช็คให้ชัวร์ว่าถ้าวงล้อไม่ได้กำลังหมุนอยู่ ต้องปล่อยให้ปุ่ม disabled เป็น false เสมอ
        spinBtn.disabled = isSpinning; 
    } else {
        if (display) display.style.display = 'none';
        if (nameSpan) nameSpan.textContent = '';
        spinBtn.disabled = true;
    }
}

// 4. ฟังก์ชันบันทึกข้อมูลไป Firebase
function saveResultToFirebase(customerName, prizeName, specialPrizeName) {
    // A. บันทึกประวัติผู้ชนะ
    db.ref('prizeHistory').push({
        customer: customerName,
        prize: prizeName,
        specialPrize: specialPrizeName || '',
        time: new Date().toLocaleString('th-TH'),
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    // B. หักสต็อกสินค้าที่ได้รางวัล (ใช้ Transaction เพื่อความแม่นยำ)
    db.ref('currentStock/' + prizeName).transaction((current) => {
        return (current || 0) - 1;
    });

    // C. เพิ่มจำนวนรอบรวม
    db.ref('totalSpins').transaction((count) => {
        return (count || 0) + 1;
    });
}


// 5. ฟังก์ชันหลักในการหมุน
// 5. ฟังก์ชันหลักในการหมุน (ปรับปรุงระบบคำนวณองศา ล็อกเป้าตรงช่อง 100%)
async function startSpin() {
    if (isSpinning) return;

    // 1. --- ตรวจสอบคิวลูกค้า ---
    if (dbQueue.length === 0) {
        Swal.fire({
            title: 'คิวว่าง',
            text: 'กรุณาแจ้ง SMS กับเจ้าหน้าที่ก่อนเริ่มหมุน',
            icon: 'info',
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title'
            }
        });
        return;
    }

    // 2. --- ตรวจสอบโควตา 100 ครั้ง และทำการสลับรอบอัตโนมัติ ---
    if (dbTotalSpins >= 100) {
        const snapshot = await db.ref().once('value');
        const data = snapshot.val();
        const nextQueue = data.nextRoundQueue;

        const isNextReady = nextQueue && Object.values(nextQueue).reduce((a, b) => a + (parseInt(b) || 0), 0) === 100;

        if (isNextReady) {
            Swal.fire({
                title: 'กำลังอัพเดทข้อมูล',
                text: 'ระบบกำลังดึงข้อมูลกรุณารอสักครู่',
                icon: 'info',
                showConfirmButton: false,
                timer: 2000
            }).then(async () => {
                await db.ref().update({
                    'currentStock': nextQueue,      
                    'prizeStock': nextQueue,        
                    'totalSpins': 0,                
                    'nextRoundQueue': {}            
                });
                location.reload();
            });
        } else {
            Swal.fire({
                title: 'ครบโควตา 100 รอบ',
                text: 'กรุณาตั้งค่าของรางวัลรอบถัดไปที่หน้า Admin ก่อนเริ่มต่อ',
                icon: 'warning',
                customClass: {
                    popup: 'custom-swal-popup',
                    title: 'custom-swal-title'
                }
            });
        }
        return; 
    }

    // --- เริ่มกระบวนการสุ่มปกติ ---
    const currentCustomer = dbQueue[0];

    // คำนวณหา "ครั้งที่หมุนในปัจจุบัน" (คนที่เท่าไหร่ในรอบ 1-100)
    // dbTotalSpins เริ่มจาก 0 ดังนั้น ครั้งที่ 1 คือ 0 (เลขคู่ในคอมแต่เป็นครั้งแรกของมนุษย์)
    // เพื่อให้ตรงกับเงื่อนไขมนุษย์: ครั้งที่ 1 (คี่), ครั้งที่ 2 (คู่) เราจะ +1 เข้าไปก่อนเช็ก
    const currentTurnNumber = dbTotalSpins + 1; 
    const isEvenTurn = (currentTurnNumber % 2 === 0); // เช็กว่าเป็นครั้งที่หมุนเลขคู่หรือไม่

    // ตรวจสอบสต็อกของแก้วน้ำปาร์ตี้ ณ ปัจจุบัน
    const partyCupStock = dbStock["แก้วน้ำปาร์ตี้"] || 0;

    // 🎯 [ตรวจสอบเบื้องต้น] ถ้าเป็นครั้งคู่แต่แก้วไม่พอ -> ให้เตือน
    if (isEvenTurn && partyCupStock === 0) {
        Swal.fire({
            title: '⚠️ แก้วปาร์ตี้หมด',
            text: 'ครั้งนี้ต้องออกแก้วปาร์ตี้ แต่สต็อกหมดแล้ว ระบบจะสุ่มจากของรางวัลอื่นแทน',
            icon: 'warning',
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title'
            }
        });
    }

    const currentRoundIndex = dbTotalSpins % 100;
    const isLactasoy = (currentRoundIndex % 5 === 0) && currentRoundIndex < 100 && currentRoundIndex >= 0;
    const specialPrizeName = isLactasoy ? 'แลคตาซอย' : 'Hartbeat';

    // --- ตรรกะการสุ่มรางวัลตาม Stock จาก Firebase ---
    let availablePrizes = [];
    prizes.forEach((prize, index) => {
        let count = dbStock[prize.name] || 0;
        
        // 🎯 🚩 [กรองเงื่อนไขสลับ ครั้งคี่-ครั้งคู่ อัตโนมัติ - บังคับตลอดเวลา]
        if (!isEvenTurn && prize.name === "แก้วน้ำปาร์ตี้") {
            // ❌ ครั้งที่หมุนเป็นเลขคี่ (1,3,5,...,99) -> ห้ามเอาแก้วน้ำปาร์ตี้ใส่ในตู้สุ่ม ให้สุ่มจากของอื่นแทน
            return; 
        }
        if (isEvenTurn && prize.name !== "แก้วน้ำปาร์ตี้") {
            // ❌ ครั้งที่หมุนเป็นเลขคู่ (2,4,6,...,100) -> บังคับเอาเฉพาะแก้วน้ำปาร์ตี้เท่านั้น (อย่างอื่นห้ามเข้า)
            return;
        }

        // ใส่ของรางวัลที่ผ่านเกณฑ์เข้าสู่กล่องสุ่มตามจำนวนสต็อก
        for (let i = 0; i < count; i++) { 
            availablePrizes.push(index); 
        }
    });

    // เซฟตี้: หากเกิดกรณีที่ครั้งเลขคู่ แต่แก้วน้ำปาร์ตี้หมดสต็อก จะสลับไปสุ่มจากของรางวัลที่มีเหลือทั้งหมด
    if (availablePrizes.length === 0) {
        // console.log("⚠️ ไม่มีของรางวัลตามเงื่อนไขคี่-คู่ -> สลับเป็นสุ่มจากของที่มีสต็อกเหลือ");
        prizes.forEach((prize, index) => {
            let count = dbStock[prize.name] || 0;
            for (let i = 0; i < count; i++) { availablePrizes.push(index); }
        });
    }

    // if (availablePrizes.length === 0) {
    //     Swal.fire({
    //         title: 'ของหมด',
    //         text: 'ของรางวัลในสต็อกหมดแล้ว',
    //         icon: 'warning',
    //         customClass: {
    //             popup: 'custom-swal-popup',
    //             title: 'custom-swal-title'
    //         }
    //     });
    //     return;
    // }

    // 🎯 🚩 [ตรรกะสุ่มเดิม ทำหน้าที่เลือกชิ้นจากรายการที่กรองแล้ว]
    let targetIdx = -1;
    let winPrize = null;
    let attempts = 0; 

    while (attempts < 10) {
        const randomIndex = Math.floor(Math.random() * availablePrizes.length);
        targetIdx = availablePrizes[randomIndex];
        winPrize = prizes[targetIdx];

        const uniquePrizesLeft = [...new Set(availablePrizes.map(idx => prizes[idx].name))];
        
        if (winPrize.name !== lastWonPrizeName || uniquePrizesLeft.length === 1) {
            break;
        }
        attempts++;
    }

    lastWonPrizeName = winPrize.name; 

    // --- เริ่มสถานะหมุน ---
    isSpinning = true;
    spinBtn.disabled = true;

    // เล่นเสียง
    const spinAudio = document.getElementById('spin-audio');
    if (spinAudio) {
        spinAudio.currentTime = 0;
        spinAudio.play().catch(e => console.log("Audio failed:", e));
    }

    // --- บันทึกข้อมูลลง Firebase ทันทีที่รู้ผล ---
    saveResultToFirebase(currentCustomer, winPrize.name, specialPrizeName);

    // ========================================================================
    // 🎯 🚩 [จุดแก้ไขสำคัญ: ปรับปรุงตรรกะการหมุนไปทางซ้ายให้ลงล็อกช่องรางวัลเป๊ะๆ]
    // ========================================================================
    
    // 1. คำนวณหาตำแหน่งองศาตรงกลางของช่องรางวัลเป้าหมาย
    //    ใช้มุมลบเพราะวงล้อหมุนไปทางซ้ายและลูกศรชี้ขึ้นบน
    const targetDegree = -(targetIdx * degreesPerSlice + (degreesPerSlice / 2));
    
    // 2. คำนวณหาจุดหยุดสุดท้าย (หมุนซ้าย 5 รอบเต็มแล้วเข้าหาตำแหน่งรางวัล)
    const baseRounds = 360 * 5;
    const currentModulo = ((currentRotation % 360) + 360) % 360;
    let distanceToTarget = (currentModulo - targetDegree + 360) % 360;
    if (distanceToTarget === 0) {
        distanceToTarget = 360;
    }

    const finalRotation = currentRotation - baseRounds - distanceToTarget;
    currentRotation = finalRotation; // บันทึกค่าตำแหน่งสะสมไว้ใช้ในตาถัดไป

    // 3. ใช้พลังของ CSS Transition ในการคุมสปีด (รวมทั้งหมุนแล้วหยุดใน 7 วินาที)
    wheel.style.transition = 'transform 7000ms cubic-bezier(0.25, 0.1, 0.1, 1)';
    wheel.style.transform = `rotate(${finalRotation}deg)`;

    // --- แสดงผลเมื่อหยุดหมุน (หลังจากเวลาผ่านไป 6 วินาทีเสร็จสิ้นพอดี) ---
    setTimeout(() => {
        if (spinAudio) spinAudio.pause();
        const winAudio = document.getElementById('win-audio');
        if (winAudio) {
            winAudio.currentTime = 0;
            winAudio.play().catch(e => console.log("Win audio failed:", e));
        }

        // --- ตรรกะควบคุมโควตารางวัลพิเศษ ---
        let specialPrizeHTML = '';
        let currentRoundIndex = dbTotalSpins % 100; 
        let isLactasoy = (currentRoundIndex % 5 === 0) && currentRoundIndex < 100 && currentRoundIndex >= 0;

        if (isLactasoy) {
            specialPrizeHTML = `
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <p style="margin: 0 0 10px 0; color: #34495e; font-weight: bold; font-size: 34px;">✨ รับเพิ่ม! รางวัลพิเศษ ✨</p>
                    <img src="lactasoy.png" style="width:300px; height:300px; object-fit:contain;">
                </div>
            `;
        } else {
            specialPrizeHTML = `
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <p style="margin: 0 0 10px 0; color: #34495e; font-weight: bold; font-size: 34px;">✨ รับเพิ่ม! รางวัลพิเศษ ✨</p>
                    <img src="hartbeat.png" style="width:300px; height:300px; object-fit:contain;">
                </div>
            `;
        }

        // ลบคิวคนแรกออกทันทีหลังการหมุนเสร็จ เพื่อให้ชื่อใหม่อัปเดตทันที
        if (dbQueue && dbQueue.length > 0) {
            const updatedQueue = [...dbQueue];
            updatedQueue.shift();
            dbQueue = updatedQueue;
            db.ref('customerQueue').set(updatedQueue);
        }

        updatePlayerInterface();

        // แสดงกล่องแจ้งเตือน SweetAlert2 สไตล์ตู้เกม
        Swal.fire({
            title: `ยินดีด้วย คุณ ${formatDisplayName(currentCustomer)}!`,
            html: `
                <b style="font-size: 34px;">ได้รับ:</b> <b style="color:#e74c3c; font-size: 34px;">${winPrize.name}</b>
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <img src="${winPrize.image}" style="width:300px; height:300px; object-fit:contain;">
                </div>
                ${specialPrizeHTML}
            `,
            icon: 'success',
            confirmButtonText: 'ตกลง',
            allowOutsideClick: false,
            timer: 15000,
            timerProgressBar: true,
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title'
            }
        }).then(() => {
            isSpinning = false;
            
            if (spinBtn) {
                spinBtn.disabled = false; 
            }
        });
    }, 8000); // ดีเลย์รับผลรวม 7 วินาที
}

// 6. --- รวม Firebase Listener ไว้จุดเดียวแบบ Single Source of Truth ป้องกันลูปค้าง ---
db.ref().on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const queueData = data.customerQueue || {};

    // แปลงโครงสร้างข้อมูลคิวจาก Firebase
    let rawQueue = [];
    if (typeof queueData === 'object' && !Array.isArray(queueData)) {
        rawQueue = Object.keys(queueData).map(key => {
            const item = queueData[key];
            return (typeof item === 'object' && item !== null && item.name) ? item.name : item;
        });
    } else {
        rawQueue = Array.isArray(queueData) ? queueData : [];
    }

    // 🎯 ตรรกะตรวจจับชื่อจริงซ้ำเฉพาะกิจ (ทำความสะอาดข้อมูลก่อนกระจายลงแอป)
    if (rawQueue && rawQueue.length > 0) {
        const seenFirstNames = new Set();
        const cleanedQueue = [];
        let hasDuplicate = false;

        rawQueue.forEach(fullName => {
            if (!fullName || typeof fullName !== 'string') return;
            const firstName = fullName.trim().split(' ')[0];

            if (!seenFirstNames.has(firstName)) {
                seenFirstNames.add(firstName);
                cleanedQueue.push(fullName); 
            } else {
                hasDuplicate = true; // ตรวจเจอตัวซ้ำ
            }
        });

        // หากข้อมูลไม่นิ่ง สั่งปรับ Firebase ให้คลีนทันที
        if (hasDuplicate) {
            console.log("⚠️ ตรวจพบชื่อจริงซ้ำในระบบ! กำลังทำการล้างคิวอัตโนมัติ...");
            db.ref('customerQueue').set(cleanedQueue);
            return; // เด้งออกเพื่อรอรับ Snap รอบที่คลีนเสร็จแล้ว
        }
    }

    // บันทึกสถานะลง Global Variables หลังกรองเสร็จสิ้น
    dbQueue = rawQueue;
    dbStock = data.currentStock || {};
    dbTotalSpins = data.totalSpins || 0;

    // อัปเดต UI หน้าจอทั้งหมดให้เสร็จสรรพ
    updatePlayerInterface();
});

// 7. Events
spinBtn.addEventListener('click', startSpin);

// --- การรองรับคีย์บอร์ด ---
window.addEventListener('keydown', function(e) {
    const isEnter = (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter');
    const isSpace = (e.code === 'Space');
    const isNumberKey = (e.key >= '0' && e.key <= '9');
    const specialKeys = ['.', '+', '-', '*', '/'];
    const isSpecialKey = specialKeys.includes(e.key);

    if (isEnter || isSpace || isNumberKey || isSpecialKey) {
        const swalConfirmBtn = Swal.getConfirmButton();
        if (Swal.isVisible() && swalConfirmBtn) {
            e.preventDefault();
            swalConfirmBtn.click(); 
            return; 
        }

        if (!isSpinning && spinBtn && !spinBtn.disabled) {
            e.preventDefault(); 
            spinBtn.classList.add('pulling');
            
            setTimeout(() => {
                spinBtn.classList.remove('pulling');
                startSpin(); 
            }, 200);
        }
    }
});
