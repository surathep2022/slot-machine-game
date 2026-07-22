/**
 * Admin.js - Firebase Version (Dual-Round Support - Synced UI Version)
 */

// 1. --- Configuration & Global Variables ---
const prizes = [  

    { name: "ร่มตอนเดียว", image: "1.png" },   
    { name: "แก้วเก็บความเย็น", image: "2.png" }, 
    { name: "หมอนรองคอ", image: "3.png" },
    { name: "แก้วชงชากาแฟ", image: "4.png" },
    { name: "กระเป๋าช้อปปิ้ง", image: "5.png" },
    { name: "กระบอกน้ำ", image: "6.png" },
    { name: "ชุดถนอมอาหาร", image: "7.png" },
    { name: "กระบอกแก้ว", image: "8.png" },
    { name: "กล่องผ้าเก็บของ", image: "9.png" },
    { name: "ถุงผ้าเก็บของ", image: "10.png" }, 
    { name: "แก้วน้ำปาร์ตี้", image: "11.png" }, 
    { name: "เครื่องเตรียมอาหาร", image: "12.png" },
    { name: "เครื่องดูดฝุ่น", image: "13.png" },
    { name: "เครื่องปั้นน้ำผลไม้", image: "14.png" },
    { name: "เครื่องผลไม้ปั่น", image: "15.png" },    
];

let currentPage = 1;
const rowsPerPage = 10;
let historyPageInitialized = false;

// ตัวแปรเก็บข้อมูลหลักจาก Firebase
let dbQueue = [];
let dbStock = {};
let dbTotalSpins = 0;
let dbHistory = [];
let dbNextQueue = {}; // เก็บข้อมูลคิวรอบถัดไป

// 2. --- Initialization UI ---
/**
 * วาด Grid สำหรับกรอกข้อมูลทั้ง 2 ฝั่ง
 */
function initConfigUI(currentStock, nextQueue) {
    const currentGrid = document.getElementById('config-grid-current');
    const nextGrid = document.getElementById('config-grid-next');

    if (!currentGrid || !nextGrid) return;

    // 🔵 วาด Grid ฝั่งรอบปัจจุบัน (Lock เมื่อมีการเล่น)
    currentGrid.innerHTML = prizes.map(prize => `
        <div class="prize-input-group">
            <label>${prize.name}</label>
            <input type="number" class="stock-input current-input" data-name="${prize.name}" 
                   value="${currentStock[prize.name] || 0}" oninput="calculateTotal('current')">
        </div>
    `).join('');

    // 🟠 วาด Grid ฝั่งรอบถัดไป (แก้ไขได้อิสระ)
    nextGrid.innerHTML = prizes.map(prize => `
        <div class="prize-input-group">
            <label>${prize.name}</label>
            <input type="number" class="stock-input next-input" data-name="${prize.name}" 
                   value="${nextQueue[prize.name] || 0}" oninput="calculateTotal('next')">
        </div>
    `).join('');

    calculateTotal('current');
    calculateTotal('next');
}

// 3. --- Calculation Logic ---
function calculateTotal(type) {
    const selector = type === 'current' ? '.current-input' : '.next-input';
    const totalLabel = type === 'current' ? 'total-check-current' : 'total-check-next';
    
    let total = 0;
    document.querySelectorAll(selector).forEach(input => {
        total += parseInt(input.value) || 0;
    });

    const display = document.getElementById(totalLabel);
    if (display) {
        display.innerText = `รวม: ${total} / 100`;
        display.style.color = total === 100 ? '#2ecc71' : '#e74c3c';
    }
    return total;
}

// 4. --- Firebase Operations ---

/**
 * บันทึกสต็อก (isQueue = true คือรอบถัดไป, false คือรีเซ็ตรอบปัจจุบัน)
 */
