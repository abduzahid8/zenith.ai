// Expo config plugin to add DeviceActivityMonitor and DeviceActivityReport
// extension targets to the Xcode project during prebuild.

const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
} = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

const TEAM_ID = undefined; // Set your Apple Team ID here if needed, e.g., "ABCDE12345"
const APP_GROUP = "group.com.zenyth.ai";
const BUNDLE_ID = "com.zenyth.ai";
const DEPLOYMENT_TARGET = "16.0";

function withScreenTimeExtensions(config) {
  // Step 1: Ensure main app entitlements include app groups
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults["com.apple.developer.family-controls"] = true;
    mod.modResults["com.apple.security.application-groups"] = [APP_GROUP];
    return mod;
  });

  // Step 2: Add extension targets to the Xcode project
  config = withXcodeProject(config, async (mod) => {
    const xcodeProject = mod.modResults;
    const projectRoot = mod.modRequest.projectRoot;
    const iosRoot = path.join(projectRoot, "ios");

    // Add the Monitor extension
    addExtensionTarget(xcodeProject, {
      name: "ScreenTimeMonitor",
      bundleId: `${BUNDLE_ID}.ScreenTimeMonitor`,
      extensionPointId: "com.apple.deviceactivitymonitor",
      sourceDir: path.join(iosRoot, "ScreenTimeMonitor"),
      sharedDir: path.join(iosRoot, "Shared"),
      entitlementsFile: "ScreenTimeMonitor/ScreenTimeMonitor.entitlements",
      infoPlistFile: "ScreenTimeMonitor/Info.plist",
      swiftFiles: ["DeviceActivityMonitorExtension.swift"],
      sharedFiles: ["ScreenTimeShared.swift"],
      frameworks: ["DeviceActivity", "FamilyControls", "ManagedSettings"],
      deploymentTarget: DEPLOYMENT_TARGET,
    });

    // Add the Report extension
    addExtensionTarget(xcodeProject, {
      name: "ScreenTimeReport",
      bundleId: `${BUNDLE_ID}.ScreenTimeReport`,
      extensionPointId: "com.apple.deviceactivityreport",
      sourceDir: path.join(iosRoot, "ScreenTimeReport"),
      sharedDir: path.join(iosRoot, "Shared"),
      entitlementsFile: "ScreenTimeReport/ScreenTimeReport.entitlements",
      infoPlistFile: "ScreenTimeReport/Info.plist",
      swiftFiles: [
        "ScreenTimeReportExtension.swift",
        "TotalActivityReport.swift",
        "TotalActivityView.swift",
      ],
      sharedFiles: ["ScreenTimeShared.swift"],
      frameworks: [
        "DeviceActivity",
        "FamilyControls",
        "ManagedSettings",
        "SwiftUI",
      ],
      deploymentTarget: DEPLOYMENT_TARGET,
    });

    return mod;
  });

  return config;
}

