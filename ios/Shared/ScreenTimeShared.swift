import Foundation

// MARK: - App Group Constants
let kAppGroupID = "group.com.zenyth.ai"
let kWeeklyDataKey = "weekly_screen_time_data"
let kTodayDataPrefix = "today_screen_time_"
let kMonitoringStartedKey = "monitoring_started_at"
let kTopAppsKey = "top_apps_data"
let kLastUpdateKey = "last_screen_time_update"

// MARK: - Shared Data Models

struct StoredDailyUsage: Codable {
    let date: String
    let totalSeconds: Int
    let socialMediaSeconds: Int
    let entertainmentSeconds: Int
    let productivitySeconds: Int
    let gamesSeconds: Int
    let otherSeconds: Int
    let pickupCount: Int
    let notificationCount: Int

    init(
        date: String,
        totalSeconds: Int,
        socialMediaSeconds: Int = 0,
        entertainmentSeconds: Int = 0,
        productivitySeconds: Int = 0,
        gamesSeconds: Int = 0,
        otherSeconds: Int = 0,
        pickupCount: Int = 0,
        notificationCount: Int = 0
    ) {
        self.date = date
        self.totalSeconds = totalSeconds
        self.socialMediaSeconds = socialMediaSeconds
        self.entertainmentSeconds = entertainmentSeconds
        self.productivitySeconds = productivitySeconds
        self.gamesSeconds = gamesSeconds
        self.otherSeconds = otherSeconds
        self.pickupCount = pickupCount
        self.notificationCount = notificationCount
    }
}

struct StoredAppUsage: Codable {
    let bundleId: String
    let appName: String
    let totalTimeSeconds: Int
    let category: String

    init(bundleId: String, appName: String, totalTimeSeconds: Int, category: String = "other") {
        self.bundleId = bundleId
        self.appName = appName
        self.totalTimeSeconds = totalTimeSeconds
        self.category = category
    }
}

// MARK: - App Group Helper

class ScreenTimeSharedDefaults {
    static let shared = ScreenTimeSharedDefaults()
    private let defaults: UserDefaults?

    private init() {
        defaults = UserDefaults(suiteName: kAppGroupID)
    }

    // MARK: - Date Formatter
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()

    func todayString() -> String {
        dateFormatter.string(from: Date())
    }

    // MARK: - Write Methods

    func saveTodayUsage(_ usage: StoredDailyUsage) {
        guard let data = try? JSONEncoder().encode(usage) else { return }
        defaults?.set(data, forKey: "\(kTodayDataPrefix)\(usage.date)")
        defaults?.set(Date().timeIntervalSince1970, forKey: kLastUpdateKey)
        defaults?.synchronize()
        print("[ScreenTimeShared] Saved today usage: \(usage.totalSeconds)s for \(usage.date)")
    }

    func saveWeeklyData(_ dailyUsages: [StoredDailyUsage]) {
        guard let data = try? JSONEncoder().encode(dailyUsages) else { return }
        defaults?.set(data, forKey: kWeeklyDataKey)
        defaults?.synchronize()
        print("[ScreenTimeShared] Saved weekly data: \(dailyUsages.count) days")
    }

    func saveTopApps(_ apps: [StoredAppUsage]) {
        guard let data = try? JSONEncoder().encode(apps) else { return }
        defaults?.set(data, forKey: kTopAppsKey)
        defaults?.synchronize()
        print("[ScreenTimeShared] Saved \(apps.count) top apps")
    }

    func setMonitoringStarted() {
        guard let defaults = defaults else { return }
        if defaults.double(forKey: kMonitoringStartedKey) == 0 {
            defaults.set(Date().timeIntervalSince1970, forKey: kMonitoringStartedKey)
            defaults.synchronize()
        }
    }

    // MARK: - Read Methods

    func getTodayUsage() -> StoredDailyUsage? {
        let key = "\(kTodayDataPrefix)\(todayString())"
        guard let data = defaults?.data(forKey: key),
              let usage = try? JSONDecoder().decode(StoredDailyUsage.self, from: data) else {
            return nil
        }
        return usage
    }

    func getWeeklyData() -> [StoredDailyUsage] {
        guard let data = defaults?.data(forKey: kWeeklyDataKey),
              let usages = try? JSONDecoder().decode([StoredDailyUsage].self, from: data) else {
            return []
        }
        return usages
    }

    func getTopApps() -> [StoredAppUsage] {
        guard let data = defaults?.data(forKey: kTopAppsKey),
              let apps = try? JSONDecoder().decode([StoredAppUsage].self, from: data) else {
            return []
        }
        return apps
    }

    func getMonitoringStartedAt() -> Double {
        return defaults?.double(forKey: kMonitoringStartedKey) ?? 0
    }

    func getLastUpdate() -> Double {
        return defaults?.double(forKey: kLastUpdateKey) ?? 0
    }
}