function saveStock(isQueue) {
    const type = isQueue ? 'next' : 'current';
    const total = calculateTotal(type);

    if (total !== 100) {
        Swal.fire('Error', 'ยอดรวมของรางวัลต้องครบ 100 ชิ้น', 'error');
        return;
    }

    const selector = isQueue ? '.next-input' : '.current-input';
    const newStock = {};
    document.querySelectorAll(selector).forEach(input => {
        newStock[input.getAttribute('data-name')] = parseInt(input.value);
    });

    const updateData = {};
    if (isQueue) {
        updateData['nextRoundQueue'] = newStock;
    } else {
        // Warning ก่อนรีเซ็ตรอบปัจจุบัน
        Swal.fire({
            title: 'ยืนยันรีเซ็ตรอบปัจจุบัน?',
            text: "ข้อมูลสต็อกเดิมจะถูกลบและเริ่มนับ 1 ใหม่ทันที!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                updateData['currentStock'] = newStock;
                updateData['prizeStock'] = newStock;
                updateData['totalSpins'] = 0;
                db.ref().update(updateData).then(() => {
                    Swal.fire('สำเร็จ', 'รีเซ็ตรอบปัจจุบันเรียบร้อย', 'success');
                });
            }
        });
        return; 
    }

    db.ref().update(updateData).then(() => {
        Swal.fire('สำเร็จ', 'บันทึกคิวรอบถัดไปแล้ว', 'success');
    });
}

// 5. --- Dashboard & UI Management ---
function updateDashboard() {
    const stockTotal = Object.values(dbStock).reduce((sum, value) => sum + (parseInt(value) || 0), 0);

    // อัปเดต Stats
    document.getElementById('count-display').textContent = `${dbTotalSpins} / ${stockTotal}`;
    
    let totalLeft = 0;
    const invGrid = document.getElementById('inventory-grid');
    if (invGrid) {
        invGrid.style.display = "grid";
        invGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
        invGrid.style.gap = "14px";
        invGrid.style.marginBottom = "16px";
        
        invGrid.innerHTML = '';
        prizes.forEach(prize => {
            const count = dbStock[prize.name] || 0;
            totalLeft += count;
            
            invGrid.innerHTML += `
                <div class="inventory-card">
                    <img src="${prize.image}" alt="${prize.name}">
                    <span>${prize.name}</span>
                    <label class="inventory-label">จำนวน</label>
                    <input type="number" min="0" class="inventory-stock-input" data-name="${prize.name}" value="${count}">
                </div>
            `;
        });
    }
    document.getElementById('total-left-display').textContent = totalLeft;
   // อัปเดตจำนวนคงเหลือของผู้สนับสนุน (Lactasoy 20 / Lush 40 / Dewberry 40)
   
    const stockLush = document.getElementById('stock-lush');
    const stockLactasoy = document.getElementById('stock-lactasoy');
    const stockDewberry = document.getElementById('stock-dewberry')


    // ตรรกะคำนวณจำนวนที่แจกไปแล้วแบบเฉลี่ยสลับตามรอบ (dbTotalSpins)
    let lactasoyGiven = 0;
    let lushGiven = 0;
    let dewberryGiven = 0;

    // คำนวณหาว่าในจำนวนการหมุนปัจจุบัน (dbTotalSpins) ได้จ่ายอะไรไปแล้วบ้าง
    for (let i = 0; i < dbTotalSpins; i++) {
        let roundIndex = i % 100;
        // ใช้ตรรกะสลับเศษเดียวกันกับหน้าวงล้อเพื่อหักสต็อกให้ตรงกันเป๊ะ
        if (roundIndex % 5 === 0) {
            lactasoyGiven++;
        } else if (roundIndex % 2 === 1) {
            lushGiven++;
        } else {
            dewberryGiven++;
        }
    }

    // จำกัดขีดจำกัดสูงสุดเพื่อความปลอดภัยไม่ให้ค่าติดลบ
    lactasoyGiven = Math.min(20, lactasoyGiven);
    lushGiven = Math.min(60, lushGiven);
    dewberryGiven = Math.min(20, dewberryGiven);

    // อัปเดตตัวเลขแสดงผลบนหน้าจอ Admin Dashboard
    if (stockLactasoy) stockLactasoy.textContent = 20 - lactasoyGiven;
    if (stockLush) stockLush.textContent = 60 - lushGiven;
    if (stockDewberry) stockDewberry.textContent = 20 - dewberryGiven;

    // อัปเดตคิวลูกค้า
    const queueDiv = document.getElementById('current-queue-list');
    if (queueDiv) {
        // 🎯 ดึงชื่อที่ซ้ำกันออกให้เหลือแค่ชื่อเดียวทันทีตามที่คุณตั้งค่าไว้
        const uniqueQueue = [...new Set(dbQueue)];

        queueDiv.innerHTML = uniqueQueue.length > 0 ? uniqueQueue.map((n, i) => 
            `<span class="queue-badge ${i === 0 ? 'active' : ''}">${i === 0 ? '▶ ' : ''}${n}</span>`
        ).join('') : `<p>ยังไม่มีลูกค้าในคิว</p>`;
    }

    renderHistoryTable(dbHistory);
}


