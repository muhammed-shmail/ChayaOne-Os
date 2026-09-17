package com.example.chayaonewaiter

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
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
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        val prefs = getSharedPreferences("chayaone_waiter_prefs", Context.MODE_PRIVATE)

        var ip = data.getQueryParameter("ip") ?: data.getQueryParameter("server")
        val port = data.getQueryParameter("port") ?: (if (data.port > 0) data.port.toString() else null)
        val user = data.getQueryParameter("user")
        val path = data.getQueryParameter("path") ?: (if (port == "3000") "/pos" else "/login")

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
    var serverPort by remember { mutableStateOf(prefs.getString("server_port", "3002") ?: "3002") }
    var serverPath by remember { mutableStateOf(prefs.getString("server_path", "/login") ?: "/login") }
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
    var tempPort by remember { mutableStateOf(if (initialPort.isBlank()) "3002" else initialPort) }
    var tempPath by remember { mutableStateOf(if (initialPath.isBlank()) "/login" else initialPath) }
    var tempUser by remember { mutableStateOf(initialUser) }

    var qrPasteInput by remember { mutableStateOf("") }
    var testStatus by remember { mutableStateOf<String?>(null) }
    var isTesting by remember { mutableStateOf(false) }

    fun parseAndApplyUrl(raw: String) {
        try {
            val trimmed = raw.trim()
            if (trimmed.contains("://") || trimmed.contains("?")) {
                val uri = Uri.parse(trimmed)
                val qIp = uri.getQueryParameter("ip") ?: uri.getQueryParameter("server") ?: uri.host
                val qPort = uri.getQueryParameter("port") ?: (if (uri.port > 0) uri.port.toString() else null)
                val qUser = uri.getQueryParameter("user")
                val qPath = uri.getQueryParameter("path") ?: uri.path

                if (!qIp.isNullOrBlank()) tempIp = qIp
                if (!qPort.isNullOrBlank()) tempPort = qPort
                if (!qUser.isNullOrBlank()) tempUser = qUser
                if (!qPath.isNullOrBlank() && qPath != "/") tempPath = qPath
                testStatus = "Parsed QR code successfully! Test ping or tap Connect."
            } else if (trimmed.contains(":")) {
                val parts = trimmed.split(":")
                if (parts.isNotEmpty()) tempIp = parts[0].trim()
                if (parts.size > 1) tempPort = parts[1].trim()
            } else if (trimmed.isNotBlank()) {
                tempIp = trimmed
            }
        } catch (e: Exception) {
            testStatus = "Could not parse QR: ${e.message}"
        }
    }

    // Official Camera QR Scanner launcher using ZXing
    val qrScanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val scanned = result.contents
        if (!scanned.isNullOrBlank()) {
            parseAndApplyUrl(scanned)
            Toast.makeText(context, "QR Code scanned!", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        containerColor = Color(0xFF0B1120),
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "ChayaOne Waiter",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFF0284C7).copy(alpha = 0.25f)
                        ) {
                            Text(
                                text = "v1.1.0",
                                color = Color(0xFF38BDF8),
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0F172A))
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // CRITICAL Wi-Fi Notice Banner (Solves 5G cellular disconnection)
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF451A03).copy(alpha = 0.8f)),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD97706).copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Text(text = "⚠️", fontSize = 22.sp, modifier = Modifier.padding(end = 12.dp))
                    Column {
                        Text(
                            text = "Connect to Shop Wi-Fi Required",
                            color = Color(0xFFFDE68A),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Ensure this device is connected to the same Wi-Fi network as the Main PC. If your phone is using Mobile Data (5G/4G), turn off Mobile Data or connect to Wi-Fi to reach the desktop server.",
                            color = Color(0xFFFCD34D),
                            fontSize = 12.sp,
                            lineHeight = 17.sp
                        )
                    }
                }
            }

            // Option 1: Live Camera QR Scan
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "1. Scan Server QR Code",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Open Settings → App QRs on the Main PC desktop and scan the Waiter Tablet QR.",
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            val options = ScanOptions().apply {
                                setPrompt("Align camera with QR code on Main PC desktop screen")
                                setBeepEnabled(true)
                                setOrientationLocked(false)
                                setBarcodeImageEnabled(false)
                            }
                            qrScanLauncher.launch(options)
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("📷  Open Camera QR Scanner", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Paste QR Textfield
                    OutlinedTextField(
                        value = qrPasteInput,
                        onValueChange = {
                            qrPasteInput = it
                            parseAndApplyUrl(it)
                        },
                        label = { Text("Or Paste QR URL / Deep Link", fontSize = 12.sp) },
                        placeholder = { Text("http://10.52.85.152:3002/login...", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF38BDF8),
                            unfocusedBorderColor = Color(0xFF475569),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }
            }

            // Option 2: Manual IP Entry
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "2. Manual IP & Port Entry",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Enter the local Wi-Fi IP address shown on the ChayaOne desktop window.",
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = tempIp,
                        onValueChange = { tempIp = it.trim() },
                        label = { Text("Main PC Wi-Fi IP Address", fontSize = 12.sp) },
                        placeholder = { Text("e.g. 10.52.85.152 or 192.168.1.100", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF38BDF8),
                            unfocusedBorderColor = Color(0xFF475569),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
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
                            placeholder = { Text("3002", fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF38BDF8),
                                unfocusedBorderColor = Color(0xFF475569),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            )
                        )

                        OutlinedTextField(
                            value = tempUser,
                            onValueChange = { tempUser = it.trim() },
                            label = { Text("Staff Name (Optional)", fontSize = 12.sp) },
                            placeholder = { Text("e.g. Waiter 1", fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.weight(1.5f),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF38BDF8),
                                unfocusedBorderColor = Color(0xFF475569),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Quick Port Switcher Presets
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        AssistChip(
                            onClick = {
                                tempPort = "3002"
                                tempPath = "/login"
                            },
                            label = { Text("Port 3002 (Waiter Tablet)") },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (tempPort == "3002") Color(0xFF0369A1) else Color(0xFF0F172A),
                                labelColor = Color.White
                            )
                        )
                        AssistChip(
                            onClick = {
                                tempPort = "3000"
                                tempPath = "/pos"
                            },
                            label = { Text("Port 3000 (Main POS)") },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (tempPort == "3000") Color(0xFF0369A1) else Color(0xFF0F172A),
                                labelColor = Color.White
                            )
                        )
                    }
                }
            }

            // Connection Test (Ping) & Launch
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    testStatus?.let { status ->
                        val isSuccess = status.startsWith("Connected") || status.startsWith("Parsed")
                        Text(
                            text = status,
                            color = if (isSuccess) Color(0xFF4ADE80) else Color(0xFFF87171),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Spacer(modifier = Modifier.height(12.dp))
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
                                            // Fallback probe root
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
                                        "Could not reach server at $tempIp:$tempPort. Verify tablet is on the same Wi-Fi and ChayaOne is running on the Main PC."
                                    }
                                }
                            },
                            enabled = !isTesting,
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF38BDF8))
                        ) {
                            Text(if (isTesting) "Pinging..." else "🔍 Test Ping")
                        }

                        Button(
                            onClick = {
                                if (tempIp.isBlank()) {
                                    testStatus = "Main PC IP address is required."
                                    return@Button
                                }
                                onConnected(tempIp, tempPort, tempPath, tempUser)
                            },
                            modifier = Modifier.weight(1.3f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
                        ) {
                            Text("Connect & Start", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    if (canCancel) {
                        Spacer(modifier = Modifier.height(10.dp))
                        TextButton(
                            onClick = onCancel,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Cancel & Return to App", color = Color(0xFF94A3B8))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
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

        // Top-right floating status pill
        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color.Black.copy(alpha = 0.8f))
                .clickable { onOpenSettings() }
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (connectionError == null) Color(0xFF22C55E) else Color(0xFFEF4444))
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = if (userName.isNotBlank()) "$serverIp:$serverPort ($userName)" else "$serverIp:$serverPort",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "⚙️",
                fontSize = 11.sp
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
