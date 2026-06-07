@effect_bdd @kitchen_sink
Feature: Effect BDD kitchen sink
  Exercises the Effect-specific runner behavior with a real CLI fixture.

  Background:
    Given an empty cart

  Rule: Checkout totals
    Rule backgrounds should run after the feature background.

    Background:
      Given tax is enabled

    @captures @services
    Scenario: capture totals include tax
      When 2 book are added at 20 each
      Then the subtotal is 40
      And the taxed total is 44

    @table @docstring
    Scenario: structured arguments update state
      When the following items are added:
        | sku      | qty | price |
        | book     | 2   | 20    |
        | notebook | 1   | 5     |
      And the request body is:
        """json
        { "sku": "book", "qty": 2 }
        """
      Then the subtotal is 45
      And the payload is accepted

  @outline
  Scenario Outline: outline examples start from initial state
    When <qty> <sku> are added at <price> each
    Then the subtotal is <expected>

    Examples:
      | qty | sku  | price | expected |
      | 1   | pen  | 3     | 3        |
      | 3   | book | 4     | 12       |

  @keyword_agnostic
  Scenario: keyword agnostic setup
    Given the cart starts empty
    Then the scenario can finish with any keyword
