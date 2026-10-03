package com.example.chayaonewaiter

import com.journeyapps.barcodescanner.CaptureActivity

/**
 * Custom ZXing CaptureActivity subclass locked to portrait orientation.
 * Ensures camera viewfinder and UI never flip into landscape mode.
 */
class PortraitCaptureActivity : CaptureActivity()
