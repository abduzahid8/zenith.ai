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
        AsyncFunction("requestAuthorization") { (promise: Promise) in
            Task { @MainActor in
                print("DeviceActivityModule: Requesting authorization on Main Thread...")
                do {
                    try await self.authorizationCenter.requestAuthorization(for: .individual)
                    print("DeviceActivityModule: Authorization requested successfully")
                    promise.resolve(true)
                } catch {
                    print("DeviceActivityModule: Authorization failed: \(error.localizedDescription)")
                    promise.reject("AUTHORIZATION_ERROR", "Failed to request Screen Time authorization: \(error.localizedDescription)")
                }
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
    }
    
    // MARK: - Private Helper Functions
    
    private func fetchTodayUsage() async throws -> DailyUsageSummary {
        // Note: Actual DeviceActivity data access requires DeviceActivityReport extension
        // This is a simplified implementation that returns mock data
        // Real implementation requires Shield Configuration and Activity Report extensions
        
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
        // In production, this would query DeviceActivityReport
        // For now, return structure that can be populated
        var summary = DailyUsageSummary()
        summary.date = dateFormatter.string(from: today)
        summary.totalScreenTimeSeconds = 0
        summary.socialMediaSeconds = 0
        summary.entertainmentSeconds = 0
        summary.productivitySeconds = 0
        summary.gamesSeconds = 0
        summary.otherSeconds = 0
        summary.pickupCount = 0
        summary.notificationCount = 0
        
        return summary
    }
    
    private func fetchUsageForRange(start: Date, end: Date) async throws -> [DailyUsageSummary] {
        var results: [DailyUsageSummary] = []
        let calendar = Calendar.current
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
        var currentDate = start
        while currentDate <= end {
            var summary = DailyUsageSummary()
            summary.date = dateFormatter.string(from: currentDate)
            results.append(summary)
            
            currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate) ?? end
        }
        
        return results
    }
    
    private func fetchTopApps(limit: Int) async throws -> [AppUsageData] {
        // In production, query DeviceActivityReport for actual app usage
        return []
    }
    
    private func setLimitForCategory(category: String, seconds: Int) async throws {
        // Use ManagedSettings to set time limits
        let store = ManagedSettingsStore()
        
        // Map category string to ActivityCategoryToken
        // This requires the app selection UI from FamilyControls
        // Actual implementation depends on user-selected apps
    }
    
    private func removeAllLimits() async throws {
        let store = ManagedSettingsStore()
        store.clearAllSettings()
    }
    
    private func fetchWeeklyStats() async throws -> [DailyUsageSummary] {
        let calendar = Calendar.current
        let today = Date()
        let weekAgo = calendar.date(byAdding: .day, value: -7, to: today) ?? today
        
        return try await fetchUsageForRange(start: weekAgo, end: today)
    }
}
