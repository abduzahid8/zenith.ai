import DeviceActivity
import Foundation

// DeviceActivityMonitor extension — receives callbacks from DeviceActivityCenter schedules.
// Writes timestamps to App Groups so the main app knows monitoring is active.

@available(iOS 16.0, *)
class ScreenTimeMonitorExtension: DeviceActivityMonitor {

    private let shared = ScreenTimeSharedDefaults.shared

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        print("[ScreenTimeMonitor] intervalDidStart: \(activity.rawValue)")
        shared.setMonitoringStarted()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        print("[ScreenTimeMonitor] intervalDidEnd: \(activity.rawValue)")
        // Interval ended — the DeviceActivityReport extension will collect
        // the actual usage data on the next SwiftUI render cycle.
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        print("[ScreenTimeMonitor] eventDidReachThreshold: \(event.rawValue) for \(activity.rawValue)")
    }

    override func intervalWillStartWarning(for activity: DeviceActivityName) {
        super.intervalWillStartWarning(for: activity)
        print("[ScreenTimeMonitor] intervalWillStartWarning: \(activity.rawValue)")
    }

    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
        print("[ScreenTimeMonitor] intervalWillEndWarning: \(activity.rawValue)")
    }
}
