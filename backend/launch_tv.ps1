$AppUserModelId = "TradingView.Desktop_n534cwy3pjxzj!TradingView.Desktop"
$TradingViewArguments = "--remote-debugging-port=9222 --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"

# Check if port 9222 is already open
try {
    $response = Invoke-RestMethod -Uri "http://localhost:9222/json" -TimeoutSec 1 -ErrorAction Stop
    Write-Host "[OK] TradingView Desktop is already running with remote debugging on port 9222."
    exit 0
} catch {
    Write-Host "[INFO] Port 9222 is not open. Checking running processes..."
}

# Never force-close an existing chart workspace.
$tvProc = Get-Process -Name "TradingView" -ErrorAction SilentlyContinue
if ($tvProc) {
    Write-Host "[ACTION NEEDED] TradingView is running without port 9222. Close it normally, then run this launcher again."
    exit 1
}

$signature = @"
using System;
using System.Runtime.InteropServices;
public class Launcher {
    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IApplicationActivationManager {
        int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, int options, out uint processId);
    }
    public static void Launch(string aumid, string args) {
        Type type = Type.GetTypeFromCLSID(new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C"));
        IApplicationActivationManager appManager = (IApplicationActivationManager)Activator.CreateInstance(type);
        uint pid;
        appManager.ActivateApplication(aumid, args, 0, out pid);
    }
}
"@

Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue
[Launcher]::Launch($AppUserModelId, $TradingViewArguments)
Write-Host "[OK] Launched TradingView Desktop with port 9222."
