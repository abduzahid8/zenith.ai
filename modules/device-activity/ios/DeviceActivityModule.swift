import ExpoModulesCore
import FamilyControls
import DeviceActivity
import ManagedSettings

// Screen Time authorization status
enum ScreenTimeAuthStatus: String {
    case notDetermined = "notDetermined"
    case approved = "approved"
    case denied = "denied"
}

// Codable model for App Groups shared container
struct StoredDailyUsage: Codable {
    let date: String
    let totalSeconds: Int
}

// App Group identifier shared with DeviceActivityReport extension
private let kAppGroupID = "group.com.zenyth.ai"
private let kWeeklyDataKey = "weekly_screen_time_data"
private let kMonitoringStartedKey = "monitoring_started_at"

// App usage data structure
struct AppUsageData: Record {
    @Field
    var bundleId: String = ""
    
    @Field
    var appName: String = ""
    
    @Field
    var totalTimeSeconds: Int = 0
    
    @Field
    var category: String = ""
    
    @Field
    var lastUsedTimestamp: Double = 0
}

// Daily usage summary
struct DailyUsageSummary: Record {
    @Field
    var date: String = ""
    
    @Field
    var totalScreenTimeSeconds: Int = 0
    
    @Field
    var socialMediaSeconds: Int = 0
    
    @Field
    var entertainmentSeconds: Int = 0
    
    @Field
    var productivitySeconds: Int = 0
    
    @Field
    var gamesSeconds: Int = 0
    
    @Field
    var otherSeconds: Int = 0
    
    @Field
    var pickupCount: Int = 0
    
    @Field
    var notificationCount: Int = 0
}

@available(iOS 16.0, *)
public class DeviceActivityModule: Module {
    // Authorization center for FamilyControls
    private let authorizationCenter = AuthorizationCenter.shared
    
    required public init(appContext: AppContext) {
        super.init(appContext: appContext)
        print("DeviceActivityModule: Initialized")
    }
    
    public func definition() -> ModuleDefinition {
        Name("DeviceActivity")
        
        // MARK: - Authorization Functions
        
        // Check current authorization status
        Function("getAuthorizationStatus") { () -> String in
            if #available(iOS 16.0, *) {
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
            } else {
                // iOS 15 doesn't have authorizationStatus property
                return ScreenTimeAuthStatus.notDetermined.rawValue
            }
        }
        
