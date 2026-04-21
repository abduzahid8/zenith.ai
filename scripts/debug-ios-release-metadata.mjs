import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const runId = `appstore-save-${Date.now()}`;
const attemptedBuild = process.argv[2] ?? null;
const attemptedVersion = process.argv[3] ?? null;

async function emit(hypothesisId, message, data, location) {
  await fetch('http://127.0.0.1:7352/ingest/18d8c6e6-c178-4d3e-966f-dd4a025a76ff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '1355dc',
    },
    body: JSON.stringify({
      sessionId: '1355dc',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function plistValue(plistText, key) {
  const regex = new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`);
  return plistText.match(regex)?.[1] ?? null;
}

function pbxValues(text, key) {
  return [...text.matchAll(new RegExp(`${key} = ([^;]+);`, 'g'))].map((match) => match[1].trim());
}

async function main() {
  const appJson = readJson('app.json');
  const easJson = readJson('eas.json');
  const pbxproj = readFile('ios/zenythai.xcodeproj/project.pbxproj');
  const appInfo = readFile('ios/zenythai/Info.plist');
  const monitorInfo = readFile('ios/ScreenTimeMonitor/Info.plist');
  const reportInfo = readFile('ios/ScreenTimeReport/Info.plist');

  let resolvedExpoConfig = null;
  try {
    resolvedExpoConfig = JSON.parse(execSync('npx expo config --json', { cwd: root, encoding: 'utf8' }));
  } catch (error) {
    resolvedExpoConfig = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let recentIosBuilds = [];
  try {
    recentIosBuilds = JSON.parse(
      execSync('npx eas-cli build:list --platform ios --status finished --limit 50 --json', {
        cwd: root,
        encoding: 'utf8',
      })
    ).map((build) => ({
      id: build.id,
      distribution: build.distribution,
      buildProfile: build.buildProfile,
      appVersion: build.appVersion,
      appBuildVersion: build.appBuildVersion,
      createdAt: build.createdAt,
    }));
  } catch (error) {
    recentIosBuilds = [
      {
        error: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  const appShortVersion = plistValue(appInfo, 'CFBundleShortVersionString');
  const appBuildVersion = plistValue(appInfo, 'CFBundleVersion');
  const monitorShortVersion = plistValue(monitorInfo, 'CFBundleShortVersionString');
  const reportShortVersion = plistValue(reportInfo, 'CFBundleShortVersionString');
  const marketingVersions = pbxValues(pbxproj, 'MARKETING_VERSION');
  const currentProjectVersions = pbxValues(pbxproj, 'CURRENT_PROJECT_VERSION');

  const localMetadata = {
    attemptedBuild,
    attemptedVersion,
    appJsonVersion: appJson.expo?.version ?? null,
    appJsonIosBuildNumber: appJson.expo?.ios?.buildNumber ?? null,
    expoResolvedVersion: resolvedExpoConfig?.version ?? null,
    expoResolvedIosBuildNumber: resolvedExpoConfig?.ios?.buildNumber ?? null,
    xcodeMarketingVersions: marketingVersions,
    xcodeCurrentProjectVersions: currentProjectVersions,
    appShortVersion,
    appBuildVersion,
    monitorShortVersion,
    reportShortVersion,
    easAppVersionSource: easJson.cli?.appVersionSource ?? null,
    easProductionDistribution: easJson.build?.production?.distribution ?? 'store-default',
  };

  // #region agent log
  await emit(
    'H1',
    'Collected iOS release metadata from app config and native files',
    localMetadata,
    'scripts/debug-ios-release-metadata.mjs:81'
  );
  // #endregion

  const versionMismatch = new Set(
    [
      appJson.expo?.version,
      resolvedExpoConfig?.version,
      appShortVersion,
      monitorShortVersion,
      reportShortVersion,
      ...marketingVersions,
      attemptedVersion,
    ].filter(Boolean)
  );

  // #region agent log
  await emit(
    'H2',
    'Version consistency check completed',
    {
      uniqueVersions: [...versionMismatch],
      hasMismatch: versionMismatch.size > 1,
      pageVersionCandidate: attemptedVersion,
    },
    'scripts/debug-ios-release-metadata.mjs:101'
  );
  // #endregion

  const buildMismatch = new Set(
    [
      appJson.expo?.ios?.buildNumber,
      resolvedExpoConfig?.ios?.buildNumber,
      appBuildVersion,
      ...currentProjectVersions,
      attemptedBuild,
    ].filter(Boolean)
  );

  // #region agent log
  await emit(
    'H3',
    'Build number consistency check completed',
    {
      uniqueBuildNumbers: [...buildMismatch],
      hasMismatch: buildMismatch.size > 1,
      attemptedBuild,
      note: 'EAS remote appVersionSource can override local ios.buildNumber during store builds',
    },
    'scripts/debug-ios-release-metadata.mjs:122'
  );
  // #endregion

  // #region agent log
  await emit(
    'H4',
    'EAS release profile and remote version source captured',
    {
      appVersionSource: easJson.cli?.appVersionSource ?? null,
      productionDistribution: easJson.build?.production?.distribution ?? 'store-default',
      developmentDistribution: easJson.build?.development?.distribution ?? null,
      previewDistribution: easJson.build?.preview?.distribution ?? null,
    },
    'scripts/debug-ios-release-metadata.mjs:136'
  );
  // #endregion

  const attemptedBuildSeenInEasHistory = recentIosBuilds.some(
    (build) => build.distribution === 'STORE' && build.appBuildVersion === attemptedBuild
  );

  // #region agent log
  await emit(
    'H5',
    'Recent EAS iOS build history checked against attempted App Store build',
    {
      attemptedBuild,
      attemptedBuildSeenInEasHistory,
      recentStoreBuilds: recentIosBuilds
        .filter((build) => build.distribution === 'STORE')
        .slice(0, 15),
    },
    'scripts/debug-ios-release-metadata.mjs:163'
  );
  // #endregion

  console.log(JSON.stringify({ runId, localMetadata }, null, 2));
}

await main();
