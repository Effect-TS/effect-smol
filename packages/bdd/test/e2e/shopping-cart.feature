@cli
Feature: CLI shopping cart

  Background:
    Given an empty cart

  Scenario: Adds one item from captures
    When 2 books are added at 20 each
    Then subtotal is 40

  Scenario: Adds multiple items from a DataTable
    When the following items are added:
      | sku      | qty | price |
      | book     | 2   | 20    |
      | notebook | 1   | 5     |
    Then subtotal is 45
