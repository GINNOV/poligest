Feature: Speed and Security Optimization
  As Uncle Bob's AI Engineer
  I want to ensure the system is fast, secure, and structurally sound
  So that it meets the highest professional standards

  Scenario: Calendar Month View Load Stability
    Given I have a valid session as an "ADMIN"
    When I request the "/calendar" page for a specific month
    Then the page should load without runtime ReferenceErrors
    And the grid should contain exactly the days of that month

  Scenario: Patient List Column Accuracy
    Given I have a list of patients with birthdates and tax IDs
    When I view the "/pazienti/lista" page
    Then I should see columns for "NASCITA", "COD. FISCALE", and "TELEFONO"
    And the phone numbers should be formatted correctly with the 📞 icon

  Scenario: Build Integrity and Lint Compliance
    Given the codebase has been refactored for performance and security
    When I run "npm run build"
    Then the build should complete successfully
    And "npm run lint" should return zero errors and warnings
