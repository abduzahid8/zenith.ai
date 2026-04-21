import DeviceActivity
import SwiftUI
import ManagedSettings

// MARK: - Report data model passed to the SwiftUI view

struct ActivityReportData {
    let totalScreenTimeSeconds: Int
    let socialMediaSeconds: Int
    let entertainmentSeconds: Int
    let productivitySeconds: Int
    let gamesSeconds: Int
    let otherSeconds: Int
    let topApps: [AppInfo]
    let date: String

    struct AppInfo {
        let bundleId: String
        let displayName: String
        let totalTimeSeconds: Int
        let category: String
    }
}

// MARK: - Report Scene — extracts real usage data from DeviceActivityResults

@available(iOS 16.0, *)
struct TotalActivityReport: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .init(rawValue: "TotalActivity")

    let content: (ActivityReportData) -> TotalActivityView

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()

    func makeConfiguration(
        representing data: DeviceActivityResults<DeviceActivityData>
    ) async -> ActivityReportData {
        // Iterate over the actual device activity data provided by the system
        var totalDuration: TimeInterval = 0
        var socialMedia: TimeInterval = 0
        var entertainment: TimeInterval = 0
        var productivity: TimeInterval = 0
        var games: TimeInterval = 0
        var other: TimeInterval = 0
        var appInfos: [ActivityReportData.AppInfo] = []

        for await activitySegment in data {
            // Each segment represents a day or activity period
            let segmentTotal = activitySegment.totalActivityDuration
            totalDuration += segmentTotal

            // Iterate over categories within each segment
            for await categoryActivity in activitySegment.activityByCategory {
                let catDuration = categoryActivity.totalActivityDuration
                let categoryName = categorize(categoryActivity.category)

                switch categoryName {
                case "social_media":
                    socialMedia += catDuration
                case "entertainment":
                    entertainment += catDuration
                case "productivity":
                    productivity += catDuration
                case "games":
                    games += catDuration
                default:
                    other += catDuration
                }

                // Get individual app data within this category
                for await appActivity in categoryActivity.activityByApplication {
                    let appDuration = appActivity.totalActivityDuration
                    guard appDuration > 0 else { continue }

                    let bundleId = appActivity.application.bundleIdentifier ?? "unknown"
                    let displayName = appActivity.application.localizedDisplayName ?? bundleId

                    // Check if app already exists (across categories)
                    if let idx = appInfos.firstIndex(where: { $0.bundleId == bundleId }) {
                        let existing = appInfos[idx]
                        appInfos[idx] = ActivityReportData.AppInfo(
                            bundleId: bundleId,
                            displayName: displayName,
                            totalTimeSeconds: existing.totalTimeSeconds + Int(appDuration),
                            category: categoryName
                        )
                    } else {
                        appInfos.append(ActivityReportData.AppInfo(
                            bundleId: bundleId,
                            displayName: displayName,
                            totalTimeSeconds: Int(appDuration),
                            category: categoryName
                        ))
                    }
                }
            }
        }

        // Sort apps by usage time (descending)
        appInfos.sort { $0.totalTimeSeconds > $1.totalTimeSeconds }

        let todayStr = dateFormatter.string(from: Date())

        // ====== CRITICAL: Write data to App Groups for the main app to read ======
        let sharedDefaults = ScreenTimeSharedDefaults.shared

        let todayUsage = StoredDailyUsage(
            date: todayStr,
            totalSeconds: Int(totalDuration),
            socialMediaSeconds: Int(socialMedia),
            entertainmentSeconds: Int(entertainment),
            productivitySeconds: Int(productivity),
            gamesSeconds: Int(games),
            otherSeconds: Int(other)
        )
        sharedDefaults.saveTodayUsage(todayUsage)

        // Save top apps
        let topApps = Array(appInfos.prefix(15)).map { app in
            StoredAppUsage(
                bundleId: app.bundleId,
                appName: app.displayName,
                totalTimeSeconds: app.totalTimeSeconds,
                category: app.category
            )
        }
        sharedDefaults.saveTopApps(topApps)

        // Update weekly data by merging today into existing weekly data
        var weeklyData = sharedDefaults.getWeeklyData()
        if let existingIdx = weeklyData.firstIndex(where: { $0.date == todayStr }) {
            weeklyData[existingIdx] = todayUsage
        } else {
            weeklyData.append(todayUsage)
        }
        // Keep only last 14 days
        let cutoff = Calendar.current.date(byAdding: .day, value: -14, to: Date()) ?? Date()
        let cutoffStr = dateFormatter.string(from: cutoff)
        weeklyData = weeklyData.filter { $0.date >= cutoffStr }
        weeklyData.sort { $0.date < $1.date }
        sharedDefaults.saveWeeklyData(weeklyData)

        print("[ScreenTimeReport] Wrote \(Int(totalDuration))s total, \(appInfos.count) apps, weekly: \(weeklyData.count) days")

        return ActivityReportData(
            totalScreenTimeSeconds: Int(totalDuration),
            socialMediaSeconds: Int(socialMedia),
            entertainmentSeconds: Int(entertainment),
            productivitySeconds: Int(productivity),
            gamesSeconds: Int(games),
            otherSeconds: Int(other),
            topApps: appInfos,
            date: todayStr
        )
    }

    // Map Apple's ActivityCategory to our string categories
    private func categorize(_ category: ActivityCategory) -> String {
        switch category {
        case .socialNetworking:
            return "social_media"
        case .entertainment:
            return "entertainment"
        case .productivity, .education, .utilities:
            return "productivity"
        case .games:
            return "games"
        default:
            return "other"
        }
    }
}
