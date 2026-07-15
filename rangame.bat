@echo off
title Running Lucky Wheel Project with Ngrok...
echo [SUCCESS] Starting HTTP Server and Ngrok...

:: 1. สั่งรัน http-server แยกออกไปอีกหน้าต่างหนึ่ง (ใช้ Port 8080)
start "HTTP Server Backend" cmd /k "http-server -p 8080"

:: 2. สั่งรัน ngrok แยกออกไปอีกหน้าต่างหนึ่ง เพื่อสร้างลิงก์ออนไลน์ทันที
start "Ngrok Online Tunnel" cmd /k "ngrok http 8080"

:: 3. เปิดเบราว์เซอร์ Chrome เพื่อเช็กหน้าเว็บในเครื่องตัวเองตามปกติ
start chrome http://localhost:8080

echo ---------------------------------------------------
echo  [READY] ระบบกำลังเริ่มทำงาน...
echo  - หน้าต่างดำที่ 1: กำลังรัน Server จำลองในเครื่อง
echo  - หน้าต่างดำที่ 2: กำลังสร้างลิงก์ออนไลน์ (Ngrok)
echo    * ให้คุณก๊อปปี้ลิงก์ "https" จากหน้าต่างที่ 2 ไปเปิดในมือถือได้เลยครับ
echo ---------------------------------------------------
pause