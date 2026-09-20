package com.example.chayaonewaiter

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.chayaonewaiter.theme.ChayaOneWaiterTheme
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

// Native Javascript Bridge exposed to web app to move IP / Settings into Menu Bar
class AndroidBridge(
    private val activity: Activity,
    private val onOpenSettings: () -> Unit,
    private val onClearCache: () -> Unit,
    private val serverIp: String,
    private val serverPort: String
) {
    @JavascriptInterface
    fun openSettings() {
        activity.runOnUiThread {
            onOpenSettings()
        }
    }

    @JavascriptInterface
    fun getServerIp(): String = serverIp

    @JavascriptInterface
    fun getServerPort(): String = serverPort

    @JavascriptInterface
    fun clearAppCache() {
        activity.runOnUiThread {
            onClearCache()
        }
    }
}

// Automatic cache cleanup to ensure silky-smooth operations on tablet/mobile devices
fun autoCleanCache(context: Context, webView: WebView? = null) {
    try {
        webView?.clearCache(false)
        val cacheDir = context.cacheDir
        if (cacheDir.exists()) {
            cacheDir.listFiles()?.forEach { f ->
                try {
                    val age = System.currentTimeMillis() - f.lastModified()
                    if (age > 12 * 60 * 60 * 1000L || f.name.contains("cache", true) || f.name.startsWith("WebView")) {
                        f.deleteRecursively()
                    }
                } catch (_: Exception) {}
            }
        }
    } catch (_: Exception) {}
}

class MainActivity : ComponentActivity() {
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        autoCleanCache(applicationContext)
        bindToWifiNetwork()
        enableEdgeToEdge(
            statusBarStyle = androidx.activity.SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = androidx.activity.SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        handleIntent(intent)
        setContent {
            ChayaOneWaiterTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    WaiterAppScreen()
                }
            }
        }
    }

    private fun bindToWifiNetwork() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
            val request = NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .build()

            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    try {
                        cm.bindProcessToNetwork(network)
                    } catch (_: Exception) {}
                }

                override fun onLost(network: Network) {
                    try {
                        cm.bindProcessToNetwork(null)
                    } catch (_: Exception) {}
                }
            }
            networkCallback = callback
            cm.registerNetworkCallback(request, callback)
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            networkCallback?.let {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                cm?.unregisterNetworkCallback(it)
            }
        } catch (_: Exception) {}
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        val prefs = getSharedPreferences("chayaone_waiter_prefs", Context.MODE_PRIVATE)

        var ip = data.getQueryParameter("ip") ?: data.getQueryParameter("server")
        val port = data.getQueryParameter("port") ?: (if (data.port > 0) data.port.toString() else "3000")
        val user = data.getQueryParameter("user")
        val path = data.getQueryParameter("path") ?: "/pos"

        if (ip.isNullOrBlank() && data.host != null && data.host != "connect") {
            ip = data.host
        }

        if (!ip.isNullOrBlank()) {
            val editor = prefs.edit()
                .putString("server_ip", ip)
                .putBoolean("has_configured", true)
            if (!port.isNullOrBlank()) editor.putString("server_port", port)
            if (!path.isNullOrBlank()) editor.putString("server_path", path)
            if (!user.isNullOrBlank()) editor.putString("user_name", user)
            editor.apply()
        }
    }
}