// เก็บข้อมูลลำดับรางวัลที่เลือกไว้สำหรับ 100 ครั้ง
let selectedOrders = {};
let currentActiveSlot = null;

function getPrizeByName(prizeName) {
    return prizes.find(prize => prize.name === prizeName) || null;
}

function getSelectedCounts(excludeSlot = null) {
    const counts = {};
    Object.entries(selectedOrders).forEach(([slot, prize]) => {
        if (!prize || !prize.name) return;
        if (excludeSlot !== null && String(excludeSlot) === String(slot)) return;
        counts[prize.name] = (counts[prize.name] || 0) + 1;
    });
    return counts;
}

function getAvailableStock(prizeName, excludeSlot = null) {
    const selectedCounts = getSelectedCounts(excludeSlot);
    const totalStock = dbStock[prizeName] || 0;
    return Math.max(totalStock - (selectedCounts[prizeName] || 0), 0);
}

function renderOrderGrid() {
    const container = document.getElementById('order-grid');
    if (!container) return;

    container.innerHTML = '';
    const completedCount = Math.min(Math.max(parseInt(dbTotalSpins) || 0, 0), 100);

    for (let slotNumber = 1; slotNumber <= 100; slotNumber++) {
        const box = document.createElement('div');
        const isCompleted = slotNumber <= completedCount;
        box.className = `grid-box${isCompleted ? ' completed' : ''}`;
        box.id = `box-${slotNumber}`;
        box.onclick = () => openModal(slotNumber);

        const numberLabel = document.createElement('span');
        numberLabel.className = 'box-number';
        numberLabel.textContent = slotNumber;
        box.appendChild(numberLabel);

        const prize = selectedOrders[slotNumber];
        if (prize) {
            const img = document.createElement('img');
            img.src = prize.image;
            img.alt = prize.name;
            img.className = 'box-image';
            img.onerror = () => { img.src = 'https://via.placeholder.com/60?text=Image'; };
            box.appendChild(img);

            const nameLabel = document.createElement('span');
            nameLabel.className = 'box-prize-name';
            nameLabel.textContent = prize.name;
            box.appendChild(nameLabel);

            box.style.borderStyle = 'solid';
            box.style.backgroundColor = '#ffffff';
        } else {
            box.style.borderStyle = 'dashed';
            box.style.backgroundColor = '#f1f3f5';
        }

        container.appendChild(box);
    }
}

function openModal(slotNumber) {
    currentActiveSlot = slotNumber;
    document.getElementById('modalTitle').textContent = `เลือกของรางวัลสำหรับลำดับที่ ${slotNumber}`;

    const pickerContainer = document.getElementById('prizePicker');
    pickerContainer.innerHTML = '';

    prizes.forEach((prize) => {
        const remaining = getAvailableStock(prize.name, currentActiveSlot);
        const isDisabled = remaining === 0 && !(selectedOrders[currentActiveSlot] && selectedOrders[currentActiveSlot].name === prize.name);

        const card = document.createElement('div');
        card.className = 'prize-card';
        if (isDisabled) {
            card.style.opacity = '0.45';
            card.style.cursor = 'not-allowed';
        } else {
            card.onclick = () => selectPrizeForSlot(prize);
        }

        card.innerHTML = `
          <img src="${prize.image}" alt="${prize.name}" onerror="this.src='https://via.placeholder.com/60?text=No+Img'">
          <span>${prize.name}</span>
          <span class="prize-remaining" style="font-size:0.8rem; color:#7f8c8d; margin-top:6px; display:block;">${remaining > 0 ? `เหลือ ${remaining}` : 'หมดแล้ว'}</span>
        `;
        pickerContainer.appendChild(card);
    });

    document.getElementById('prizeModal').classList.add('active');
}

