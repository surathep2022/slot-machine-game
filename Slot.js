/**
 * Slot.js - Firebase Realtime Database Version (Fixed Stop Position Version)
 */

// 1. Global Variables
let isSpinning = false;
const itemHeight = 240; // ล็อกความสูงช่องให้ตรงกับ CSS
const fakeItemsCount = 60;

const slotContainer = document.getElementById('slot-container');
const btn = document.getElementById('spin-btn');

const prizes = [   
    { name: "ผ้ากันเปื้อน", image: "1.png" },
    { name: "หมอนรองคอ", image: "2.png" },
    { name: "กระเป๋าช้อปปิ้ง", image: "3.png" }, 
    { name: "กระบอกน้ำ", image: "4.png" },    
    { name: "ชุดถนอมอาหาร", image: "5.png" },    
    { name: "กระบอกแก้ว", image: "6.png" },
    { name: "กล่องผ้าเก็บของ", image: "7.png" },    
    { name: "แก้วน้ำปาร์ตี้", image: "8.png" },
    { name: "แก้วเก็บความเย็น", image: "9.png" }
];

// --- ตัวแปรสำหรับเก็บข้อมูลจาก Firebase (Global State) ---  
let dbQueue = [];
let dbStock = {};
let dbTotalSpins = 0;

// ฟังก์ชันสร้าง Pattern 6 ช่อง (5 สินค้า + 1 READY ที่ตำแหน่ง index 2)
function getBasePattern() {
    return [
        prizes[8], 
        prizes[1], 
        { name: "READY", isReady: true }, // ช่องที่ 3 (Index 2)
        prizes[2], 
        prizes[3], 
        prizes[7]
    ];
}

/**
 * สร้าง HTML Element สำหรับแต่ละช่อง
 */
function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'slot-item';
    if (item.isReady) {
        div.innerHTML = `<div class="ready-box">READY</div>`;
    } else {
        // ดึงสไตล์ความสูง/กว้างออกไปคุมผ่าน CSS class (.slot-item img) เพื่อสเกลภาพให้ใหญ่เต็มตา
        div.innerHTML = `
            <img src="${item.image}" object-fit: contain; display: block;">
        `;
    }
    return div;
}

/**
 * แสดงผลหน้าตู้สล็อตตอนเริ่มต้น (READY อยู่ตรงกลาง)
 */
function initSlotDisplay() {
    if (!slotContainer) return;
    slotContainer.innerHTML = '';
    slotContainer.style.transition = 'none';
    
    const pattern = getBasePattern(); // ในนี้มี READY อยู่ที่ Index 2 แล้ว
    pattern.forEach(item => {
        slotContainer.appendChild(createItemElement(item));
    });
    
    // 🔄 ปรับจาก -400px เป็น 0px เพื่อให้สอดคล้องกับจุดเริ่มต้นการคำนวณพิกเซลที่แม่นยำ
    slotContainer.style.transform = `translateY(0px)`;
}
// เรียกใช้งานทันทีเมื่อโหลดไฟล์
initSlotDisplay();

// 3. --- Firebase Logic & Interface ---

function updatePlayerInterface() {
    if (!btn) return;
    const display = document.getElementById('current-player-display');
    const nameSpan = document.getElementById('player-name');

    if (dbQueue && dbQueue.length > 0) {
        if (display) display.style.display = 'block';
        if (nameSpan) nameSpan.textContent = dbQueue[0];
        btn.disabled = isSpinning;
    } else {
        if (display) display.style.display = 'none';
        btn.disabled = true;
    }
}

