import ExpoModulesCore
import FamilyControls
import DeviceActivity
import ManagedSettings
import SwiftUI

// Screen Time authorization status
enum ScreenTimeAuthStatus: String {
    case notDetermined = "notDetermined"
    case approved = "approved"
    case denied = "denied"
}

// App Group identifier shared with extensions
private let kAppGroupID = "group.com.zenyth.ai"
private let kWeeklyDataKey = "weekly_screen_time_data"
private let kTodayDataPrefix = "today_screen_time_"
private let kMonitoringStartedKey = "monitoring_started_at"
private let kTopAppsKey = "top_apps_data"

// Codable model matching ScreenTimeShared.swift in extensions
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

    // Allow partial decoding for backward compat
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try c.decode(String.self, forKey: .date)
        totalSeconds = try c.decode(Int.self, forKey: .totalSeconds)
        socialMediaSeconds = (try? c.decode(Int.self, forKey: .socialMediaSeconds)) ?? 0
        entertainmentSeconds = (try? c.decode(Int.self, forKey: .entertainmentSeconds)) ?? 0
        productivitySeconds = (try? c.decode(Int.self, forKey: .productivitySeconds)) ?? 0
        gamesSeconds = (try? c.decode(Int.self, forKey: .gamesSeconds)) ?? 0
        otherSeconds = (try? c.decode(Int.self, forKey: .otherSeconds)) ?? 0
        pickupCount = (try? c.decode(Int.self, forKey: .pickupCount)) ?? 0
        notificationCount = (try? c.decode(Int.self, forKey: .notificationCount)) ?? 0
    }
}

struct StoredAppUsage: Codable {
    let bundleId: String
    let appName: String
    let totalTimeSeconds: Int
    let category: String
}

// App usage data structure exposed to JS
struct AppUsageData: Record {
    @Field var bundleId: String = ""
    @Field var appName: String = ""
    @Field var totalTimeSeconds: Int = 0
    @Field var category: String = ""
    @Field var lastUsedTimestamp: Double = 0
}

// Daily usage summary exposed to JS
struct DailyUsageSummary: Record {
    @Field var date: String = ""
    @Field var totalScreenTimeSeconds: Int = 0
    @Field var socialMediaSeconds: Int = 0
    @Field var entertainmentSeconds: Int = 0
    @Field var productivitySeconds: Int = 0
    @Field var gamesSeconds: Int = 0
    @Field var otherSeconds: Int = 0
    @Field var pickupCount: Int = 0
    @Field var notificationCount: Int = 0
}

@available(iOS 16.0, *)
public class DeviceActivityModule: Module {
    private let authorizationCenter = AuthorizationCenter.shared

    required public init(appContext: AppContext) {
        super.init(appContext: appContext)
        print("DeviceActivityModule: Initialized")
    }