function closeModal() {
    document.getElementById('prizeModal').classList.remove('active');
    currentActiveSlot = null;
}

function selectPrizeForSlot(prize) {
    if (!currentActiveSlot) return;

    const available = getAvailableStock(prize.name, currentActiveSlot);
    if (available <= 0 && !(selectedOrders[currentActiveSlot] && selectedOrders[currentActiveSlot].name === prize.name)) {
        Swal.fire('หมดแล้ว', `ของรางวัล ${prize.name} ไม่มีเหลือให้เลือกในตอนนี้`, 'error');
        return;
    }

    selectedOrders[currentActiveSlot] = prize;
    renderOrderGrid();
    closeModal();
}

function clearSelectedSlot() {
    if (!currentActiveSlot) return;

    delete selectedOrders[currentActiveSlot];
    renderOrderGrid();
    closeModal();
}

function saveInventoryStock() {
    const stockUpdates = {};
    document.querySelectorAll('.inventory-stock-input').forEach(input => {
        const prizeName = input.getAttribute('data-name');
        const value = Math.max(0, parseInt(input.value) || 0);
        stockUpdates[prizeName] = value;
    });

    db.ref().update({
        currentStock: stockUpdates,
        prizeStock: stockUpdates
    }).then(() => {
        dbStock = { ...dbStock, ...stockUpdates };
        updateDashboard();
        Swal.fire('สำเร็จ', 'บันทึกจำนวนสต็อกเรียบร้อยแล้ว', 'success');
    }).catch(() => {
        Swal.fire('ผิดพลาด', 'บันทึกสต็อกไม่สำเร็จ', 'error');
    });
}

function savePrizeOrder() {
    const selectedCounts = getSelectedCounts();
    const invalidPrizes = Object.keys(selectedCounts).filter(prizeName => selectedCounts[prizeName] > (dbStock[prizeName] || 0));
    if (invalidPrizes.length > 0) {
        Swal.fire('ไม่สามารถบันทึก', `เลือกของรางวัลเกินสต็อกจริงสำหรับ: ${invalidPrizes.join(', ')}`, 'error');
        return;
    }

    const payload = {};
    Object.entries(selectedOrders).forEach(([slot, prize]) => {
        if (prize && prize.name) payload[slot] = prize.name;
    });

    db.ref().update({ prizeOrder: payload }).then(() => {
        Swal.fire('สำเร็จ', `บันทึกลำดับรางวัลเรียบร้อยแล้ว (${Object.keys(payload).length} ช่อง)`, 'success');
    });
}

function clearAllOrders() {
    Object.keys(selectedOrders).forEach(key => delete selectedOrders[key]);
    renderOrderGrid();
    savePrizeOrder();
}

function loadPrizeOrderFromFirebase(orderData) {
    Object.keys(selectedOrders).forEach(key => delete selectedOrders[key]);

    const normalized = orderData || {};
    Object.entries(normalized).forEach(([slot, prizeName]) => {
        const prize = getPrizeByName(prizeName);
        if (prize) {
            selectedOrders[slot] = prize;
        }
    });

    renderOrderGrid();
}

function initGrid() {
    renderOrderGrid();
}

initGrid();