// 3. ฟังก์ชันบันทึกข้อมูลไป Firebase
function saveResultToFirebase(customerName, prizeName) {
    // A. บันทึกประวัติผู้ชนะ
    db.ref('prizeHistory').push({
        customer: customerName,
        prize: prizeName,
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

    // D. ตัดชื่อออกจากคิวใน Firebase
    // let updatedQueue = [...dbQueue];
    // updatedQueue.shift();
    // db.ref('customerQueue').set(updatedQueue);
}

// 4. ฟังก์ชันหลักในการหมุน
async function startSpin() {
    if (isSpinning) return;

    // 1. --- ตรวจสอบคิวลูกค้า ---
    if (dbQueue.length === 0) {
        Swal.fire('คิวว่าง', 'กรุณาเพิ่มชื่อลูกค้าในหน้า Admin', 'info');
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
                icon: 'warning'
            });
        }
        return; 
    }

    // --- เริ่มกระบวนการหมุนปกติ (ถ้ายังไม่ครบ 100) ---
    const currentCustomer = dbQueue[0];

    // --- ตรรกะการสุ่มรางวัลตาม Stock จาก Firebase ---
    let availablePrizes = [];
    prizes.forEach((prize, index) => {
        let count = dbStock[prize.name] || 0;
        for (let i = 0; i < count; i++) { availablePrizes.push(index); }
    });

    if (availablePrizes.length === 0) {
        Swal.fire('ของหมด', 'ของรางวัลในสต็อกหมดแล้ว', 'warning');
        return;
    }

    const randomIndex = Math.floor(Math.random() * availablePrizes.length);
    const targetIdx = availablePrizes[randomIndex];
    const winPrize = prizes[targetIdx];

    // --- เริ่มสถานะหมุน ---
    isSpinning = true;
    btn.disabled = true;

    // เล่นเสียง
    const spinAudio = document.getElementById('spin-audio');
    if (spinAudio) {
        spinAudio.currentTime = 0;
        spinAudio.play().catch(e => console.log("Audio failed:", e));
    }

    // --- บันทึกข้อมูลลง Firebase ทันทีที่รู้ผล ---
    saveResultToFirebase(currentCustomer, winPrize.name);

    // --- อนิเมชั่นหน้าตู้ ---

    // 1. ล้างข้อมูลเก่าก่อนหมุนรอบใหม่
    slotContainer.innerHTML = '';
    slotContainer.style.transition = 'none';
    slotContainer.style.transform = 'translateY(0px)'; // 🔄 เริ่มหมุนจากพิกเซล 0 เสมอเพื่อให้สอดคล้องกับแอนิเมชัน

    // 2. สร้างรูปเรียงต่อกันหลอกๆ
    for (let i = 0; i <= fakeItemsCount + 5; i++) {
        const item = document.createElement('div');
        item.className = 'slot-item';
        
        if (i === 2) { 
            // ช่องที่ 3 (Index 2) คือตำแหน่งที่ตรงกับเส้นแดงตอนเริ่มต้น
            item.innerHTML = `<div class="ready-box">READY</div>`;
        } else if (i === fakeItemsCount) {
            // 🎯 รูปรางวัลจริงที่สุ่มได้จะถูกใส่ไว้ตรงตำแหน่งพิกเซลที่ล็อกเป้าหมายไว้พอดี
            const img = document.createElement('img');
            img.src = winPrize.image;
            item.appendChild(img);
        } else {
            // 🎲 รูปสุ่มอื่นๆ สำหรับวิ่งผ่านตา
            const rand = prizes[i % prizes.length];
            const img = document.createElement('img');
            img.src = rand.image;
            img.style.opacity = "0.8";
            item.appendChild(img);
        }
        slotContainer.appendChild(item);
    }

    // 🚩 [สูตรแก้ไขตัวพิกเซลเพี้ยน]:
    // คำนวณจุดหยุด: (จำนวนช่องหลอกที่วิ่งมา * ความสูงช่อง 240px) - ระยะเยื้องของเส้นแดงจากขอบบนหน้าต่างตู้สล็อต (480px)
    const centerHighlightTop = 480; 
    const stopPosition = (fakeItemsCount * itemHeight) - centerHighlightTop;

    setTimeout(() => {
        slotContainer.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.1, 1)';
        slotContainer.style.transform = `translateY(-${stopPosition}px)`;
    }, 50);

    // --- แสดงผลเมื่อหยุดหมุน ---
    setTimeout(() => {
        if (spinAudio) spinAudio.pause();
        const winAudio = document.getElementById('win-audio');
        if (winAudio) {
            winAudio.currentTime = 0;
            winAudio.play().catch(e => console.log("Win audio failed:", e));
        }

        // 🔄 1. สร้างตัวแปรเก็บโครงสร้าง HTML ของรูปรางวัลพิเศษแบบสลับกัน
        let specialPrizeHTML = '';
        
        if (dbTotalSpins % 2 === 0) {
            // ถ้ารอบสะสมหารสองลงตัว (เลขคู่) ให้แสดง แลคตาซอย
            specialPrizeHTML = `
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <p style="margin: 0 0 10px 0; color: #34495e; font-weight: bold; font-size: 1.2rem;">✨ รับเพิ่ม! รางวัลพิเศษ ✨</p>
                    <img src="lactasoy.png" style="width:300px; height:300px; object-fit:contain;">
                </div>
            `;
        } else {
            // ถ้ารอบสะสมหารสองไม่ลงตัว (เลขคี่) ให้แสดง ฮาร์ทบีท
            specialPrizeHTML = `
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <p style="margin: 0 0 10px 0; color: #34495e; font-weight: bold; font-size: 1.2rem;">✨ รับเพิ่ม! รางวัลพิเศษ ✨</p>
                    <img src="hartbeat.png" style="width:300px; height:300px; object-fit:contain;">
                </div>
            `;
        }

        // 2. เรียกใช้งานใน Swal.fire ปกติ
        Swal.fire({
            title: `ยินดีด้วย คุณ ${currentCustomer}!`,
            html: `
                ได้รับ: <b style="color:#e74c3c; font-size: 2rem;">${winPrize.name}</b>
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <img src="${winPrize.image}" style="width:300px; height:300px; object-fit:contain;">
                </div>
                
                ${specialPrizeHTML}
            `,
            icon: 'success',
            confirmButtonText: 'ตกลง',
            allowOutsideClick: false
        }).then(() => {

            // 🎯 🔥 [จุดสำคัญ] สั่งตัดชื่อคนแรกออกจากคิวบน Firebase หลังจากกดปุ่ม OK ตรงนี้!
            if (dbQueue && dbQueue.length > 0) {
                let updatedQueue = [...dbQueue];
                updatedQueue.shift(); // ลบคนแรกที่เพิ่งเล่นเสร็จออก
                
                // อัปเดตคิวใหม่กลับไปที่ Firebase (เมื่อ Firebase อัปเดต คิวถัดไปจะขึ้นโชว์ทันที)
                db.ref('customerQueue').set(updatedQueue);
            }
            
            isSpinning = false;
            slotContainer.style.transition = 'none'; 
            
            // รีเซ็ตการขยับสล็อตกลับมาที่จุดเริ่มต้นสมดุลเพื่อรอผู้เล่นคิวถัดไป
            slotContainer.style.transform = 'translateY(0px)'; 
            
            initSlotDisplay(); 
            updatePlayerInterface();
        });
    }, 5500);
}

