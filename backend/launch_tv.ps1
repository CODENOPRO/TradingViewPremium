param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"
$CdpPort = if ($env:TERMINAL_CDP_PORT) { [int]$env:TERMINAL_CDP_PORT } else { 9222 }
$AppUserModelId = "TradingView.Desktop_n534cwy3pjxzj!TradingView.Desktop"
$TradingViewArguments = "--remote-debugging-port=$CdpPort --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"

if ($ForceRestart) {
    $running = @(Get-Process -Name "TradingView" -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Write-Host "[INFO] Closing running TradingView Desktop processes..."
        foreach ($p in $running) {
            try { [void]$p.CloseMainWindow() } catch {}
        }
        $deadline = (Get-Date).AddMilliseconds(1800)
        while ((Get-Date) -lt $deadline) {
            if (-not (Get-Process -Name "TradingView" -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Milliseconds 150
        }
        Stop-Process -Name "TradingView" -Force -ErrorAction SilentlyContinue
        $killDeadline = (Get-Date).AddSeconds(5)
        while ((Get-Date) -lt $killDeadline) {
            if (-not (Get-Process -Name "TradingView" -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Milliseconds 150
        }
        Start-Sleep -Milliseconds 400
    }
} else {
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:$CdpPort/json" -TimeoutSec 1 -ErrorAction Stop
        Write-Host "[OK] TradingView Desktop is already running with remote debugging on port $CdpPort."
        exit 0
    } catch {
        Write-Host "[INFO] Port $CdpPort is not open. Checking running processes..."
    }

    $tvProc = Get-Process -Name "TradingView" -ErrorAction SilentlyContinue
    if ($tvProc) {
        Write-Host "[ACTION NEEDED] TradingView is running without port $CdpPort. Close it normally, then run this launcher again."
        exit 1
    }
}

$signature = @"
using System;
using System.Runtime.InteropServices;
public class Launcher {
    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IApplicationActivationManager {
        [PreserveSig]
        int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, int options, out uint processId);
    }
    public static void Launch(string aumid, string args) {
        Type type = Type.GetTypeFromCLSID(new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C"));
        if (type == null) throw new InvalidOperationException("ActivationManager CLSID unavailable.");
        IApplicationActivationManager appManager = (IApplicationActivationManager)Activator.CreateInstance(type);
        uint pid;
        int hr = appManager.ActivateApplication(aumid, args, 0, out pid);
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
    }
}
"@

try {
    $launched = $false
    try {
        if (-not ("Launcher" -as [type])) {
            Add-Type -TypeDefinition $signature -ErrorAction Stop
        }
        $aumid = $AppUserModelId
        $pkg = Get-AppxPackage -Name "*TradingView*" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pkg) { $aumid = "$($pkg.PackageFamilyName)!TradingView.Desktop" }
        [Launcher]::Launch($aumid, $TradingViewArguments)
        $launched = $true
    } catch {
        foreach ($exe in @("$env:LOCALAPPDATA\Programs\TradingView\TradingView.exe", "$env:LOCALAPPDATA\TradingView\TradingView.exe", "$env:ProgramFiles\TradingView\TradingView.exe")) {
            if (Test-Path $exe) {
                Start-Process -FilePath $exe -ArgumentList $TradingViewArguments | Out-Null
                $launched = $true
                break
            }
        }
        if (-not $launched) { throw }
    }
    if ($ForceRestart) {
        $waitEnd = (Get-Date).AddSeconds(20)
        while ((Get-Date) -lt $waitEnd) {
            try {
                $targets = Invoke-RestMethod -Uri "http://localhost:$CdpPort/json/list" -TimeoutSec 1 -ErrorAction Stop
                if ($targets) {
                    Write-Host "[OK] Relaunched TradingView Desktop and CDP port $CdpPort is ready."
                    exit 0
                }
            } catch {}
            Start-Sleep -Milliseconds 400
        }
    }
    Write-Host "[OK] Launched TradingView Desktop with port $CdpPort."
    exit 0
} catch {
    Write-Host "[ERROR] Could not launch TradingView Desktop: $($_.Exception.Message)"
    exit 1
}