function updateStatusTags(nextQueue) {
    const nextStatus = document.getElementById('next-status');
    const summaryBody = document.getElementById('next-summary-body');
    const summaryTotalDisplay = document.getElementById('next-summary-total');
    
    if (!nextStatus || !summaryBody || !summaryTotalDisplay) return;

    // 1. คำนวณยอดรวมในคิวจากข้อมูล Firebase
    let totalInQueue = 0;
    
    // 2. วาดข้อมูลลงในตารางสรุป (แสดงข้อมูลปกติเสมอ)
    summaryBody.innerHTML = prizes.map(prize => {
        const count = parseInt(nextQueue[prize.name]) || 0;
        totalInQueue += count;
        return `
            <tr>
                <td>${prize.name}</td>
                <td style="text-align: right;"><b>${count}</b> ชิ้น</td>
            </tr>
        `;
    }).join('');

    // 3. แสดงยอดรวมด้านล่างตาราง
    summaryTotalDisplay.innerText = `${totalInQueue} / 100`;
    summaryTotalDisplay.style.color = (totalInQueue === 100) ? '#2ecc71' : '#e74c3c';

    // 4. อัปเดตป้ายสถานะ (Tag) ด้านบน
    if (totalInQueue === 100) {
        nextStatus.innerText = "Ready ✅";
        nextStatus.className = "status-tag running"; 
    } else {
        nextStatus.innerText = "Pending ⏳";
        nextStatus.className = "status-tag pending";
    }
}

async function addCustomer() {
    const { value: name } = await Swal.fire({
           title: 'ลงทะเบียนลูกค้า',
            input: 'text',
            inputLabel: 'ชื่อลูกค้า (สำหรับหมุนรางวัลครั้งถัดไป)',
            inputPlaceholder: 'กรอกชื่อลูกค้า...',
            showCancelButton: true,
            confirmButtonColor: '#3498db',
            customClass: {
                container: 'my-swal-font',
                input: 'my-swal-input-font',
                confirmButton: 'my-swal-font',
                cancelButton: 'my-swal-font'
            }
    });

    if (name) {
        // ✨ บันทึกโครงสร้างแบบ Object ไปที่ Firebase 
        db.ref('customerQueue').push({
            name: name,
            status: "waiting",        
            timestamp: Date.now()      
        }).then(() => {
            Swal.fire('สำเร็จ', `คุณ ${name} เข้าคิวเรียบร้อย`, 'success');
        });
    }
}

