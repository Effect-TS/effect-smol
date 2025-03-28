# Pain Points

- schemas lose their `make` constructor
  - **solution**: add `make` to the base Schema class and derive from that
- simplify formatters
  - **solution**: a single operation
- generic programming is a PITA
  - **solution**: make all generics covariant
- better mutability management
- Classes should be first class citizens