@Composable
fun WaiterAppScreen() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("chayaone_waiter_prefs", Context.MODE_PRIVATE) }

    var serverIp by remember { mutableStateOf(prefs.getString("server_ip", "") ?: "") }
    var serverPort by remember { mutableStateOf(prefs.getString("server_port", "3000") ?: "3000") }
    var serverPath by remember { mutableStateOf(prefs.getString("server_path", "/pos") ?: "/pos") }
    var userName by remember { mutableStateOf(prefs.getString("user_name", "") ?: "") }
    var hasConfigured by remember { mutableStateOf(prefs.getBoolean("has_configured", false)) }

    // If never configured or IP is blank, display setup screen directly
    var showSetupScreen by remember { mutableStateOf(!hasConfigured || serverIp.isBlank()) }

    var currentUrl by remember {
        val userParam = if (userName.isNotBlank()) "?user=$userName" else ""
        mutableStateOf(if (serverIp.isNotBlank()) "http://$serverIp:$serverPort$serverPath$userParam" else "")
    }

    if (showSetupScreen) {
        WaiterSetupScreen(
            initialIp = serverIp,
            initialPort = serverPort,
            initialPath = serverPath,
            initialUser = userName,
            canCancel = hasConfigured && serverIp.isNotBlank(),
            onConnected = { newIp, newPort, newPath, newUser ->
                serverIp = newIp
                serverPort = newPort
                serverPath = newPath
                userName = newUser
                hasConfigured = true

                prefs.edit()
                    .putString("server_ip", newIp)
                    .putString("server_port", newPort)
                    .putString("server_path", newPath)
                    .putString("user_name", newUser)
                    .putBoolean("has_configured", true)
                    .apply()

                val userParam = if (newUser.isNotBlank()) "?user=$newUser" else ""
                currentUrl = "http://$newIp:$newPort$newPath$userParam"
                showSetupScreen = false
            },
            onCancel = {
                showSetupScreen = false
            }
        )
    } else {
        WaiterWebViewScreen(
            url = currentUrl,
            serverIp = serverIp,
            serverPort = serverPort,
            userName = userName,
            onOpenSettings = {
                showSetupScreen = true
            }
        )
    }
}

data class ParsedServerUrl(
    val ip: String,
    val port: String,
    val path: String,
    val user: String
)

