package com.chayaone.waiter

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.net.wifi.WifiManager
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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
import com.chayaone.waiter.theme.*
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL

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

        val keepAwake = prefs.getBoolean(KEY_KEEP_AWAKE, true)
        if (keepAwake) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        setContent {
            ChayaOneWaiterTheme {
                WaiterAppRoot(
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
                    errorMessage = "Cannot reach ChayaOne Server at $cleanIp:$cleanPort.\nPlease check Wi-Fi connection and that the POS PC is running."
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
            val subnet = getLocalSubnetPrefix(context)
            val discovered = mutableListOf<String>()

            if (subnet != null) {
                val candidateIps = (1..254).map { "$subnet$it" }
                val ports = listOf("3000", "3002")
                var checked = 0
                val totalChecks = candidateIps.size

                val chunks = candidateIps.chunked(25)
                for (chunk in chunks) {
                    val jobs = chunk.map { host ->
                        async {
                            for (p in ports) {
                                if (probeHttp("http://$host:$p/api/server/info", 600)) {
                                    synchronized(discovered) {
                                        discovered.add("$host:$p")
                                    }
                                }
                            }
                        }
                    }
                    jobs.awaitAll()
                    checked += chunk.size
                    withContext(Dispatchers.Main) {
                        scanProgress = checked.toFloat() / totalChecks.toFloat()
                        foundServers = discovered.toList()
                    }
                }
            }

            withContext(Dispatchers.Main) {
                isScanning = false
                if (discovered.isNotEmpty()) {
                    val first = discovered.first()
                    val parts = first.split(":")
                    serverIp = parts[0]
                    serverPort = parts.getOrElse(1) { "3000" }
                    Toast.makeText(context, "Found ChayaOne Server at $first!", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "No ChayaOne Server found on local Wi-Fi. Enter IP manually.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    // Initial check on app startup
    LaunchedEffect(Unit) {
        if (fullUrl.isNotBlank() && serverIp.isNotBlank()) {
            testAndConnect(serverIp, serverPort, fullUrl)
        } else {
            screenState = ScreenState.SETUP
        }
    }

    // Back handler for WebView navigation
    BackHandler(enabled = screenState == ScreenState.WEBVIEW) {
        if (activeWebView?.canGoBack() == true) {
            activeWebView?.goBack()
        } else {
            if (backPressedOnce) {
                (context as? ComponentActivity)?.finish()
            } else {
                backPressedOnce = true
                Toast.makeText(context, "Press back again to exit ChayaOne", Toast.LENGTH_SHORT).show()
                coroutineScope.launch {
                    delay(2000)
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
                    onScan = { startAutoScan() }
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
                                trackColor = ChayaEspresso,
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
                                        text = errorMessage,
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = ChayaMuted,
                                        textAlign = TextAlign.Center,
                                        fontSize = 14.sp
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = { screenState = ScreenState.SETUP },
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ChayaPaper)
                                        ) {
                                            Text("Change IP")
                                        }
                                        Button(
                                            onClick = { testAndConnect(serverIp, serverPort, fullUrl) },
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
    onScan: () -> Unit
) {
    val focusManager = LocalFocusManager.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 440.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Header with luxury badge
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(ChayaCard)
                        .border(1.dp, ChayaBorder, RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "☕",
                        fontSize = 36.sp
                    )
                }

                Text(
                    text = "ChayaOne Waiter",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color = ChayaGold
                )

                Text(
                    text = "Connect to Main POS on your Café Wi-Fi",
                    fontSize = 14.sp,
                    color = ChayaMuted,
                    textAlign = TextAlign.Center
                )
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
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
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
                                    border = androidx.compose.foundation.BorderStroke(1.dp, ChayaBorder),
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
