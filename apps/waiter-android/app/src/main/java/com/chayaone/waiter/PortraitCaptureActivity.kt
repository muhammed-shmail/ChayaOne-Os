package com.chayaone.waiter

import com.journeyapps.barcodescanner.CaptureActivity

/**
 * Custom ZXing CaptureActivity subclass locked to portrait orientation.
 * Ensures camera viewfinder and UI never flip into landscape mode on handhelds and tablets.
 */
class PortraitCaptureActivity : CaptureActivity()
