package com.chayaone.waiter

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.chayaone.waiter.theme.*
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL

// Native Javascript Bridge exposed to POS / Waiter web app
class AndroidBridge(
    private val activity: Activity,
    private val onOpenSettings: () -> Unit,
    private val onScanQr: () -> Unit,
    private val onClearCache: () -> Unit,
    private val serverIp: String,
    private val serverPort: String
) {
    @JavascriptInterface
    fun openSettings() {
        activity.runOnUiThread { onOpenSettings() }
    }

    @JavascriptInterface
    fun scanQrCode() {
        activity.runOnUiThread { onScanQr() }
    }

    @JavascriptInterface
    fun getServerIp(): String = serverIp

    @JavascriptInterface
    fun getServerPort(): String = serverPort

    @JavascriptInterface
    fun clearAppCache() {
        activity.runOnUiThread { onClearCache() }
    }
}

data class ParsedServerUrl(
    val ip: String,
    val port: String,
    val path: String = "/pos",
    val user: String = ""
)

fun parseServerQr(raw: String): ParsedServerUrl {
    var ip = ""
    var port = "3000"
    var path = "/pos"
    var user = ""
    try {
        val trimmed = raw.trim()
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            val json = JSONObject(trimmed)
            ip = json.optString("ip", json.optString("server", ""))
            port = json.optString("port", "3000")
            path = json.optString("path", "/pos")
            user = json.optString("user", "")
        } else if (trimmed.contains("://") || trimmed.contains("?")) {
            val uri = Uri.parse(trimmed)
            val qIp = uri.getQueryParameter("ip") ?: uri.getQueryParameter("server") ?: uri.host
            val qPort = uri.getQueryParameter("port") ?: (if (uri.port > 0) uri.port.toString() else null)
            val qUser = uri.getQueryParameter("user")
            val qPath = uri.getQueryParameter("path") ?: uri.path

            if (!qIp.isNullOrBlank()) ip = qIp
            if (!qPort.isNullOrBlank()) port = qPort
            if (!qUser.isNullOrBlank()) user = qUser
            if (!qPath.isNullOrBlank() && qPath != "/") path = qPath
        } else if (trimmed.contains(":")) {
            val parts = trimmed.split(":")
            if (parts.isNotEmpty()) ip = parts[0].trim()
            if (parts.size > 1) {
                val portPart = parts[1].trim().split("/")[0]
                port = portPart
            }
        } else if (trimmed.isNotBlank()) {
            ip = trimmed
        }
    } catch (_: Exception) {
    }
    return ParsedServerUrl(ip, port, path, user)
}

class MainActivity : ComponentActivity() {

    private lateinit var prefs: SharedPreferences
    private var webView: WebView? = null

