@cli
Feature: CLI account access

  Rule: Account status controls access

    Scenario: Allows an active account
      Given account ada is active
      When the account signs in
      Then access is granted

    Scenario: Denies a locked account
      Given account grace is locked
      When the account signs in
      Then access is denied
