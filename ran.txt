@echo off
title Running Lucky Wheel Project...
echo [SUCCESS] Starting HTTP Server and Opening Chrome...

:: สั่งเปิดหน้าเว็บ Chrome ล่วงหน้าตาม URL มาตรฐานของ http-server
start chrome http://localhost:8080

:: สั่งรัน http-server ในโฟลเดอร์นี้ทันที
http-server -p 8080