    companion object {
        const val PREFS_NAME = "chayaone_waiter_prefs"
        const val KEY_SERVER_IP = "server_ip"
        const val KEY_SERVER_PORT = "server_port"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_KEEP_AWAKE = "keep_awake"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        handleIncomingUri(intent?.data)

        val keepAwake = prefs.getBoolean(KEY_KEEP_AWAKE, true)
        if (keepAwake) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        setContent {
            ChayaOneWaiterTheme {
                WaiterAppRoot(
                    activity = this,
                    prefs = prefs,
                    onKeepAwakeChanged = { awake ->
                        prefs.edit().putBoolean(KEY_KEEP_AWAKE, awake).apply()
                        if (awake) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        }
                    },
                    onRegisterWebView = { wv ->
                        webView = wv
                    }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingUri(intent.data)
    }

    private fun handleIncomingUri(uri: Uri?) {
        if (uri == null) return
        val parsed = parseServerQr(uri.toString())
        if (parsed.ip.isNotBlank()) {
            prefs.edit()
                .putString(KEY_SERVER_IP, parsed.ip)
                .putString(KEY_SERVER_PORT, parsed.port)
                .putString(KEY_SERVER_URL, "http://${parsed.ip}:${parsed.port}${if (parsed.port == "3002") "/tables" else "/pos"}")
                .apply()
        }
    }

    override fun onDestroy() {
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}

enum class ScreenState {
    CONNECTING,
    SETUP,
    WEBVIEW,
    ERROR
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WaiterAppRoot(
    activity: Activity,
    prefs: SharedPreferences,
    onKeepAwakeChanged: (Boolean) -> Unit,
    onRegisterWebView: (WebView) -> Unit
) {
    val context = LocalContext.current
    var screenState by remember { mutableStateOf(ScreenState.CONNECTING) }
    var serverIp by remember { mutableStateOf(prefs.getString(MainActivity.KEY_SERVER_IP, "") ?: "") }
    var serverPort by remember { mutableStateOf(prefs.getString(MainActivity.KEY_SERVER_PORT, "3000") ?: "3000") }
    var fullUrl by remember { mutableStateOf(prefs.getString(MainActivity.KEY_SERVER_URL, "") ?: "") }
    var isKeepAwake by remember { mutableStateOf(prefs.getBoolean(MainActivity.KEY_KEEP_AWAKE, true)) }
    var errorMessage by remember { mutableStateOf("") }
    var isScanning by remember { mutableStateOf(false) }
    var scanProgress by remember { mutableFloatStateOf(0f) }
    var foundServers by remember { mutableStateOf(listOf<String>()) }
    var webProgress by remember { mutableIntStateOf(0) }
    var showSettingsModal by remember { mutableStateOf(false) }
    var activeWebView by remember { mutableStateOf<WebView?>(null) }
    var backPressedOnce by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    // Test connection helper
    fun testAndConnect(ip: String, port: String, launchUrl: String? = null) {
        val cleanIp = ip.trim().removePrefix("http://").removePrefix("https://").trimEnd('/')
        val cleanPort = port.trim()
        val targetUrl = launchUrl ?: if (cleanPort == "3002") {
            "http://$cleanIp:$cleanPort/tables"
        } else {
            "http://$cleanIp:$cleanPort/pos"
        }

        screenState = ScreenState.CONNECTING
        errorMessage = ""

        coroutineScope.launch(Dispatchers.IO) {
            val probeUrl = "http://$cleanIp:$cleanPort/api/server/info"
            val reachable = probeHttp(probeUrl, 3000) || probeHttp("http://$cleanIp:$cleanPort/", 3000)

            withContext(Dispatchers.Main) {
                if (reachable) {
                    prefs.edit()
                        .putString(MainActivity.KEY_SERVER_IP, cleanIp)
                        .putString(MainActivity.KEY_SERVER_PORT, cleanPort)
                        .putString(MainActivity.KEY_SERVER_URL, targetUrl)
                        .apply()

                    serverIp = cleanIp
                    serverPort = cleanPort
                    fullUrl = targetUrl
                    screenState = ScreenState.WEBVIEW
                    activeWebView?.loadUrl(targetUrl)
                } else {
                    errorMessage = "Cannot reach ChayaOne Server at $cleanIp:$cleanPort.\nPlease ensure Wi-Fi is connected and the POS Server PC is running."
                    screenState = ScreenState.SETUP
                }
            }
        }
    }

    // Auto-scan local Wi-Fi subnet for ChayaOne POS server
    fun startAutoScan() {
        isScanning = true
        scanProgress = 0f
        foundServers = emptyList()

        coroutineScope.launch(Dispatchers.IO) {
            val subnet = getLocalSubnetPrefix(context) ?: "192.168.1."
            val candidates = mutableListOf<String>()

            // Quick scan of likely local host IPs (.1 to .254)
            val ipRange = (1..254).toList()
            val total = ipRange.size
            var checked = 0

            // Common POS ports to test: 3000 (POS Till), 3002 (Waiter), 80
            val portsToTest = listOf("3000", "3002")

            // Scan in batches of 25 for fast completion
            ipRange.chunked(25).forEach { chunk ->
                val jobs = chunk.map { lastOctet ->
                    async {
                        val testIp = "$subnet$lastOctet"
                        for (p in portsToTest) {
                            if (probeHttp("http://$testIp:$p/api/server/info", 600)) {
                                synchronized(candidates) {
                                    candidates.add("$testIp:$p")
                                }
                                break
                            }
                        }
                    }
                }
                jobs.awaitAll()
                checked += chunk.size
                withContext(Dispatchers.Main) {
                    scanProgress = checked.toFloat() / total.toFloat()
                }
            }

            withContext(Dispatchers.Main) {
                isScanning = false
                foundServers = candidates
                if (candidates.isNotEmpty()) {
                    val first = candidates.first()
                    val parts = first.split(":")
                    serverIp = parts[0]
                    if (parts.size > 1) serverPort = parts[1]
                    Toast.makeText(context, "Found ChayaOne Server: $first", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "No servers found automatically. Please enter IP manually or scan QR code.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    // QR Code Scanner Result Launcher
    val qrScanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val scanned = result.contents
        if (!scanned.isNullOrBlank()) {
            val parsed = parseServerQr(scanned)
            if (parsed.ip.isNotBlank()) {
                serverIp = parsed.ip
                serverPort = parsed.port
                Toast.makeText(context, "Connecting to Main POS (${parsed.ip}:${parsed.port})…", Toast.LENGTH_SHORT).show()
                val targetUrl = "http://${parsed.ip}:${parsed.port}${if (parsed.port == "3002") "/tables" else "/pos"}${if (parsed.user.isNotBlank()) "?user=${Uri.encode(parsed.user)}" else ""}"
                testAndConnect(parsed.ip, parsed.port, targetUrl)
            } else {
                errorMessage = "Scanned QR does not contain a valid POS server address: $scanned"
            }
        }
    }

    // Camera Permission Launcher for QR Scanner
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            val options = ScanOptions().apply {
                setPrompt("Point camera at Desktop Main POS QR code")
                setBeepEnabled(true)
                setOrientationLocked(true)
                setCaptureActivity(PortraitCaptureActivity::class.java)
                setBarcodeImageEnabled(false)
                setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            }
            qrScanLauncher.launch(options)
        } else {
            Toast.makeText(
                context,
                "Camera permission is required to scan the POS QR code.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    fun launchCameraScanner() {
        val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
        if (permission == PackageManager.PERMISSION_GRANTED) {
            val options = ScanOptions().apply {
                setPrompt("Point camera at Desktop Main POS QR code")
                setBeepEnabled(true)
                setOrientationLocked(true)
                setCaptureActivity(PortraitCaptureActivity::class.java)
                setBarcodeImageEnabled(false)
                setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            }
            qrScanLauncher.launch(options)
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    // Initial connection attempt on launch
    LaunchedEffect(Unit) {
        if (serverIp.isNotBlank()) {
            testAndConnect(serverIp, serverPort, fullUrl.ifBlank { null })
        } else {
            screenState = ScreenState.SETUP
            startAutoScan()
        }
    }

    // Hardware Back Button: navigate webview history before exiting
    BackHandler(enabled = screenState == ScreenState.WEBVIEW) {
        if (activeWebView?.canGoBack() == true) {
            activeWebView?.goBack()
        } else {
            if (backPressedOnce) {
                activity.finish()
            } else {
                backPressedOnce = true
                Toast.makeText(context, "Press back again to exit Waiter App", Toast.LENGTH_SHORT).show()
                coroutineScope.launch {
                    delay(2500)
                    backPressedOnce = false
                }
            }
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = ChayaEspresso
    ) {
        when (screenState) {
            ScreenState.CONNECTING -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.padding(32.dp)
                    ) {
                        CircularProgressIndicator(color = ChayaGold, modifier = Modifier.size(54.dp))
                        Text(
                            text = "Connecting to ChayaOne POS…",
                            style = MaterialTheme.typography.titleLarge,
                            color = ChayaGold
                        )
                        if (serverIp.isNotBlank()) {
                            Text(
                                text = "Target: $serverIp:$serverPort",
                                style = MaterialTheme.typography.labelSmall,
                                color = ChayaMuted
                            )
                        }
                    }
                }
            }

            ScreenState.SETUP -> {
                ServerSetupScreen(
                    currentIp = serverIp,
                    currentPort = serverPort,
                    errorMessage = errorMessage,
                    isScanning = isScanning,
                    scanProgress = scanProgress,
                    foundServers = foundServers,
                    onIpChanged = { serverIp = it },
                    onPortChanged = { serverPort = it },
                    onConnect = { ip, port -> testAndConnect(ip, port) },
                    onScan = { startAutoScan() },
                    onScanQr = { launchCameraScanner() }
                )
            }

            ScreenState.WEBVIEW, ScreenState.ERROR -> {
                Box(modifier = Modifier.fillMaxSize()) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Slim Top Status Bar
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(ChayaCard)
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(if (screenState == ScreenState.WEBVIEW) ChayaGreen else ChayaRed)
                                )
                                Text(
                                    text = "ChayaOne Waiter • $serverIp:$serverPort",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = ChayaPaper
                                )
                            }

                            Row(
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = { activeWebView?.reload() },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Text(
                                        text = "🔄",
                                        fontSize = 15.sp
                                    )
                                }

                                IconButton(
                                    onClick = { showSettingsModal = true },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Text(
                                        text = "⚙️",
                                        fontSize = 15.sp
                                    )
                                }
                            }
                        }

                        // Loading Progress Indicator
                        if (webProgress in 1..99) {
                            LinearProgressIndicator(
                                progress = { webProgress / 100f },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(2.dp),
                                color = ChayaGold,
                                trackColor = ChayaCard
                            )
                        }

                        // Main WebView
                        AndroidView(
                            factory = { ctx ->
                                WebView(ctx).apply {
                                    layoutParams = ViewGroup.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    configureWebViewSettings(this)

                                    // Expose Native Bridge to web application
                                    addJavascriptInterface(
                                        AndroidBridge(
                                            activity = activity,
                                            onOpenSettings = { showSettingsModal = true },
                                            onScanQr = { launchCameraScanner() },
                                            onClearCache = {
                                                clearCache(true)
                                                Toast.makeText(context, "App cache cleared", Toast.LENGTH_SHORT).show()
                                            },
                                            serverIp = serverIp,
                                            serverPort = serverPort
                                        ),
                                        "AndroidBridge"
                                    )

                                    webViewClient = object : WebViewClient() {
                                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                            return false
                                        }

                                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                            super.onPageStarted(view, url, favicon)
                                            screenState = ScreenState.WEBVIEW
                                        }

                                        override fun onReceivedError(
                                            view: WebView?,
                                            request: WebResourceRequest?,
                                            error: WebResourceError?
                                        ) {
                                            super.onReceivedError(view, request, error)
                                            if (request?.isForMainFrame == true) {
                                                errorMessage = "Connection lost to ChayaOne Server ($serverIp:$serverPort)."
                                                screenState = ScreenState.ERROR
                                            }
                                        }
                                    }

                                    webChromeClient = object : WebChromeClient() {
                                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                            webProgress = newProgress
                                        }
                                    }

                                    loadUrl(fullUrl)
                                    activeWebView = this
                                    onRegisterWebView(this)
                                }
                            },
                            update = { wv ->
                                activeWebView = wv
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Reconnection overlay if connection fails during active session
                    if (screenState == ScreenState.ERROR) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color(0xE615110D)),
                            contentAlignment = Alignment.Center
                        ) {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth(0.85f)
                                    .padding(16.dp),
                                colors = CardDefaults.cardColors(containerColor = ChayaCard),
                                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(ChayaBorder))
                            ) {
                                Column(
                                    modifier = Modifier.padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(16.dp)
                                ) {
                                    Text(
                                        text = "⚠️",
                                        fontSize = 42.sp
                                    )
                                    Text(
                                        text = "POS Server Offline",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = ChayaPaper
                                    )
                                    Text(
                                        text = "Cannot reach Main PC at $serverIp:$serverPort.\nPlease ensure Wi-Fi is active and the Desktop POS is running.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = ChayaMuted,
                                        textAlign = TextAlign.Center
                                    )
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        OutlinedButton(
                                            onClick = { screenState = ScreenState.SETUP },
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ChayaGold)
                                        ) {
                                            Text("Setup IP")
                                        }
                                        Button(
                                            onClick = {
                                                testAndConnect(serverIp, serverPort, fullUrl)
                                            },
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.buttonColors(containerColor = ChayaGold, contentColor = ChayaEspresso)
                                        ) {
                                            Text("Retry")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Settings Dialog (to switch IP or port anytime)
                    if (showSettingsModal) {
                        AlertDialog(
                            onDismissRequest = { showSettingsModal = false },
                            title = {
                                Text("Waiter Settings", color = ChayaGold, fontWeight = FontWeight.Bold)
                            },
                            text = {
                                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                    Text("Server IP: $serverIp:$serverPort", color = ChayaPaper, fontSize = 14.sp)

                                    OutlinedButton(
                                        onClick = {
                                            showSettingsModal = false
                                            launchCameraScanner()
                                        },
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = ChayaGold),
                                        border = BorderStroke(1.dp, ChayaGold),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("📷 Scan New POS QR Code", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    }

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("Keep Screen Awake", color = ChayaPaper, fontSize = 14.sp)
                                        Switch(
                                            checked = isKeepAwake,
                                            onCheckedChange = {
                                                isKeepAwake = it
                                                onKeepAwakeChanged(it)
                                            },
                                            colors = SwitchDefaults.colors(
                                                checkedThumbColor = ChayaGold,
                                                checkedTrackColor = ChayaBorder
                                            )
                                        )
                                    }
                                }
                            },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        showSettingsModal = false
                                        screenState = ScreenState.SETUP
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = ChayaGold, contentColor = ChayaEspresso)
                                ) {
                                    Text("Change Server IP")
                                }
                            },
                            dismissButton = {
                                TextButton(
                                    onClick = { showSettingsModal = false },
                                    colors = ButtonDefaults.textButtonColors(contentColor = ChayaMuted)
                                ) {
                                    Text("Close")
                                }
                            },
                            containerColor = ChayaCard,
                            shape = RoundedCornerShape(16.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ServerSetupScreen(
    currentIp: String,
    currentPort: String,
    errorMessage: String,
    isScanning: Boolean,
    scanProgress: Float,
    foundServers: List<String>,
    onIpChanged: (String) -> Unit,
    onPortChanged: (String) -> Unit,
    onConnect: (String, String) -> Unit,
    onScan: () -> Unit,
    onScanQr: () -> Unit
) {
    val focusManager = LocalFocusManager.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 440.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header with Full ChayaOne Logo
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(top = 8.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.logo_chaya_one),
                    contentDescription = "ChayaOne Full Logo",
                    modifier = Modifier
                        .fillMaxWidth(0.68f)
                        .height(56.dp),
                    contentScale = ContentScale.Fit
                )

                Text(
                    text = "ChayaOne Waiter",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = ChayaGold
                )

                Text(
                    text = "Connect to Main POS on your Café Wi-Fi",
                    fontSize = 13.sp,
                    color = ChayaMuted,
                    textAlign = TextAlign.Center
                )
            }

            // PRIMARY HERO CARD: SCAN POS QR CODE (INSTANT AUTO-ENTER)
            Card(
                onClick = onScanQr,
                colors = CardDefaults.cardColors(containerColor = ChayaCard),
                border = BorderStroke(1.5.dp, ChayaGold),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ChayaGold.copy(alpha = 0.15f))
                            .border(1.dp, ChayaGold.copy(alpha = 0.35f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("📷", fontSize = 24.sp)
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Scan POS QR Code",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = ChayaPaper
                        )
                        Text(
                            text = "Point camera at POS Settings QR to enter instantly",
                            fontSize = 12.sp,
                            color = ChayaGold
                        )
                    }

                    Text(
                        text = "➔",
                        fontSize = 18.sp,
                        color = ChayaGold,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Subtle divider
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = ChayaBorder)
                Text(
                    text = "OR CONNECT MANUALLY",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = ChayaMuted,
                    letterSpacing = 0.8.sp
                )
                HorizontalDivider(modifier = Modifier.weight(1f), color = ChayaBorder)
            }

            if (errorMessage.isNotBlank()) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0x33EF4444)),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(ChayaRed)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorMessage,
                        color = Color(0xFFFF8888),
                        fontSize = 13.sp,
                        modifier = Modifier.padding(12.dp),
                        textAlign = TextAlign.Center
                    )
                }
            }

            // Input Fields Card
            Card(
                colors = CardDefaults.cardColors(containerColor = ChayaCard),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(ChayaBorder)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    OutlinedTextField(
                        value = currentIp,
                        onValueChange = onIpChanged,
                        label = { Text("Server IP Address") },
                        placeholder = { Text("e.g. 192.168.1.5") },
                        leadingIcon = {
                            Text("🌐", fontSize = 16.sp)
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ChayaGold,
                            unfocusedBorderColor = ChayaBorder,
                            focusedTextColor = ChayaPaper,
                            unfocusedTextColor = ChayaPaper,
                            focusedLabelColor = ChayaGold,
                            unfocusedLabelColor = ChayaMuted
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Port Selection
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = currentPort == "3000",
                            onClick = { onPortChanged("3000") },
                            label = { Text("Port 3000 (POS Till)") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ChayaGold,
                                selectedLabelColor = ChayaEspresso,
                                containerColor = ChayaEspresso,
                                labelColor = ChayaPaper
                            ),
                            modifier = Modifier.weight(1f)
                        )

                        FilterChip(
                            selected = currentPort == "3002",
                            onClick = { onPortChanged("3002") },
                            label = { Text("Port 3002 (Waiter)") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ChayaGold,
                                selectedLabelColor = ChayaEspresso,
                                containerColor = ChayaEspresso,
                                labelColor = ChayaPaper
                            ),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Auto-scan button
                    OutlinedButton(
                        onClick = onScan,
                        enabled = !isScanning,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = ChayaGold)
                    ) {
                        if (isScanning) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = ChayaGold,
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Scanning Wi-Fi (${(scanProgress * 100).toInt()}%)…")
                        } else {
                            Text("🔍", fontSize = 16.sp)
                            Spacer(Modifier.width(8.dp))
                            Text("Auto-Scan Café Wi-Fi")
                        }
                    }

                    // Found servers list if any
                    if (foundServers.isNotEmpty()) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Discovered Servers:", fontSize = 12.sp, color = ChayaGold)
                            foundServers.forEach { server ->
                                val parts = server.split(":")
                                Surface(
                                    onClick = {
                                        onIpChanged(parts[0])
                                        onPortChanged(parts.getOrElse(1) { "3000" })
                                    },
                                    color = ChayaEspresso,
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, ChayaBorder),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(server, color = ChayaPaper, fontSize = 13.sp)
                                        Text("Select", color = ChayaGold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    // Connect & Launch Button
                    Button(
                        onClick = {
                            if (currentIp.isNotBlank()) {
                                onConnect(currentIp, currentPort)
                            }
                        },
                        enabled = currentIp.isNotBlank() && !isScanning,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ChayaGold,
                            contentColor = ChayaEspresso,
                            disabledContainerColor = ChayaBorder,
                            disabledContentColor = ChayaMuted
                        )
                    ) {
                        Text(
                            text = "Connect to POS",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
private fun configureWebViewSettings(wv: WebView) {
    wv.settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        databaseEnabled = true
        allowFileAccess = true
        allowContentAccess = true
        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        cacheMode = WebSettings.LOAD_DEFAULT
        useWideViewPort = true
        loadWithOverviewMode = true
        displayZoomControls = false
        builtInZoomControls = false
        userAgentString = "${wv.settings.userAgentString} ChayaOneWaiter/1.0"
    }
    wv.isVerticalScrollBarEnabled = false
    wv.isHorizontalScrollBarEnabled = false
}

// Utility: HTTP reachability probe
private fun probeHttp(urlStr: String, timeoutMs: Int): Boolean {
    return try {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = true
        val code = conn.responseCode
        conn.disconnect()
        code in 200..499
    } catch (e: Exception) {
        false
    }
}

// Utility: Find local Wi-Fi subnet prefix (e.g. "192.168.1.")
private fun getLocalSubnetPrefix(context: Context): String? {
    return try {
        val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val ipInt = wifiManager?.connectionInfo?.ipAddress ?: 0
        if (ipInt != 0) {
            val byte1 = ipInt and 0xff
            val byte2 = ipInt shr 8 and 0xff
            val byte3 = ipInt shr 16 and 0xff
            "$byte1.$byte2.$byte3."
        } else {
            // Fallback via network interfaces
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            var prefix: String? = null
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                val addresses = iface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                        val host = addr.hostAddress ?: ""
                        val parts = host.split(".")
                        if (parts.size == 4) {
                            prefix = "${parts[0]}.${parts[1]}.${parts[2]}."
                            break
                        }
                    }
                }
                if (prefix != null) break
            }
            prefix
        }
    } catch (e: Exception) {
        null
    }
}