// 5. Firebase Listeners (ดึงข้อมูลแบบ Real-time)
db.ref('customerQueue').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    if (typeof data === 'object' && !Array.isArray(data)) {
        dbQueue = Object.keys(data).map(key => data[key].name);
    } else {
        dbQueue = data;
    }
    updatePlayerInterface();
});

db.ref('currentStock').on('value', (snapshot) => {
    dbStock = snapshot.val() || {};
});

db.ref('totalSpins').on('value', (snapshot) => {
    dbTotalSpins = parseInt(snapshot.val() || 0);
});

// 6. Events
btn.addEventListener('click', startSpin);

// --- การรองรับคีย์บอร์ด (Enter, Spacebar, ตัวเลข 1-9 และสัญลักษณ์) ---
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

        if (!isSpinning && btn && !btn.disabled) {
            e.preventDefault(); 
            btn.classList.add('pulling');
            
            setTimeout(() => {
                btn.classList.remove('pulling');
                startSpin(); 
            }, 200);
        }
    }
});

// --- ฟังก์ชันลูกบอลพื้นหลังลอย ---
function createFloatingBubble() {
    const ball = document.createElement('div');
    ball.className = 'ball';
    
    const randomImg = prizes[Math.floor(Math.random() * prizes.length)].image;
    ball.innerHTML = `<img src="${randomImg}">`;

    ball.style.left = Math.random() * 90 + '%';
    
    const size = Math.random() * (250 - 150) + 150;
    ball.style.width = size + 'px';
    ball.style.height = size + 'px';

    const duration = Math.random() * (12 - 6) + 6;
    ball.style.animationDuration = duration + 's';

    document.body.appendChild(ball);

    setTimeout(() => {
        ball.remove();
    }, duration * 1000);
}

setInterval(createFloatingBubble, 2000);

// --- รับฟังอัปเดตหลักเพื่อซิงค์ข้อมูลลง UI รวม ---
db.ref().on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const queueData = data.customerQueue || {};

    dbQueue = Object.keys(queueData).map(key => {
        const item = queueData[key];
        if (typeof item === 'object' && item !== null && item.name) {
            return item.name;
        }
        return typeof item === 'string' ? item : "ไม่ระบุชื่อ";
    });

    dbStock = data.currentStock || {};
    dbTotalSpins = data.totalSpins || 0;

    if (typeof updateSlotUI === 'function') {
        updateSlotUI();
    }
});