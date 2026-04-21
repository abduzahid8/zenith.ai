import DeviceActivity
import SwiftUI

// DeviceActivityReport extension entry point.
// Declares scenes that the system calls to render usage reports.
// The critical part: makeConfiguration() receives actual DeviceActivityResults
// with real screen time data — we extract and save it to App Groups.

@available(iOS 16.0, *)
@main
struct ScreenTimeReportExtension: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        TotalActivityReport { report in
            TotalActivityView(report: report)
        }
    }
}
