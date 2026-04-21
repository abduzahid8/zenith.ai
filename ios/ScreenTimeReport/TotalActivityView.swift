import SwiftUI

// Minimal SwiftUI view — the DeviceActivityReport extension must render something.
// The actual data display happens in the React Native app.
// This view's purpose is simply to trigger makeConfiguration() which writes data to App Groups.

@available(iOS 16.0, *)
struct TotalActivityView: View {
    let report: ActivityReportData

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Screen Time Today")
                .font(.headline)
            Text(formatDuration(report.totalScreenTimeSeconds))
                .font(.largeTitle)
                .fontWeight(.bold)

            if !report.topApps.isEmpty {
                Text("Top Apps")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.top, 4)

                ForEach(report.topApps.prefix(5), id: \.bundleId) { app in
                    HStack {
                        Text(app.displayName)
                            .lineLimit(1)
                        Spacer()
                        Text(formatDuration(app.totalTimeSeconds))
                            .foregroundColor(.secondary)
                    }
                    .font(.caption)
                }
            }
        }
        .padding()
    }

    private func formatDuration(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        if h > 0 {
            return "\(h)h \(m)m"
        }
        return "\(m)m"
    }
}
