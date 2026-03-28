use tauri::{Runtime, WebviewWindow};

macro_rules! badge_debug {
    ($($t:tt)*) => {
        if cfg!(debug_assertions) {
            eprintln!($($t)*);
        }
    };
}

#[tauri::command]
pub fn set_taskbar_badge(
    window: WebviewWindow<impl Runtime>,
    unread: u32,
) -> Result<(), String> {
    badge_debug!("[badge] set_taskbar_badge called: unread={unread}");
    if unread == 0 {
        clear_badge(&window)?;
    } else {
        set_badge(&window, unread)?;
    }
    Ok(())
}

// ── Windows implementation ──────────────────────────────────────────────────

#[cfg(windows)]
fn set_badge(window: &WebviewWindow<impl Runtime>, unread: u32) -> Result<(), String> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, CreateFontW,
        DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
        BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS,
        CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_QUALITY, FF_SWISS, FW_BOLD,
        OUT_DEFAULT_PRECIS, BI_RGB,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
    use windows::Win32::UI::Shell::ITaskbarList3;
    use windows::Win32::UI::WindowsAndMessaging::{CreateIconIndirect, DestroyIcon, ICONINFO};
    use windows::core::GUID;

    // Larger canvas so the overlay badge stays readable after taskbar scaling
    const ICON_SIZE: i32 = 48;
    const CLSID_TASKBAR_LIST: GUID = GUID::from_u128(0x56fdf344_fd6d_11d0_958a_006097c9a090);

    let hwnd = get_hwnd(window)?;

    unsafe {
        let hdc_screen = GetDC(None);
        let hdc = CreateCompatibleDC(Some(hdc_screen));

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: ICON_SIZE,
                biHeight: -ICON_SIZE,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                ..std::mem::zeroed()
            },
            ..std::mem::zeroed()
        };
        let mut bits: *mut std::ffi::c_void = std::ptr::null_mut();
        let hbm = CreateDIBSection(Some(hdc), &bmi, DIB_RGB_COLORS, &mut bits, None, 0)
            .map_err(|e| format!("CreateDIBSection: {e}"))?;

        let old_bmp = SelectObject(hdc, hbm.into());

        // Clear to transparent
        let pixel_count = (ICON_SIZE * ICON_SIZE) as usize;
        let pixels = bits as *mut u32;
        for i in 0..pixel_count {
            *pixels.add(i) = 0x00000000;
        }

        // Font — large enough to read inside the circle after OS scales overlay
        let font_size = 22;
        let hfont = CreateFontW(
            -font_size, 0, 0, 0,
            FW_BOLD.0 as i32, 0, 0, 0,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            DEFAULT_QUALITY, FF_SWISS.0 as u32,
            windows::core::w!("Segoe UI"),
        );
        let old_font = SelectObject(hdc, hfont.into());

        // Single circle at top-right (scaled for ICON_SIZE 48)
        let cx = 36;
        let cy = 12;
        let r = 11;
        draw_circle_with_text(hdc, cx, cy, r, unread, 0x000080FF);

        SelectObject(hdc, old_font);
        SelectObject(hdc, old_bmp);
        let _ = DeleteObject(hfont.into());

        // Fix alpha channel
        for i in 0..pixel_count {
            let px = *pixels.add(i);
            if px & 0x00FFFFFF != 0 {
                *pixels.add(i) = px | 0xFF000000;
            }
        }

        // Mask bitmap
        let hbm_mask = CreateDIBSection(Some(hdc), &bmi, DIB_RGB_COLORS, &mut bits, None, 0)
            .map_err(|e| format!("CreateDIBSection mask: {e}"))?;
        let mask_pixels = bits as *mut u32;
        for i in 0..pixel_count {
            *mask_pixels.add(i) = 0x00000000;
        }

        let mut icon_info = ICONINFO {
            fIcon: true.into(),
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: hbm_mask,
            hbmColor: hbm,
        };
        let hicon = CreateIconIndirect(&mut icon_info).map_err(|e| format!("CreateIconIndirect: {e}"))?;

        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
        );

        let taskbar: ITaskbarList3 = CoCreateInstance(&CLSID_TASKBAR_LIST, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("CoCreateInstance TaskbarList: {e}"))?;
        taskbar.HrInit().map_err(|e| format!("HrInit: {e}"))?;
        taskbar
            .SetOverlayIcon(hwnd, hicon, windows::core::w!(""))
            .map_err(|e| format!("SetOverlayIcon: {e}"))?;
        badge_debug!("[badge] SetOverlayIcon succeeded");

        let _ = DestroyIcon(hicon);
        let _ = DeleteObject(hbm.into());
        let _ = DeleteObject(hbm_mask.into());
        let _ = DeleteDC(hdc);
        let _ = ReleaseDC(None, hdc_screen);
    }

    Ok(())
}