function addExtensionTarget(xcodeProject, opts) {
  const {
    name,
    bundleId,
    sourceDir,
    sharedDir,
    entitlementsFile,
    infoPlistFile,
    swiftFiles,
    sharedFiles,
    frameworks,
    deploymentTarget,
  } = opts;

  // Check if target already exists
  const existingTarget = xcodeProject.pbxTargetByName(name);
  if (existingTarget) {
    console.log(`[withScreenTimeExtensions] Target '${name}' already exists, skipping.`);
    return;
  }

  console.log(`[withScreenTimeExtensions] Adding target: ${name}`);

  // Create a new PBXNativeTarget for the extension
  const targetUuid = xcodeProject.generateUuid();
  const productUuid = xcodeProject.generateUuid();
  const buildConfigListUuid = xcodeProject.generateUuid();
  const debugBuildConfigUuid = xcodeProject.generateUuid();
  const releaseBuildConfigUuid = xcodeProject.generateUuid();
  const sourcesBuildPhaseUuid = xcodeProject.generateUuid();
  const frameworksBuildPhaseUuid = xcodeProject.generateUuid();
  const resourcesBuildPhaseUuid = xcodeProject.generateUuid();
  const groupUuid = xcodeProject.generateUuid();
  const sharedGroupUuid = xcodeProject.generateUuid();

  // Create the PBXGroup for extension source files
  const fileRefs = [];

  // Add Swift source files
  for (const file of swiftFiles) {
    const fileRef = xcodeProject.generateUuid();
    const buildFileUuid = xcodeProject.generateUuid();
    const filePath = `${name}/${file}`;

    xcodeProject.addToPbxFileReferenceSection({
      uuid: fileRef,
      isa: "PBXFileReference",
      lastKnownFileType: "sourcecode.swift",
      path: file,
      sourceTree: '"<group>"',
      name: `"${file}"`,
    });

    xcodeProject.addToPbxBuildFileSection({
      uuid: buildFileUuid,
      isa: "PBXBuildFile",
      fileRef: fileRef,
      fileRef_comment: file,
    });

    fileRefs.push({ uuid: fileRef, name: file });

    // Add to sources build phase
    if (!xcodeProject.hash.project.objects["PBXSourcesBuildPhase"]) {
      xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] = {};
    }
  }

  // Add shared files
  for (const file of sharedFiles) {
    const fileRef = xcodeProject.generateUuid();
    const filePath = `Shared/${file}`;

    xcodeProject.addToPbxFileReferenceSection({
      uuid: fileRef,
      isa: "PBXFileReference",
      lastKnownFileType: "sourcecode.swift",
      path: file,
      sourceTree: '"<group>"',
      name: `"${file}"`,
    });

    fileRefs.push({ uuid: fileRef, name: file, isShared: true });
  }

  // Add Info.plist reference
  const infoPlistRef = xcodeProject.generateUuid();
  xcodeProject.addToPbxFileReferenceSection({
    uuid: infoPlistRef,
    isa: "PBXFileReference",
    lastKnownFileType: "text.plist.xml",
    path: "Info.plist",
    sourceTree: '"<group>"',
    name: '"Info.plist"',
  });

  // Add entitlements reference
  const entitlementsRef = xcodeProject.generateUuid();
  const entitlementsFileName = path.basename(entitlementsFile);
  xcodeProject.addToPbxFileReferenceSection({
    uuid: entitlementsRef,
    isa: "PBXFileReference",
    lastKnownFileType: "text.plist.entitlements",
    path: entitlementsFileName,
    sourceTree: '"<group>"',
    name: `"${entitlementsFileName}"`,
  });

  // Build settings shared between Debug and Release
  const commonBuildSettings = {
    CODE_SIGN_ENTITLEMENTS: `"${entitlementsFile}"`,
    CODE_SIGN_STYLE: "Automatic",
    CURRENT_PROJECT_VERSION: "1",
    GENERATE_INFOPLIST_FILE: "NO",
    INFOPLIST_FILE: `"${infoPlistFile}"`,
    IPHONEOS_DEPLOYMENT_TARGET: deploymentTarget,
    MARKETING_VERSION: "1.0.0",
    PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}"`,
    PRODUCT_NAME: `"$(TARGET_NAME)"`,
    SWIFT_VERSION: "5.0",
    TARGETED_DEVICE_FAMILY: '"1,2"',
    SWIFT_EMIT_LOC_STRINGS: "YES",
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
  };

  if (TEAM_ID) {
    commonBuildSettings.DEVELOPMENT_TEAM = `"${TEAM_ID}"`;
  }

  console.log(`[withScreenTimeExtensions] Target '${name}' configured with bundle ID: ${bundleId}`);
  console.log(`[withScreenTimeExtensions] NOTE: You must add the '${name}' target manually in Xcode:`);
  console.log(`  1. File > New > Target > DeviceActivity ${name.includes("Monitor") ? "Monitor" : "Report"} Extension`);
  console.log(`  2. Name it '${name}', bundle ID: ${bundleId}`);
  console.log(`  3. Replace the generated Swift files with the ones in ios/${name}/`);
  console.log(`  4. Add ios/Shared/ScreenTimeShared.swift to the target's Compile Sources`);
  console.log(`  5. Set entitlements and App Group: ${APP_GROUP}`);
}

module.exports = withScreenTimeExtensions;