fun parseServerQr(raw: String): ParsedServerUrl {
    var ip = ""
    var port = "3000"
    var path = "/pos"
    var user = ""
    try {
        val trimmed = raw.trim()
        if (trimmed.contains("://") || trimmed.contains("?")) {
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
            if (parts.size > 1) port = parts[1].trim()
        } else if (trimmed.isNotBlank()) {
            ip = trimmed
        }
    } catch (_: Exception) {
    }
    return ParsedServerUrl(ip, port, path, user)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WaiterSetupScreen(
    initialIp: String,
    initialPort: String,
    initialPath: String,
    initialUser: String,
    canCancel: Boolean,
    onConnected: (ip: String, port: String, path: String, user: String) -> Unit,
    onCancel: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var tempIp by remember { mutableStateOf(initialIp) }
    var tempPort by remember { mutableStateOf(if (initialPort.isBlank()) "3000" else initialPort) }
    var tempPath by remember { mutableStateOf(if (initialPath.isBlank()) "/pos" else initialPath) }
    var tempUser by remember { mutableStateOf(initialUser) }

    var qrPasteInput by remember { mutableStateOf("") }
    var testStatus by remember { mutableStateOf<String?>(null) }
    var isTesting by remember { mutableStateOf(false) }

    // Official Camera QR Scanner launcher using locked portrait activity
    val qrScanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val scanned = result.contents
        if (!scanned.isNullOrBlank()) {
            val parsed = parseServerQr(scanned)
            if (parsed.ip.isNotBlank()) {
                tempIp = parsed.ip
                tempPort = parsed.port
                tempPath = parsed.path
                tempUser = parsed.user
                Toast.makeText(context, "Connecting to Main PC (${parsed.ip}:${parsed.port})...", Toast.LENGTH_SHORT).show()
                // INSTANT AUTO-CONNECT: enter the POS server directly on the Wi-Fi network!
                onConnected(parsed.ip, parsed.port, parsed.path, parsed.user)
            } else {
                testStatus = "Scanned text is not a valid server address: $scanned"
            }
        }
    }

    // Camera permission request strictly launched from portrait MainActivity
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            val options = ScanOptions().apply {
                setPrompt("Point camera at Main PC QR code (Desktop Screen)")
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
                "Camera permission is required to scan QR code. Please allow camera access in Settings.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    fun launchCameraScanner() {
        val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
        if (permission == PackageManager.PERMISSION_GRANTED) {
            val options = ScanOptions().apply {
                setPrompt("Point camera at Main PC QR code (Desktop Screen)")
                setBeepEnabled(true)
                setOrientationLocked(true)
                setCaptureActivity(PortraitCaptureActivity::class.java)
                setBarcodeImageEnabled(false)
                setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            }
            qrScanLauncher.launch(options)
        } else {
            // Prompts runtime permission dialog in PORTRAIT mode inside MainActivity
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFFD97706).copy(alpha = 0.2f),
                                border = BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.5f)),
                                modifier = Modifier.size(34.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("☕", fontSize = 16.sp)
                                }
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "CHAYAONE",
                                        color = Color.White,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 16.sp,
                                        letterSpacing = 1.2.sp
                                    )
                                    Spacer(modifier = Modifier.width(5.dp))
                                    Text(
                                        text = "POS",
                                        color = Color(0xFF38BDF8),
                                        fontWeight = FontWeight.Black,
                                        fontSize = 16.sp
                                    )
                                }
                                Text(
                                    text = "WAITER TERMINAL OS",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.8.sp
                                )
                            }
                        }
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF10B981).copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.4f)),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(Color(0xFF34D399), CircleShape)
                                )
                                Spacer(modifier = Modifier.width(5.dp))
                                Text(
                                    text = "Wi-Fi Ready",
                                    color = Color(0xFF34D399),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF080C16))
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0xFF080C16),
                            Color(0xFF0F172A),
                            Color(0xFF070B14)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Luxury Frosted Shop Wi-Fi Guidance Card
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFF1E293B).copy(alpha = 0.55f),
                    border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFF0284C7).copy(alpha = 0.2f),
                            border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.4f)),
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("📶", fontSize = 16.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Local Wi-Fi Network Mode",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color(0xFF10B981).copy(alpha = 0.2f)
                                ) {
                                    Text(
                                        text = "SAME ROUTER",
                                        color = Color(0xFF34D399),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Connect phone to same shop Wi-Fi as Main PC. Keep mobile data (5G/4G) off if it interrupts local Wi-Fi routing.",
                                color = Color(0xFF94A3B8),
                                fontSize = 11.5.sp,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }

                // Featured Hero Card: Instant QR Camera Auto-Pair
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F1B35)),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(
                        1.5.dp,
                        Brush.horizontalGradient(
                            listOf(Color(0xFF0284C7), Color(0xFF38BDF8), Color(0xFF34D399), Color(0xFF0284C7))
                        )
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFF0284C7).copy(alpha = 0.25f),
                                    border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.5f)),
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text("⚡", fontSize = 15.sp)
                                    }
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "Instant QR Connect",
                                        color = Color.White,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 18.sp,
                                        letterSpacing = 0.3.sp
                                    )
                                    Text(
                                        text = "Zero-setup camera pairing",
                                        color = Color(0xFF94A3B8),
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Color(0xFF0284C7).copy(alpha = 0.2f),
                                border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.5f))
                            ) {
                                Text(
                                    text = "RECOMMENDED",
                                    color = Color(0xFF38BDF8),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 0.8.sp,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Futuristic Viewfinder Frame Mockup
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xFF080E1D).copy(alpha = 0.85f),
                            border = BorderStroke(1.dp, Color(0xFF1E293B)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color(0xFF0284C7).copy(alpha = 0.15f),
                                    border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.4f)),
                                    modifier = Modifier.size(46.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text("⛶", fontSize = 24.sp, color = Color(0xFF38BDF8))
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = "On Desktop Main PC:",
                                        color = Color(0xFFF1F5F9),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp
                                    )
                                    Text(
                                        text = "Open Settings → App QR Codes",
                                        color = Color(0xFF38BDF8),
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp
                                    )
                                    Text(
                                        text = "Point phone camera at Waiter QR code",
                                        color = Color(0xFF64748B),
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // Large Radiant CTA Button
                        Button(
                            onClick = { launchCameraScanner() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(58.dp)
                                .background(
                                    brush = Brush.horizontalGradient(
                                        listOf(Color(0xFF0284C7), Color(0xFF0EA5E9), Color(0xFF38BDF8))
                                    ),
                                    shape = RoundedCornerShape(16.dp)
                                ),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            shape = RoundedCornerShape(16.dp),
                            contentPadding = PaddingValues()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Text("📷", fontSize = 20.sp)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    "Open Camera QR Scanner",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = Color.White,
                                    letterSpacing = 0.3.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Feature Highlights
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("✓", color = Color(0xFF34D399), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Auto-Connects", color = Color(0xFF94A3B8), fontSize = 11.sp)
                            }
                            Text("•", color = Color(0xFF475569), fontSize = 10.sp)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("✓", color = Color(0xFF34D399), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Zero Typing", color = Color(0xFF94A3B8), fontSize = 11.sp)
                            }
                            Text("•", color = Color(0xFF475569), fontSize = 10.sp)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("✓", color = Color(0xFF34D399), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Instant Till", color = Color(0xFF94A3B8), fontSize = 11.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = Color(0xFF1E293B), thickness = 1.dp)
                        Spacer(modifier = Modifier.height(14.dp))

                        // Deep Link / Paste URL Input
                        OutlinedTextField(
                            value = qrPasteInput,
                            onValueChange = {
                                qrPasteInput = it
                                val parsed = parseServerQr(it)
                                if (parsed.ip.isNotBlank()) {
                                    tempIp = parsed.ip
                                    tempPort = parsed.port
                                    tempPath = parsed.path
                                    tempUser = parsed.user
                                    testStatus = "Parsed QR URL: ${parsed.ip}:${parsed.port}"
                                }
                            },
                            label = { Text("Or Paste Server URL / Deep Link", fontSize = 11.sp) },
                            placeholder = { Text("http://192.168.1.100:3000/pos...", fontSize = 12.sp, color = Color(0xFF475569)) },
                            shape = RoundedCornerShape(14.dp),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF38BDF8),
                                unfocusedBorderColor = Color(0xFF1E293B),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedContainerColor = Color(0xFF070C18),
                                unfocusedContainerColor = Color(0xFF070C18),
                                focusedLabelColor = Color(0xFF38BDF8),
                                unfocusedLabelColor = Color(0xFF64748B)
                            )
                        )
                    }
                }

                // Manual Wi-Fi Connection Section
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0A1020)),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color(0xFF1E293B)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFF64748B).copy(alpha = 0.2f),
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text("⚙️", fontSize = 14.sp)
                                    }
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Manual Wi-Fi Connection",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFF1E293B).copy(alpha = 0.6f)
                            ) {
                                Text(
                                    text = "DIRECT IP",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Enter the local Wi-Fi IP address shown on the Main PC desktop window.",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedTextField(
                            value = tempIp,
                            onValueChange = { tempIp = it.trim() },
                            label = { Text("Main PC Wi-Fi IP Address", fontSize = 12.sp) },
                            placeholder = { Text("e.g. 192.168.1.100 or 10.0.0.5", fontSize = 12.sp, color = Color(0xFF475569)) },
                            shape = RoundedCornerShape(14.dp),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF38BDF8),
                                unfocusedBorderColor = Color(0xFF1E293B),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedContainerColor = Color(0xFF070C18),
                                unfocusedContainerColor = Color(0xFF070C18),
                                focusedLabelColor = Color(0xFF38BDF8),
                                unfocusedLabelColor = Color(0xFF64748B)
                            )
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = tempPort,
                                onValueChange = { tempPort = it.trim() },
                                label = { Text("Port", fontSize = 12.sp) },
                                placeholder = { Text("3000", fontSize = 12.sp) },
                                shape = RoundedCornerShape(14.dp),
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFF38BDF8),
                                    unfocusedBorderColor = Color(0xFF1E293B),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    focusedContainerColor = Color(0xFF070C18),
                                    unfocusedContainerColor = Color(0xFF070C18),
                                    focusedLabelColor = Color(0xFF38BDF8),
                                    unfocusedLabelColor = Color(0xFF64748B)
                                )
                            )

                            OutlinedTextField(
                                value = tempUser,
                                onValueChange = { tempUser = it.trim() },
                                label = { Text("Staff Name (Optional)", fontSize = 12.sp) },
                                placeholder = { Text("e.g. Waiter 1", fontSize = 12.sp, color = Color(0xFF475569)) },
                                shape = RoundedCornerShape(14.dp),
                                singleLine = true,
                                modifier = Modifier.weight(1.5f),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFF38BDF8),
                                    unfocusedBorderColor = Color(0xFF1E293B),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    focusedContainerColor = Color(0xFF070C18),
                                    unfocusedContainerColor = Color(0xFF070C18),
                                    focusedLabelColor = Color(0xFF38BDF8),
                                    unfocusedLabelColor = Color(0xFF64748B)
                                )
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        AssistChip(
                            onClick = {
                                tempPort = "3000"
                                tempPath = "/pos"
                            },
                            label = { Text("Port 3000 (Main PC POS Till) ★", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (tempPort == "3000") Color(0xFF0284C7).copy(alpha = 0.25f) else Color(0xFF0B101D),
                                labelColor = if (tempPort == "3000") Color(0xFF38BDF8) else Color(0xFF94A3B8)
                            ),
                            border = BorderStroke(1.dp, if (tempPort == "3000") Color(0xFF0284C7) else Color(0xFF1E293B))
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        testStatus?.let { status ->
                            val isSuccess = status.startsWith("Connected") || status.startsWith("Parsed")
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSuccess) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f),
                                border = BorderStroke(1.dp, if (isSuccess) Color(0xFF10B981).copy(alpha = 0.4f) else Color(0xFFEF4444).copy(alpha = 0.4f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = status,
                                    color = if (isSuccess) Color(0xFF4ADE80) else Color(0xFFF87171),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(14.dp))
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    if (tempIp.isBlank()) {
                                        testStatus = "Please enter an IP address first."
                                        return@OutlinedButton
                                    }
                                    isTesting = true
                                    testStatus = "Testing connection to $tempIp:$tempPort..."
                                    scope.launch {
                                        val success = withContext(Dispatchers.IO) {
                                            try {
                                                val url = URL("http://$tempIp:$tempPort/api/server/info")
                                                val conn = url.openConnection() as HttpURLConnection
                                                conn.connectTimeout = 3000
                                                conn.readTimeout = 3000
                                                conn.requestMethod = "GET"
                                                val code = conn.responseCode
                                                conn.disconnect()
                                                code in 200..399
                                            } catch (_: Exception) {
                                                try {
                                                    val url2 = URL("http://$tempIp:$tempPort")
                                                    val conn2 = url2.openConnection() as HttpURLConnection
                                                    conn2.connectTimeout = 2500
                                                    conn2.readTimeout = 2500
                                                    conn2.requestMethod = "GET"
                                                    val code2 = conn2.responseCode
                                                    conn2.disconnect()
                                                    code2 in 200..499
                                                } catch (_: Exception) {
                                                    false
                                                }
                                            }
                                        }
                                        isTesting = false
                                        testStatus = if (success) {
                                            "Connected! ChayaOne Main PC server is online."
                                        } else {
                                            "Could not reach server at $tempIp:$tempPort. Verify phone is on the same Wi-Fi and ChayaOne is running on the Main PC."
                                        }
                                    }
                                },
                                enabled = !isTesting,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp),
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.5f)),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF38BDF8))
                            ) {
                                Text(if (isTesting) "Testing..." else "🔍 Test Ping", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            }

                            Button(
                                onClick = {
                                    if (tempIp.isBlank()) {
                                        testStatus = "Main PC IP address is required."
                                        return@Button
                                    }
                                    onConnected(tempIp, tempPort, tempPath, tempUser)
                                },
                                modifier = Modifier
                                    .weight(1.3f)
                                    .height(52.dp)
                                    .background(
                                        brush = Brush.horizontalGradient(
                                            listOf(Color(0xFF059669), Color(0xFF10B981))
                                        ),
                                        shape = RoundedCornerShape(14.dp)
                                    ),
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                                shape = RoundedCornerShape(14.dp),
                                contentPadding = PaddingValues()
                            ) {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text("Connect & Start", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                                }
                            }
                        }

                        if (canCancel) {
                            Spacer(modifier = Modifier.height(10.dp))
                            TextButton(
                                onClick = onCancel,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("← Return to Waiter POS Till", color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }

                // Bottom Footer Badge
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "CHAYAONE LOCAL-FIRST RESTAURANT TERMINAL",
                        color = Color(0xFF475569),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Ultra-Fast Offline Engine · Auto Sync & Cache Protected",
                        color = Color(0xFF334155),
                        fontSize = 10.sp
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WaiterWebViewScreen(
    url: String,
    serverIp: String,
    serverPort: String,
    userName: String,
    onOpenSettings: () -> Unit
) {
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var loadProgress by remember { mutableIntStateOf(0) }
    var connectionError by remember { mutableStateOf<String?>(null) }

    BackHandler(enabled = webViewInstance?.canGoBack() == true) {
        webViewInstance?.goBack()
    }

    Box(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        cacheMode = WebSettings.LOAD_DEFAULT
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        setSupportZoom(false)
                        builtInZoomControls = false
                        displayZoomControls = false
                        mediaPlaybackRequiresUserGesture = false
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    }

                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

                    val activity = ctx as? Activity ?: (ctx as? android.content.ContextWrapper)?.baseContext as? Activity
                    if (activity != null) {
                        addJavascriptInterface(
                            AndroidBridge(
                                activity = activity,
                                onOpenSettings = onOpenSettings,
                                onClearCache = {
                                    autoCleanCache(ctx, this)
                                    Toast.makeText(ctx, "Cache cleaned successfully!", Toast.LENGTH_SHORT).show()
                                },
                                serverIp = serverIp,
                                serverPort = serverPort
                            ),
                            "AndroidBridge"
                        )
                    }

                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                            isLoading = true
                            connectionError = null
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            isLoading = false
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            if (request?.isForMainFrame == true) {
                                isLoading = false
                                connectionError = "Cannot reach Main PC at $serverIp:$serverPort.\n1. Check if tablet is connected to shop Wi-Fi (not 5G Mobile Data).\n2. Verify ChayaOne OS is running on the Main PC."
                                // Prevent Android's default white error page
                                view?.loadUrl("about:blank")
                            }
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                            loadProgress = newProgress
                            if (newProgress == 100) isLoading = false
                        }
                    }

                    webViewInstance = this
                    loadUrl(url)
                }
            },
            update = { view ->
                webViewInstance = view
            }
        )

        // Loading indicator
        if (isLoading && loadProgress < 100) {
            LinearProgressIndicator(
                progress = { loadProgress / 100f },
                modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                color = MaterialTheme.colorScheme.primary,
            )
        }

        // Custom in-app Offline Overlay (Replaces Android's native white net::ERR error screen)
        AnimatedVisibility(
            visible = connectionError != null,
            modifier = Modifier.fillMaxSize()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF0F172A)),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier.padding(24.dp).fillMaxWidth(0.9f),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "⚠️", fontSize = 42.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Main PC Not Reachable",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = connectionError ?: "",
                            color = Color(0xFF94A3B8),
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = onOpenSettings,
                                modifier = Modifier.weight(1f).height(46.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF38BDF8))
                            ) {
                                Text("Reconfigure IP")
                            }
                            Button(
                                onClick = {
                                    connectionError = null
                                    isLoading = true
                                    webViewInstance?.loadUrl(url)
                                },
                                modifier = Modifier.weight(1f).height(46.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
                            ) {
                                Text("Retry")
                            }
                        }
                    }
                }
            }
        }
    }
}
