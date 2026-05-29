/**
 * Admin.js - Firebase Version (Dual-Round Support - Synced UI Version)
 */

// 1. --- Configuration & Global Variables ---
const prizeNames = ["หมอนรองคอ","กระบอกน้ำ","ชุดถนอมอาหาร","แก้วน้ำปาร์ตี้","แก้วชงชากาแฟ","ถุงผ้าเก็บของ"];

let currentPage = 1;
const rowsPerPage = 10;

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
    currentGrid.innerHTML = prizeNames.map(name => `
        <div class="prize-input-group">
            <label>${name}</label>
            <input type="number" class="stock-input current-input" data-name="${name}" 
                   value="${currentStock[name] || 0}" oninput="calculateTotal('current')">
        </div>
    `).join('');

    // 🟠 วาด Grid ฝั่งรอบถัดไป (แก้ไขได้อิสระ)
    nextGrid.innerHTML = prizeNames.map(name => `
        <div class="prize-input-group">
            <label>${name}</label>
            <input type="number" class="stock-input next-input" data-name="${name}" 
                   value="${nextQueue[name] || 0}" oninput="calculateTotal('next')">
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
    const currentInputs = document.querySelectorAll('.current-input');
    const resetBtn = document.querySelector('.btn-reset');
    
    // ล็อคสต็อกรอบปัจจุบันหากกำลังมีการเล่น
    const isPlaying = dbTotalSpins > 0 && dbTotalSpins < 100;

    if (isPlaying) {
        if(resetBtn) {
            resetBtn.disabled = true;
            resetBtn.style.background = "#95a5a6";
            resetBtn.innerHTML = `🔒 กำลังเล่น (${dbTotalSpins}/100)`;
        }
        currentInputs.forEach(input => input.disabled = true);
    } else {
        if(resetBtn) {
            resetBtn.disabled = false;
            resetBtn.style.background = "#3498db";
            resetBtn.innerHTML = "🔄 รีเซ็ตรอบปัจจุบันใหม่";
        }
        currentInputs.forEach(input => input.disabled = false);
    }

    // ฝั่งรอบถัดไปต้องไม่โดนล็อคเสมอ
    document.querySelectorAll('.next-input').forEach(input => input.disabled = false);

    // อัปเดต Stats
    document.getElementById('count-display').textContent = `${dbTotalSpins} / 100`;
    
    let totalLeft = 0;
    const invGrid = document.getElementById('inventory-grid');
    if (invGrid) {
        invGrid.innerHTML = '';
        prizeNames.forEach(name => {
            const count = dbStock[name] || 0;
            totalLeft += count;
            invGrid.innerHTML += `<div class="inventory-card"><span>${name}</span><b>${count}</b></div>`;
        });
    }
    document.getElementById('total-left-display').textContent = totalLeft;

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

function updateStatusTags(nextQueue) {
    const nextStatus = document.getElementById('next-status');
    const summaryBody = document.getElementById('next-summary-body');
    const summaryTotalDisplay = document.getElementById('next-summary-total');
    
    if (!nextStatus || !summaryBody || !summaryTotalDisplay) return;

    // 1. คำนวณยอดรวมในคิวจากข้อมูล Firebase
    let totalInQueue = 0;
    
    // 2. วาดข้อมูลลงในตารางสรุป (แสดงข้อมูลปกติเสมอ)
    summaryBody.innerHTML = prizeNames.map(name => {
        const count = parseInt(nextQueue[name]) || 0;
        totalInQueue += count;
        return `
            <tr>
                <td>${name}</td>
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
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * rowsPerPage;
    const reversedData = [...data].reverse(); 
    const paginatedData = reversedData.slice(start, start + rowsPerPage);

    tableBody.innerHTML = paginatedData.length ? paginatedData.map((item, i) => `
        <tr>
            <td>${data.length - (start + i)}</td>
            <td><b>${item.customer}</b></td>
            <td><span class="prize-badge">${item.prize}</span></td>
            <td style="font-family: monospace;">${item.time}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>`;

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
        "ลำดับ": i + 1, "ชื่อลูกค้า": item.customer, "รางวัล": item.prize, "เวลา": item.time
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
                totalSpins: 0
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

    // วาดกล่อง Input ตั้งค่าเริ่มต้น (วาดครั้งเดียวเพื่อป้องกันหน้าจอกระตุกตอนกำลังพิมพ์)
    if (!document.querySelector('.current-input')) {
        initConfigUI(dbStock, dbNextQueue);
    }

    // สั่งรันชุดแสดงผลทั้งหมดให้ทำงานสัมพันธ์กันสดๆ แบบ Real-time
    updateDashboard();
    updateStatusTags(dbNextQueue);
});