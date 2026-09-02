using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

internal static class WindowsDesktopHost
{
    private const int GwlStyle = -16;
    private const int GwlExStyle = -20;
    private const long WsChild = 0x40000000L;
    private const long WsExLayered = 0x00080000L;
    private const long WsExNoRedirectionBitmap = 0x00200000L;
    private const uint LwaAlpha = 0x00000002;
    private const uint SmtoNormal = 0x0000;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpFrameChanged = 0x0020;
    private const uint SwpShowWindow = 0x0040;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoSize = 0x0001;
    private static readonly IntPtr HwndBottom = new IntPtr(1);
    private const string OriginalStyleProperty = "GenrePoliceVisualizer.OriginalStyle";
    private const string OriginalExStyleProperty = "GenrePoliceVisualizer.OriginalExStyle";

    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SendMessageTimeout(
        IntPtr hwnd,
        uint message,
        IntPtr wParam,
        IntPtr lParam,
        uint flags,
        uint timeout,
        out IntPtr result);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetParent(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool IsWindow(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool ScreenToClient(IntPtr hwnd, ref Point point);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(
        IntPtr hwnd,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint colorKey, byte alpha, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SetProp(IntPtr hwnd, string name, IntPtr value);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr GetProp(IntPtr hwnd, string name);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr RemoveProp(IntPtr hwnd, string name);

    [DllImport("kernel32.dll")]
    private static extern void SetLastError(uint errorCode);

    private sealed class DesktopLayer
    {
        public IntPtr Progman;
        public IntPtr ShellParent;
        public IntPtr ShellView;
        public IntPtr WorkerW;
        public bool Raised;
    }

    private static string JsonEscape(string value)
    {
        return (value ?? string.Empty)
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

    private static void WriteResult(bool ok, string mode, string detail)
    {
        Console.WriteLine(
            "{\"ok\":" + (ok ? "true" : "false")
            + ",\"mode\":\"" + JsonEscape(mode) + "\""
            + ",\"detail\":\"" + JsonEscape(detail) + "\"}");
    }

    private static string WindowClass(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return string.Empty;
        StringBuilder name = new StringBuilder(128);
        return GetClassName(hwnd, name, name.Capacity) > 0 ? name.ToString() : string.Empty;
    }

    private static bool HasExtendedStyle(IntPtr hwnd, long style)
    {
        return (GetWindowLongPtr(hwnd, GwlExStyle).ToInt64() & style) == style;
    }

    private static DesktopLayer FindDesktopLayer()
    {
        DesktopLayer layer = new DesktopLayer();
        layer.Progman = FindWindow("Progman", null);
        if (layer.Progman == IntPtr.Zero) return layer;

        layer.Raised = HasExtendedStyle(layer.Progman, WsExNoRedirectionBitmap);
        IntPtr ignored;
        SendMessageTimeout(
            layer.Progman,
            0x052C,
            new IntPtr(0xD),
            new IntPtr(0x1),
            SmtoNormal,
            1000,
            out ignored);

        EnumWindows(delegate(IntPtr topWindow, IntPtr parameter)
        {
            IntPtr shellView = FindWindowEx(topWindow, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (shellView == IntPtr.Zero) return true;
            layer.ShellParent = topWindow;
            layer.ShellView = shellView;
            layer.WorkerW = FindWindowEx(IntPtr.Zero, topWindow, "WorkerW", null);
            return true;
        }, IntPtr.Zero);

        if (layer.Raised)
        {
            layer.ShellParent = layer.Progman;
            layer.ShellView = FindWindowEx(layer.Progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            layer.WorkerW = FindWindowEx(layer.Progman, IntPtr.Zero, "WorkerW", null);
        }
        return layer;
    }

    private static bool TrySetParent(IntPtr hwnd, IntPtr parent, out int error)
    {
        SetLastError(0);
        IntPtr previous = SetParent(hwnd, parent);
        error = Marshal.GetLastWin32Error();
        return previous != IntPtr.Zero || error == 0;
    }

    private static void PreserveWindowStyles(IntPtr hwnd)
    {
        if (GetProp(hwnd, OriginalStyleProperty) == IntPtr.Zero)
            SetProp(hwnd, OriginalStyleProperty, GetWindowLongPtr(hwnd, GwlStyle));
        if (GetProp(hwnd, OriginalExStyleProperty) == IntPtr.Zero)
            SetProp(hwnd, OriginalExStyleProperty, GetWindowLongPtr(hwnd, GwlExStyle));
    }

    private static bool Attach(IntPtr hwnd)
    {
        DesktopLayer layer = FindDesktopLayer();
        if (layer.Progman == IntPtr.Zero)
        {
            WriteResult(false, "detached", "Progman was not found");
            return false;
        }

        IntPtr expectedParent = layer.ShellParent;
        if (expectedParent == IntPtr.Zero)
        {
            WriteResult(false, "detached", "The desktop wallpaper host was not found");
            return false;
        }

        Rect rect;
        if (!GetWindowRect(hwnd, out rect))
        {
            WriteResult(false, "detached", new Win32Exception(Marshal.GetLastWin32Error()).Message);
            return false;
        }

        PreserveWindowStyles(hwnd);
        long style = GetWindowLongPtr(hwnd, GwlStyle).ToInt64() | WsChild;
        long exStyle = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64() | WsExLayered;
        SetWindowLongPtr(hwnd, GwlStyle, new IntPtr(style));
        SetWindowLongPtr(hwnd, GwlExStyle, new IntPtr(exStyle));
        SetLayeredWindowAttributes(hwnd, 0, 255, LwaAlpha);

        int parentError;
        if (GetParent(hwnd) != expectedParent && !TrySetParent(hwnd, expectedParent, out parentError))
        {
            WriteResult(false, "detached", new Win32Exception(parentError).Message);
            return false;
        }

        Point origin = new Point { X = rect.Left, Y = rect.Top };
        if (!ScreenToClient(expectedParent, ref origin))
        {
            origin.X = rect.Left;
            origin.Y = rect.Top;
        }
        SetWindowPos(
            hwnd,
            IntPtr.Zero,
            origin.X,
            origin.Y,
            rect.Right - rect.Left,
            rect.Bottom - rect.Top,
            SwpNoActivate | SwpFrameChanged | SwpShowWindow);

        if (layer.Raised && layer.WorkerW != IntPtr.Zero)
        {
            SetWindowPos(
                layer.WorkerW,
                HwndBottom,
                0,
                0,
                0,
                0,
                SwpNoMove | SwpNoSize | SwpNoActivate);
        }

        WriteResult(true, "attached", layer.Raised ? "raised-desktop-interactive" : "desktop-icons-interactive");
        return true;
    }

    private static bool Detach(IntPtr hwnd)
    {
        Rect rect;
        if (!GetWindowRect(hwnd, out rect))
        {
            WriteResult(false, "attached", new Win32Exception(Marshal.GetLastWin32Error()).Message);
            return false;
        }

        int parentError;
        if (GetParent(hwnd) != IntPtr.Zero && !TrySetParent(hwnd, IntPtr.Zero, out parentError))
        {
            WriteResult(false, "attached", new Win32Exception(parentError).Message);
            return false;
        }

        IntPtr originalStyle = GetProp(hwnd, OriginalStyleProperty);
        IntPtr originalExStyle = GetProp(hwnd, OriginalExStyleProperty);
        if (originalStyle != IntPtr.Zero) SetWindowLongPtr(hwnd, GwlStyle, originalStyle);
        if (originalExStyle != IntPtr.Zero) SetWindowLongPtr(hwnd, GwlExStyle, originalExStyle);
        RemoveProp(hwnd, OriginalStyleProperty);
        RemoveProp(hwnd, OriginalExStyleProperty);

        SetWindowPos(
            hwnd,
            IntPtr.Zero,
            rect.Left,
            rect.Top,
            rect.Right - rect.Left,
            rect.Bottom - rect.Top,
            SwpNoActivate | SwpFrameChanged | SwpShowWindow);
        WriteResult(true, "detached", "desktop-parent");
        return true;
    }

    private static bool Status(IntPtr hwnd)
    {
        IntPtr parent = GetParent(hwnd);
        string parentClass = WindowClass(parent);
        bool attached = parentClass == "Progman" || parentClass == "WorkerW";
        WriteResult(true, attached ? "attached" : "detached", parentClass);
        return true;
    }

    public static int Main(string[] args)
    {
        if (args.Length != 2)
        {
            WriteResult(false, "detached", "Usage: windows-desktop-host <attach|detach|status> <window-handle>");
            return 2;
        }

        long rawHandle;
        if (!long.TryParse(args[1], out rawHandle))
        {
            WriteResult(false, "detached", "Invalid window handle");
            return 2;
        }

        IntPtr hwnd = new IntPtr(rawHandle);
        if (!IsWindow(hwnd))
        {
            WriteResult(false, "detached", "The window handle is no longer valid");
            return 3;
        }

        try
        {
            if (string.Equals(args[0], "attach", StringComparison.OrdinalIgnoreCase))
                return Attach(hwnd) ? 0 : 1;
            if (string.Equals(args[0], "detach", StringComparison.OrdinalIgnoreCase))
                return Detach(hwnd) ? 0 : 1;
            if (string.Equals(args[0], "status", StringComparison.OrdinalIgnoreCase))
                return Status(hwnd) ? 0 : 1;
            WriteResult(false, "detached", "Unknown command");
            return 2;
        }
        catch (Exception error)
        {
            WriteResult(false, "detached", error.Message);
            return 1;
        }
    }
}
