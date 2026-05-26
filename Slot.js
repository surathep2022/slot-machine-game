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
let lastWonPrizeName = "";

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
        // 🛠️ ซ่อมสไตล์แอตทริบิวต์ style="" ให้ถูกต้องเพื่อให้ภาพแสดงผลเต็มตา
        div.innerHTML = `
            <img src="${item.image}" style="object-fit: contain; display: block;">
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
    
    const pattern = getBasePattern(); 
    pattern.forEach(item => {
        slotContainer.appendChild(createItemElement(item));
    });
    
    slotContainer.style.transform = `translateY(0px)`;
}
// เรียกใช้งานทันทีเมื่อโหลดไฟล์
initSlotDisplay();

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
function updateQueueListUI() {
    const queueDiv = document.getElementById('current-queue-list');
    if (!queueDiv) return;

    const uniqueQueue = [...new Set(dbQueue)];

    queueDiv.innerHTML = uniqueQueue.length > 0 ? uniqueQueue.map((n, i) => {
        const formattedName = formatDisplayName(n);
        return `<span class="queue-badge ${i === 0 ? 'active' : ''}">${i === 0 ? '▶ ' : ''}${formattedName}</span>`;
    }).join('') : `<p>ยังไม่มีลูกค้าในคิว</p>`;
}

function updatePlayerInterface() {
    if (!btn) return;
    const display = document.getElementById('current-player-display');
    const nameSpan = document.getElementById('player-name');

    const uniqueQueue = [...new Set(dbQueue)];

    if (uniqueQueue && uniqueQueue.length > 0) {
        if (display) display.style.display = 'block';
        
        const formattedName = formatDisplayName(uniqueQueue[0]);
        if (nameSpan) nameSpan.textContent = formattedName;
        
        // 🎯 เช็คให้ชัวร์ว่าถ้าสล็อตไม่ได้กำลังหมุนอยู่ ต้องปล่อยให้ปุ่ม disabled เป็น false เสมอ
        btn.disabled = isSpinning; 
    } else {
        if (display) display.style.display = 'none';
        btn.disabled = true;
    }
}

// 4. ฟังก์ชันบันทึกข้อมูลไป Firebase
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
}

// 5. ฟังก์ชันหลักในการหมุน
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

    // 🎯 🚩 [ปรับปรุงจุดที่ 1: ตรรกะสุ่มแบบไม่ซ้ำชิ้นเดิมกับตาที่แล้ว]
    let targetIdx = -1;
    let winPrize = null;
    let attempts = 0; 

    while (attempts < 10) {
        const randomIndex = Math.floor(Math.random() * availablePrizes.length);
        targetIdx = availablePrizes[randomIndex];
        winPrize = prizes[targetIdx];

        // ตรวจเช็คประเภทของรางวัลที่เหลืออยู่ในสต็อกทั้งหมด
        const uniquePrizesLeft = [...new Set(availablePrizes.map(idx => prizes[idx].name))];
        
        // เงื่อนไข: ถ้าสุ่มได้ชื่อไม่ซ้ำกับรอบที่แล้ว (lastWonPrizeName) หรือเหลือของในคลังแค่ประเภทเดียวแล้ว ให้ผ่านได้เลย
        if (winPrize.name !== lastWonPrizeName || uniquePrizesLeft.length === 1) {
            break;
        }
        attempts++;
    }

    // บันทึกชื่อรางวัลนี้ไว้ เช็คกับคิวคนถัดไป
    lastWonPrizeName = winPrize.name; 

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
    slotContainer.innerHTML = '';
    slotContainer.style.transition = 'none';
    slotContainer.style.transform = 'translateY(0px)';

    for (let i = 0; i <= fakeItemsCount + 5; i++) {
        const item = document.createElement('div');
        item.className = 'slot-item';
        
        if (i === 2) { 
            item.innerHTML = `<div class="ready-box">READY</div>`;
        } else if (i === fakeItemsCount) {
            const img = document.createElement('img');
            img.src = winPrize.image;
            img.style.cssText = "object-fit: contain; display: block;";
            item.appendChild(img);
        } else {
            const rand = prizes[i % prizes.length];
            const img = document.createElement('img');
            img.src = rand.image;
            img.style.cssText = "opacity: 0.8; object-fit: contain; display: block;";
            item.appendChild(img);
        }
        slotContainer.appendChild(item);
    }

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

        let specialPrizeHTML = '';
        if (dbTotalSpins % 2 === 0) {
            specialPrizeHTML = `
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <p style="margin: 0 0 10px 0; color: #34495e; font-weight: bold; font-size: 1.2rem;">✨ รับเพิ่ม! รางวัลพิเศษ ✨</p>
                    <img src="lactasoy.png" style="width:300px; height:300px; object-fit:contain;">
                </div>
            `;
        } else {
            specialPrizeHTML = `
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <p style="margin: 0 0 10px 0; color: #34495e; font-weight: bold; font-size: 1.2rem;">✨ รับเพิ่ม! รางวัลพิเศษ ✨</p>
                    <img src="hartbeat.png" style="width:300px; height:300px; object-fit:contain;">
                </div>
            `;
        }

        Swal.fire({
            title: `ยินดีด้วย คุณ ${formatDisplayName(currentCustomer)}!`,
            html: `
                ได้รับ: <b style="color:#e74c3c; font-size: 2rem;">${winPrize.name}</b>
                <div style="margin-top:15px; background:#f9f9f9; padding:20px; border-radius:15px; border: 2px solid #f1c40f;">
                    <img src="${winPrize.image}" style="width:300px; height:300px; object-fit:contain;">
                </div>
                ${specialPrizeHTML}
            `,
            icon: 'success',
            confirmButtonText: 'ตกลง',
            allowOutsideClick: false,
            timer: 15000,              // ⏳ ปิดหน้าต่างอัตโนมัติใน 15 วินาที
            timerProgressBar: true     // แสดงแถบเวลาวิ่งด้านล่าง
        }).then(() => {
            // สั่งตัดคิวคนแรกออกบน Firebase หลังกดตกลง หรือหมดเวลา
            if (dbQueue && dbQueue.length > 0) {
                let updatedQueue = [...dbQueue];
                updatedQueue.shift(); 
                db.ref('customerQueue').set(updatedQueue);
            }
            
            isSpinning = false;
            
            // 🎯 🚩 [แก้ไขปัญหาคนที่ 2 กดไม่ได้]: สั่งคืนสถานะปุ่มกายภาพเป็นเปิดใช้งานทันที
            if (btn) {
                btn.disabled = false; 
            }
            
            slotContainer.style.transition = 'none'; 
            slotContainer.style.transform = 'translateY(0px)'; 
            
            initSlotDisplay(); 
            updatePlayerInterface(); // อัปเดตหน้าจอเพื่อเปลี่ยนชื่อคิวถัดไปให้พร้อมทำงาน
        });
    }, 5500);
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
    updateQueueListUI();
    
    if (typeof updateSlotUI === 'function') {
        updateSlotUI();
    }
});

// 7. Events
btn.addEventListener('click', startSpin);

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
    if(isSpinning) return; // ไม่สร้างเพิ่มระหว่างหมุนสล็อตเพื่อลดอาการกระตุกของหน้าจอ
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

    setTimeout(() => { ball.remove(); }, duration * 1000);
}
setInterval(createFloatingBubble, 2000);