    public func definition() -> ModuleDefinition {
        Name("DeviceActivity")

        // MARK: - Authorization

        Function("getAuthorizationStatus") { () -> String in
            switch self.authorizationCenter.authorizationStatus {
            case .notDetermined:
                return ScreenTimeAuthStatus.notDetermined.rawValue
            case .approved:
                return ScreenTimeAuthStatus.approved.rawValue
            case .denied:
                return ScreenTimeAuthStatus.denied.rawValue
            @unknown default:
                return ScreenTimeAuthStatus.notDetermined.rawValue
            }
        }

        AsyncFunction("requestAuthorization") { () async -> Bool in
            print("DeviceActivityModule: Requesting Screen Time authorization...")
            do {
                try await Task { @MainActor in
                    try await self.authorizationCenter.requestAuthorization(for: .individual)
                }.value
                print("DeviceActivityModule: Authorization approved by user")
                return true
            } catch {
                print("DeviceActivityModule: Authorization failed: \(error.localizedDescription)")
                return false
            }
        }

        Function("isAuthorized") { () -> Bool in
            return self.authorizationCenter.authorizationStatus == .approved
        }

        // MARK: - Usage Data (reads from App Groups written by ScreenTimeReport extension)

        AsyncFunction("getTodayUsageSummary") { (promise: Promise) in
            Task {
                let summary = self.readTodayUsage()
                promise.resolve(summary)
            }
        }

        AsyncFunction("getUsageForDateRange") { (startTimestamp: Double, endTimestamp: Double, promise: Promise) in
            Task {
                let startDate = Date(timeIntervalSince1970: startTimestamp / 1000)
                let endDate = Date(timeIntervalSince1970: endTimestamp / 1000)
                let usage = self.readUsageForRange(start: startDate, end: endDate)
                promise.resolve(usage)
            }
        }

        AsyncFunction("getTopApps") { (limit: Int, promise: Promise) in
            Task {
                let apps = self.readTopApps(limit: limit)
                promise.resolve(apps)
            }
        }

        // MARK: - App Limits

        AsyncFunction("setCategoryLimit") { (category: String, limitSeconds: Int, promise: Promise) in
            Task {
                let store = ManagedSettingsStore()
                _ = store
                promise.resolve(true)
            }
        }

        AsyncFunction("clearAllLimits") { (promise: Promise) in
            Task {
                let store = ManagedSettingsStore()
                store.clearAllSettings()
                promise.resolve(true)
            }
        }

        // MARK: - Weekly Stats

        AsyncFunction("getWeeklyStats") { (promise: Promise) in
            Task {
                let calendar = Calendar.current
                let today = Date()
                let weekAgo = calendar.date(byAdding: .day, value: -6, to: today) ?? today
                let stats = self.readUsageForRange(start: weekAgo, end: today)
                promise.resolve(stats)
            }
        }

        // MARK: - Monitoring Setup

        AsyncFunction("setupMonitoring") { (promise: Promise) in
            Task {
                let center = DeviceActivityCenter()
                let schedule = DeviceActivitySchedule(
                    intervalStart: DateComponents(hour: 0, minute: 0, second: 0),
                    intervalEnd: DateComponents(hour: 23, minute: 59, second: 59),
                    repeats: true
                )
                do {
                    try center.startMonitoring(
                        DeviceActivityName("com.zenyth.daily.tracking"),
                        during: schedule
                    )
                    // Record monitoring start time
                    if let shared = UserDefaults(suiteName: kAppGroupID) {
                        if shared.double(forKey: kMonitoringStartedKey) == 0 {
                            shared.set(Date().timeIntervalSince1970, forKey: kMonitoringStartedKey)
                        }
                        shared.synchronize()
                    }
                    print("DeviceActivityModule: Daily monitoring schedule started")
                    promise.resolve(true)
                } catch {
                    print("DeviceActivityModule: startMonitoring failed: \(error.localizedDescription)")
                    promise.resolve(false)
                }
            }
        }

        Function("getMonitoringStartedAt") { () -> Double in
            guard let shared = UserDefaults(suiteName: kAppGroupID) else { return 0 }
            return shared.double(forKey: kMonitoringStartedKey)
        }

        // Force the DeviceActivityReport extension to run and refresh App Groups data.
        // Creates a hidden DeviceActivityReport SwiftUI view, causing makeConfiguration to fire.
        AsyncFunction("triggerReportUpdate") { (promise: Promise) in
            Task { @MainActor in
                guard self.authorizationCenter.authorizationStatus == .approved else {
                    print("DeviceActivityModule: triggerReportUpdate skipped — not authorized")
                    promise.resolve(false)
                    return
                }

                let filter = DeviceActivityFilter(
                    segment: .daily(
                        during: Calendar.current.dateInterval(of: .day, for: Date()) ?? DateInterval()
                    )
                )
                let context = DeviceActivityReport.Context(rawValue: "TotalActivity")
                let reportView = DeviceActivityReport(context, filter: filter)

                // Embed in a UIHostingController to trigger the extension render pipeline
                let hostingController = UIHostingController(rootView: reportView)
                hostingController.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
                hostingController.view.isHidden = true

                if let keyWindow = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .flatMap({ $0.windows })
                    .first(where: { $0.isKeyWindow }) {
                    keyWindow.addSubview(hostingController.view)

                    // Give the extension time to run makeConfiguration and write to App Groups
                    try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
                    hostingController.view.removeFromSuperview()
                    print("DeviceActivityModule: triggerReportUpdate completed")
                    promise.resolve(true)
                } else {
                    print("DeviceActivityModule: triggerReportUpdate — no key window")
                    promise.resolve(false)
                }
            }
        }
    }

