use std::sync::atomic::{AtomicBool, Ordering};

/// Global flag indicating key simulation is in progress.
/// When true, the keyboard listener should ignore events to avoid
/// feeding simulated events back into the pressed-keys display.
static SIMULATING: AtomicBool = AtomicBool::new(false);

pub fn set_simulating(value: bool) {
    SIMULATING.store(value, Ordering::SeqCst);
}

pub fn is_simulating() -> bool {
    SIMULATING.load(Ordering::SeqCst)
}
