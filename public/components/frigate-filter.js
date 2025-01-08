function log(message) {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] ${message}`);
}

function startupChecklist() {
    log("Starting pre-flight checklist...");

    setTimeout(() => {
        log("1. Check fuel levels");
        setTimeout(() => {
            log("2. Check oil levels");
            setTimeout(() => {
                log("3. Check tire pressure");
                setTimeout(() => {
                    log("4. Check control surfaces");
                    setTimeout(() => {
                        log("5. Check avionics");
                        setTimeout(() => {
                            log("6. Check lights and signals");
                            setTimeout(() => {
                                log("7. Check emergency equipment");
                                setTimeout(() => {
                                    log("8. Perform engine run-up");
                                    setTimeout(() => {
                                        log("9. Check flight instruments");
                                        setTimeout(() => {
                                            log("10. Final walk-around inspection");
                                            setTimeout(() => {
                                                log("Pre-flight checklist complete. Ready for takeoff!");
                                            }, 5000);
                                        }, 5000);
                                    }, 5000);
                                }, 5000);
                            }, 5000);
                        }, 5000);
                    }, 5000);
                }, 5000);
            }, 5000);
        }, 5000);
    }, 5000);
}

// Start the checklist
startupChecklist();