        // Request Screen Time authorization
        AsyncFunction("requestAuthorization") { () async -> Bool in
            print("DeviceActivityModule: Requesting Screen Time authorization...")
            do {
                // requestAuthorization(for:) is @MainActor — must be dispatched there
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
        
        // Check if authorized
        Function("isAuthorized") { () -> Bool in
            if #available(iOS 16.0, *) {
                return self.authorizationCenter.authorizationStatus == .approved
            }
            // For iOS 15, we can try to access and catch error
            return false
        }
        
        // MARK: - Usage Data Functions
        
        // Get today's screen time summary
        AsyncFunction("getTodayUsageSummary") { (promise: Promise) in
            Task {
                do {
                    let summary = try await self.fetchTodayUsage()
                    promise.resolve(summary)
                } catch {
                    promise.reject("USAGE_ERROR", "Failed to fetch usage data: \(error.localizedDescription)")
                }
            }
        }
        
        // Get usage for a specific date range
        AsyncFunction("getUsageForDateRange") { (startTimestamp: Double, endTimestamp: Double, promise: Promise) in
            Task {
                do {
                    let startDate = Date(timeIntervalSince1970: startTimestamp / 1000)
                    let endDate = Date(timeIntervalSince1970: endTimestamp / 1000)
                    let usage = try await self.fetchUsageForRange(start: startDate, end: endDate)
                    promise.resolve(usage)
                } catch {
                    promise.reject("USAGE_ERROR", "Failed to fetch usage data: \(error.localizedDescription)")
                }
            }
        }
        
        // Get top apps by usage time
        AsyncFunction("getTopApps") { (limit: Int, promise: Promise) in
            Task {
                do {
                    let apps = try await self.fetchTopApps(limit: limit)
                    promise.resolve(apps)
                } catch {
                    promise.reject("USAGE_ERROR", "Failed to fetch top apps: \(error.localizedDescription)")
                }
            }
        }
        
        // MARK: - App Limits Functions
        
        // Set time limit for specific app category
        AsyncFunction("setCategoryLimit") { (category: String, limitSeconds: Int, promise: Promise) in
            Task {
                do {
                    try await self.setLimitForCategory(category: category, seconds: limitSeconds)
                    promise.resolve(true)
                } catch {
                    promise.reject("LIMIT_ERROR", "Failed to set category limit: \(error.localizedDescription)")
                }
            }
        }
        
        // Remove all limits
        AsyncFunction("clearAllLimits") { (promise: Promise) in
            Task {
                do {
                    try await self.removeAllLimits()
                    promise.resolve(true)
                } catch {
                    promise.reject("LIMIT_ERROR", "Failed to clear limits: \(error.localizedDescription)")
                }
            }
        }
        
        // MARK: - Weekly Stats
        
        // Get weekly usage statistics
        AsyncFunction("getWeeklyStats") { (promise: Promise) in
            Task {
                do {
                    let stats = try await self.fetchWeeklyStats()
                    promise.resolve(stats)
                } catch {
                    promise.reject("STATS_ERROR", "Failed to fetch weekly stats: \(error.localizedDescription)")
                }
            }
        }
        
        // MARK: - Monitoring Setup
        
        // Start DeviceActivityCenter daily monitoring schedule
        // Also records the monitoring start time so the app knows tracking is active
        AsyncFunction("setupMonitoring") { (promise: Promise) in
            Task {
                if #available(iOS 16.0, *) {
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
                        // Record monitoring start time so JS side knows when tracking began
                        if let shared = UserDefaults(suiteName: kAppGroupID) {
                            if shared.double(forKey: kMonitoringStartedKey) == 0 {
                                shared.set(Date().timeIntervalSince1970, forKey: kMonitoringStartedKey)
                            }
                        }
                        print("DeviceActivityModule: Daily monitoring schedule started")
                        promise.resolve(true)
                    } catch {
                        print("DeviceActivityModule: startMonitoring failed: \(error.localizedDescription)")
                        // Not a fatal error — schedule may already be active
                        promise.resolve(false)
                    }
                } else {
                    promise.resolve(false)
                }
            }
        }
        
        // Returns ISO timestamp (seconds) when monitoring was first started, or 0 if not started
        Function("getMonitoringStartedAt") { () -> Double in
            guard let shared = UserDefaults(suiteName: kAppGroupID) else { return 0 }
            return shared.double(forKey: kMonitoringStartedKey)
        }
    }
    
    // MARK: - Private Helper Functions
    
    private func sharedDefaults() -> UserDefaults? {
        return UserDefaults(suiteName: kAppGroupID)
    }
    
    private func fetchTodayUsage() async throws -> DailyUsageSummary {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let todayStr = dateFormatter.string(from: Date())
        
        // Try to read from App Groups shared container written by DeviceActivityReport extension
        if let defaults = sharedDefaults(),
           let rawData = defaults.data(forKey: "today_screen_time_\(todayStr)"),
           let stored = try? JSONDecoder().decode(StoredDailyUsage.self, from: rawData) {
            var summary = DailyUsageSummary()
            summary.date = stored.date
            summary.totalScreenTimeSeconds = stored.totalSeconds
            print("DeviceActivityModule: Read today data from App Groups — \(stored.totalSeconds)s")
            return summary
        }
        
        // No data from extension yet — return zero for today (not a stub, just no data)
        var summary = DailyUsageSummary()
        summary.date = todayStr
        summary.totalScreenTimeSeconds = 0
        return summary
    }
    
    private func fetchUsageForRange(start: Date, end: Date) async throws -> [DailyUsageSummary] {
        // Try App Groups first (written by DeviceActivityReport extension)
        if let defaults = sharedDefaults(),
           let rawData = defaults.data(forKey: kWeeklyDataKey),
           let stored = try? JSONDecoder().decode([StoredDailyUsage].self, from: rawData) {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let startStr = dateFormatter.string(from: start)
            let endStr = dateFormatter.string(from: end)
            let filtered = stored.filter { $0.date >= startStr && $0.date <= endStr }
            if !filtered.isEmpty {
                print("DeviceActivityModule: Read range data from App Groups — \(filtered.count) days")
                return filtered.map { item in
                    var summary = DailyUsageSummary()
                    summary.date = item.date
                    summary.totalScreenTimeSeconds = item.totalSeconds
                    return summary
                }
            }
        }
        
        // No extension data available — return empty array so JS falls back to Supabase
        // or shows "monitoring started" state instead of an all-zero chart
        return []
    }
    
    private func fetchTopApps(limit: Int) async throws -> [AppUsageData] {
        // Requires DeviceActivityReport extension — return empty until extension is added
        return []
    }
    
    private func setLimitForCategory(category: String, seconds: Int) async throws {
        let store = ManagedSettingsStore()
        // App category limits require FamilyActivitySelection from user — no-op for now
        _ = store
    }
    
    private func removeAllLimits() async throws {
        let store = ManagedSettingsStore()
        store.clearAllSettings()
    }
    
    private func fetchWeeklyStats() async throws -> [DailyUsageSummary] {
        let calendar = Calendar.current
        let today = Date()
        let weekAgo = calendar.date(byAdding: .day, value: -6, to: today) ?? today
        return try await fetchUsageForRange(start: weekAgo, end: today)
    }
}