function renderHistoryTable(data) {
    const tableBody = document.getElementById('history-table-body');
    const paginationDiv = document.getElementById('pagination-controls');
    if (!tableBody || !paginationDiv) return;

    const totalPages = Math.ceil(data.length / rowsPerPage) || 1;
    if (!historyPageInitialized) {
        currentPage = totalPages;
        historyPageInitialized = true;
    }
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * rowsPerPage;
    const sortedData = [...data].sort((a, b) => {
        const ta = parseInt(a.timestamp) || 0;
        const tb = parseInt(b.timestamp) || 0;
        return ta - tb;
    });
    const paginatedData = sortedData.slice(start, start + rowsPerPage);

    tableBody.innerHTML = paginatedData.length ? paginatedData.map((item, i) => {
        const prizeInfo = prizes.find(p => p.name === item.prize);
        const prizeDisplay = prizeInfo ?
            `<span class="prize-badge"><img src="${prizeInfo.image}" alt="${item.prize}" style="width:24px; height:24px; vertical-align:middle; margin-right:8px;">${item.prize}</span>` :
            `<span class="prize-badge">${item.prize}</span>`;

        return `
        <tr>
            <td>${start + i + 1}</td>
            <td><b>${item.customer}</b></td>
            <td>${prizeDisplay}</td>
            <td>${item.specialPrize || '-'}</td>
            <td style="font-family: monospace;">${item.time}</td>
        </tr>
    `;
    }).join('') : `<tr><td colspan="5" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>`;

    let html = `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="${currentPage === i ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
    paginationDiv.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    updateDashboard();
}

function exportToExcel() {
    if (!dbHistory.length) return Swal.fire('ไม่มีข้อมูล', '', 'info');
    const worksheet = XLSX.utils.json_to_sheet(dbHistory.map((item, i) => ({
        "ลำดับ": i + 1,
        "ชื่อลูกค้า": item.customer,
        "รางวัล": item.prize,
        "รางวัลพิเศษ": item.specialPrize || '-',
        "เวลา": item.time
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Winners");
    XLSX.writeFile(workbook, `รายชื่อผู้โชคดี_Firebase.xlsx`);
}

function resetSystem() {
     Swal.fire({
                title: '⚠️ ยืนยันการล้างข้อมูลทั้งงาน?',
                html: `
                    <div style="text-align: left; background: #fff5f5; padding: 15px; border-radius: 10px; border: 1px solid #feb2b2; margin-bottom: 15px;">
                        <p style="color: #c53030; font-weight: bold; margin: 0;">คำเตือน:</p>
                        <ul style="color: #742a2a; font-size: 0.9rem; padding-left: 20px; margin-top: 5px;">
                            <li>ข้อมูลการรับรางวัลทั้งหมดจะถูกลบถาวร</li>
                            <li>รายชื่อลูกค้าในคิวจะหายไปทั้งหมด</li>
                            <li>Stock การสุ่มของรางวัลจะถูกรีเซ็ต</li>
                            <li>ปุ่มนี้ควรกดเมื่อจบงานวันสุดท้าย</li>
                        </ul>
                    </div>
                    <p style="font-weight: bold;">กรุณาใส่รหัสผ่านเพื่อยืนยัน:</p>
                `,
                input: 'password',
                inputPlaceholder: 'กรอกรหัสผ่านผู้ดูแลระบบ',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ยืนยันการลบทั้งหมด',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#7f8c8d',
                customClass: {
                    confirmButton: 'swal-font-setup',
                    cancelButton: 'swal-font-setup',
                    title: 'swal-font-setup',
                    htmlContainer: 'swal-font-setup',
                    input: 'swal-font-setup'
                }
        }).then((result) => {
        if (result.value === "admin1234") {
            db.ref().set({
                customerQueue: {},
                currentStock: {},
                nextRoundQueue: {},
                prizeHistory: {},
                totalSpins: 0,
                prizeOrder: {}
            }).then(() => {
                Swal.fire('ล้างข้อมูลเรียบร้อย', '', 'success').then(() => location.reload());
            });
        } else if (result.isConfirmed) {
            Swal.fire('รหัสผ่านไม่ถูกต้อง', '', 'error');
        }
    });
}

// 6. --- รวมศูนย์ Firebase Real-time Listener (Single Source of Truth) ---
db.ref().on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const queueData = data.customerQueue || {};

    // 🔄 ดึงและแปลงโครงสร้างคิวจากฐานข้อมูล ไม่ว่าจะมาเป็นแบบ Array หรือแบบ Push Key Object
    if (Array.isArray(queueData)) {
        dbQueue = queueData.map(item => {
            if (typeof item === 'object' && item !== null && item.name) return item.name;
            return typeof item === 'string' ? item : "ไม่ระบุชื่อ";
        });
    } else if (typeof queueData === 'object' && queueData !== null) {
        dbQueue = Object.keys(queueData).map(key => {
            const item = queueData[key];
            if (typeof item === 'object' && item !== null && item.name) return item.name;
            return typeof item === 'string' ? item : "ไม่ระบุชื่อ";
        });
    } else {
        dbQueue = [];
    }

    // ดึงข้อมูลหลักส่วนอื่นๆ เก็บเข้าสู่ Global States
    dbStock = data.currentStock || {};
    dbTotalSpins = parseInt(data.totalSpins || 0);
    dbNextQueue = data.nextRoundQueue || {};
    
    const historyObj = data.prizeHistory || {};
    dbHistory = Object.keys(historyObj).map(key => historyObj[key]);

    loadPrizeOrderFromFirebase(data.prizeOrder || {});

    // วาดกล่อง Input ตั้งค่าเริ่มต้น (วาดครั้งเดียวเพื่อป้องกันหน้าจอกระตุกตอนกำลังพิมพ์)
    if (!document.querySelector('.current-input')) {
        initConfigUI(dbStock, dbNextQueue);
    }

    // สั่งรันชุดแสดงผลทั้งหมดให้ทำงานสัมพันธ์กันสดๆ แบบ Real-time
    updateDashboard();
    updateStatusTags(dbNextQueue);
    renderOrderGrid();
});