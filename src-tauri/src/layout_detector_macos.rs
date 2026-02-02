#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
use core_foundation::string::{CFString, CFStringRef};
use core_foundation_sys::base::CFTypeRef;
use std::ffi::c_void;

#[link(name = "Carbon", kind = "framework")]
extern "C" {
    fn TISCopyCurrentKeyboardInputSource() -> CFTypeRef;
    fn TISGetInputSourceProperty(source: CFTypeRef, property_key: CFStringRef) -> *const c_void;
}

const K_TIS_PROPERTY_INPUT_SOURCE_ID: &str = "TISPropertyInputSourceID";

pub fn get_active_keyboard_layout() -> String {
    unsafe {
        let source = TISCopyCurrentKeyboardInputSource();
        if source.is_null() {
            return "unknown".to_string();
        }

        let property_key = CFString::new(K_TIS_PROPERTY_INPUT_SOURCE_ID);
        let layout_id_ptr = TISGetInputSourceProperty(source, property_key.as_concrete_TypeRef());

        if layout_id_ptr.is_null() {
            return "unknown".to_string();
        }

        let layout_id = CFString::wrap_under_get_rule(layout_id_ptr as CFStringRef);
        layout_id.to_string()
    }
}