    // MARK: - Private Helpers — Read from App Groups

    private func sharedDefaults() -> UserDefaults? {
        return UserDefaults(suiteName: kAppGroupID)
    }

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()

    /// Reads today's screen time data written by the ScreenTimeReport extension
    private func readTodayUsage() -> DailyUsageSummary {
        let todayStr = dateFormatter.string(from: Date())
        let key = "\(kTodayDataPrefix)\(todayStr)"

        if let defaults = sharedDefaults(),
           let rawData = defaults.data(forKey: key),
           let stored = try? JSONDecoder().decode(StoredDailyUsage.self, from: rawData) {
            print("DeviceActivityModule: Read today data from App Groups — \(stored.totalSeconds)s")
            var summary = DailyUsageSummary()
            summary.date = stored.date
            summary.totalScreenTimeSeconds = stored.totalSeconds
            summary.socialMediaSeconds = stored.socialMediaSeconds
            summary.entertainmentSeconds = stored.entertainmentSeconds
            summary.productivitySeconds = stored.productivitySeconds
            summary.gamesSeconds = stored.gamesSeconds
            summary.otherSeconds = stored.otherSeconds
            summary.pickupCount = stored.pickupCount
            summary.notificationCount = stored.notificationCount
            return summary
        }

        print("DeviceActivityModule: No today data in App Groups for \(todayStr)")
        var summary = DailyUsageSummary()
        summary.date = todayStr
        summary.totalScreenTimeSeconds = 0
        return summary
    }

    /// Reads weekly data written by the ScreenTimeReport extension
    private func readUsageForRange(start: Date, end: Date) -> [DailyUsageSummary] {
        guard let defaults = sharedDefaults(),
              let rawData = defaults.data(forKey: kWeeklyDataKey),
              let stored = try? JSONDecoder().decode([StoredDailyUsage].self, from: rawData) else {
            print("DeviceActivityModule: No weekly data in App Groups")
            return []
        }

        let startStr = dateFormatter.string(from: start)
        let endStr = dateFormatter.string(from: end)
        let filtered = stored.filter { $0.date >= startStr && $0.date <= endStr }

        print("DeviceActivityModule: Read \(filtered.count) days from App Groups (range \(startStr)...\(endStr))")

        return filtered.map { item in
            var summary = DailyUsageSummary()
            summary.date = item.date
            summary.totalScreenTimeSeconds = item.totalSeconds
            summary.socialMediaSeconds = item.socialMediaSeconds
            summary.entertainmentSeconds = item.entertainmentSeconds
            summary.productivitySeconds = item.productivitySeconds
            summary.gamesSeconds = item.gamesSeconds
            summary.otherSeconds = item.otherSeconds
            summary.pickupCount = item.pickupCount
            summary.notificationCount = item.notificationCount
            return summary
        }
    }

    /// Reads top apps data written by the ScreenTimeReport extension
    private func readTopApps(limit: Int) -> [AppUsageData] {
        guard let defaults = sharedDefaults(),
              let rawData = defaults.data(forKey: kTopAppsKey),
              let stored = try? JSONDecoder().decode([StoredAppUsage].self, from: rawData) else {
            print("DeviceActivityModule: No top apps data in App Groups")
            return []
        }

        let limitedApps = Array(stored.prefix(limit))
        print("DeviceActivityModule: Read \(limitedApps.count) top apps from App Groups")

        return limitedApps.map { item in
            var app = AppUsageData()
            app.bundleId = item.bundleId
            app.appName = item.appName
            app.totalTimeSeconds = item.totalTimeSeconds
            app.category = item.category
            return app
        }
    }
}
