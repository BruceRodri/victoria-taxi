# Run from PowerShell to host the two-device demo on your current Wi-Fi.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$adapter = Get-NetAdapter -Physical |
    Where-Object { $_.Status -eq "Up" -and ($_.Name -match "Wi-Fi|WLAN" -or $_.InterfaceDescription -match "Wireless|Wi-Fi|802.11") } |
    Select-Object -First 1
if (!$adapter) { throw "Conecta la PC a Wi-Fi antes de iniciar la prueba." }
$address = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
if (!$address) { throw "La interfaz Wi-Fi no tiene una dirección IPv4." }
$env:VT_WIFI_IP = $address.IPAddress
$env:VT_PORT = "5191"
node (Join-Path $root 'server/wifi.mjs')
