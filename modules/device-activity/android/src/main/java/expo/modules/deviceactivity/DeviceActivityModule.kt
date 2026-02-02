package expo.modules.deviceactivity

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class DeviceActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceActivity")

    Function("getUsageStats") { startTime: Double, endTime: Double ->
      val context = context
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val queryUsageStats = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTime.toLong(),
        endTime.toLong()
      )

      val result = mutableListOf<Map<String, Any>>()
      if (queryUsageStats != null) {
        for (usageStats in queryUsageStats) {
          if (usageStats.totalTimeInForeground > 0) {
            result.add(mapOf(
              "packageName" to usageStats.packageName,
              "totalTimeInForeground" to usageStats.totalTimeInForeground,
              "lastTimeUsed" to usageStats.lastTimeUsed
            ))
          }
        }
      }
      return@Function result
    }

    Function("hasUsagePermission") {
      val context = context
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
      return@Function mode == AppOpsManager.MODE_ALLOWED
    }

    Function("requestUsagePermission") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private val context
    get() = requireNotNull(appContext.reactContext) { "React Application Context is null" }
}
