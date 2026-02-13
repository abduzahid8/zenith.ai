Pod::Spec.new do |s|
  s.name           = 'DeviceActivity'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for iOS Screen Time API using DeviceActivity Framework'
  s.description    = 'Native Expo module that provides access to iOS Screen Time data using FamilyControls and DeviceActivity frameworks'
  s.author         = 'Life Switch'
  s.homepage       = 'https://github.com/your-org/life-switch'
  s.platform       = :ios, '16.0'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.swift_version = '5.4'

  # Required frameworks for Screen Time API
  s.frameworks = 'FamilyControls', 'DeviceActivity', 'ManagedSettings'
  
  # Weak link frameworks that may not be available on all devices
  s.weak_frameworks = 'ManagedSettingsUI'
end
