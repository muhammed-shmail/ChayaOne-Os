package com.chayaone.waiter.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = ChayaGold,
    onPrimary = ChayaEspresso,
    primaryContainer = ChayaCard,
    onPrimaryContainer = ChayaGold,
    secondary = ChayaGoldDark,
    onSecondary = ChayaPaper,
    background = ChayaEspresso,
    onBackground = ChayaPaper,
    surface = ChayaCard,
    onSurface = ChayaPaper,
    surfaceVariant = ChayaBorder,
    onSurfaceVariant = ChayaMuted,
    outline = ChayaBorder
)

@Composable
fun ChayaOneWaiterTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