#[cfg(windows)]
fn clear_badge(window: &WebviewWindow<impl Runtime>) -> Result<(), String> {
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
    use windows::Win32::UI::Shell::ITaskbarList3;
    use windows::Win32::UI::WindowsAndMessaging::HICON;
    use windows::core::GUID;

    const CLSID_TASKBAR_LIST: GUID = GUID::from_u128(0x56fdf344_fd6d_11d0_958a_006097c9a090);

    let hwnd = get_hwnd(window)?;

    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
        );

        let taskbar: ITaskbarList3 = CoCreateInstance(&CLSID_TASKBAR_LIST, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("CoCreateInstance TaskbarList: {e}"))?;
        taskbar.HrInit().map_err(|e| format!("HrInit: {e}"))?;
        taskbar
            .SetOverlayIcon(hwnd, HICON::default(), windows::core::w!(""))
            .map_err(|e| format!("SetOverlayIcon: {e}"))?;
    }

    Ok(())
}

#[cfg(windows)]
fn get_hwnd(window: &WebviewWindow<impl Runtime>) -> Result<windows::Win32::Foundation::HWND, String> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows::Win32::Foundation::HWND;
    let handle = window
        .window_handle()
        .map_err(|e| format!("window_handle: {e}"))?;
    badge_debug!("[badge] raw window handle type: {:?}", handle.as_raw());
    match handle.as_raw() {
        RawWindowHandle::Win32(h) => {
            let hwnd = HWND(h.hwnd.get() as _);
            badge_debug!("[badge] HWND: {:?}", hwnd);
            Ok(hwnd)
        }
        other => Err(format!("Not a Win32 window, got: {:?}", other)),
    }
}

#[cfg(windows)]
unsafe fn draw_circle_with_text(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    cx: i32, cy: i32, r: i32,
    num: u32,
    color: u32,
) {
    use windows::Win32::Foundation::COLORREF;
    use windows::Win32::Graphics::Gdi::{
        CreateSolidBrush, DeleteObject, Ellipse, SelectObject,
        SetBkMode, SetTextColor, TRANSPARENT,
    };

    let brush = CreateSolidBrush(COLORREF(color));
    let old_brush = SelectObject(hdc, brush.into());
    let _ = Ellipse(hdc, cx - r, cy - r, cx + r, cy + r);
    SelectObject(hdc, old_brush);
    let _ = DeleteObject(brush.into());

    let wide: Vec<u16> = num.to_string().encode_utf16().collect();
    let _ = SetBkMode(hdc, TRANSPARENT);
    let _ = SetTextColor(hdc, COLORREF(0x00FFFFFF));

    let mut tm = std::mem::zeroed::<windows::Win32::Graphics::Gdi::TEXTMETRICW>();
    let _ = windows::Win32::Graphics::Gdi::GetTextMetricsW(hdc, &mut tm);
    let mut size = windows::Win32::Foundation::SIZE::default();
    let _ = windows::Win32::Graphics::Gdi::GetTextExtentPoint32W(hdc, &wide, &mut size);
    let tx = cx - size.cx / 2;
    let ty = cy - tm.tmHeight / 2;
    let _ = windows::Win32::Graphics::Gdi::TextOutW(hdc, tx, ty, &wide);
}

// ── macOS implementation ────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn set_badge(_window: &WebviewWindow<impl Runtime>, unread: u32) -> Result<(), String> {
    use objc::{msg_send, sel, sel_impl};
    use objc::runtime::Object;
    use objc::class;

    unsafe {
        let app: *mut Object = msg_send![class!(NSApplication), sharedApplication];
        let dock_tile: *mut Object = msg_send![app, dockTile];

        let label = std::ffi::CString::new(unread.to_string())
            .map_err(|e| e.to_string())?;
        let nsstring: *mut Object = msg_send![class!(NSString), alloc];
        let nsstring: *mut Object = msg_send![nsstring,
            initWithUTF8String:label.as_ptr()
        ];
        let _: () = msg_send![dock_tile, setBadgeLabel: nsstring];
        let _: () = msg_send![nsstring, release];
        let _: () = msg_send![dock_tile, display];
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn clear_badge(_window: &WebviewWindow<impl Runtime>) -> Result<(), String> {
    use objc::{msg_send, sel, sel_impl};
    use objc::runtime::Object;
    use objc::class;

    unsafe {
        let app: *mut Object = msg_send![class!(NSApplication), sharedApplication];
        let dock_tile: *mut Object = msg_send![app, dockTile];
        let empty: *mut Object = msg_send![class!(NSString), string];
        let _: () = msg_send![dock_tile, setBadgeLabel: empty];
        let _: () = msg_send![dock_tile, display];
    }

    Ok(())
}

// ── Linux fallback (no-op) ─────────────────────────────────────────────────

#[cfg(not(any(windows, target_os = "macos")))]
fn set_badge(_window: &WebviewWindow<impl Runtime>, _unread: u32) -> Result<(), String> {
    Ok(())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn clear_badge(_window: &WebviewWindow<impl Runtime>) -> Result<(), String> {
    Ok(())
}
