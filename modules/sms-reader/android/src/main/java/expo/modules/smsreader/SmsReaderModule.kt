package expo.modules.smsreader

import android.content.Context
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Function("getAllSms") { limit: Int ->
      val result = mutableListOf<Map<String, Any>>()
      val context = context
      val cr = context.contentResolver
      val cursor = cr.query(
        Uri.parse("content://sms/inbox"),
        null,
        null,
        null,
        "date DESC"
      )

      if (cursor != null && cursor.moveToFirst()) {
        var count = 0
        val bodyIndex = cursor.getColumnIndex("body")
        val addressIndex = cursor.getColumnIndex("address")
        val dateIndex = cursor.getColumnIndex("date")

        do {
          if (bodyIndex != -1 && addressIndex != -1 && dateIndex != -1) {
             result.add(mapOf(
              "body" to cursor.getString(bodyIndex),
              "address" to cursor.getString(addressIndex),
              "date" to cursor.getLong(dateIndex)
            ))
            count++
          }
        } while (cursor.moveToNext() && count < limit)
        cursor.close()
      }
      return@Function result
    }
  }

  private val context
    get() = requireNotNull(appContext.reactContext) { "React Application Context is null" }
}
